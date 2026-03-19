# Feature: Full-Project Drift Check & Sync

## Status: Proposed

## Summary

Implement full-project drift detection and synchronization that can scan the entire remote project for changes, allowing users to sync new or modified content without accidentally deleting cloud folders that aren't downloaded locally.

---

## Current State

### What Exists
- **Individual Folder Sync**: Users can sync registered folders one at a time
- **DetectChangedFolders**: Runs dry-run on local folders to find changes
- **ExecuteFullBackup**: Syncs entire project to a backup location (different from selective sync)
- **AllowGlobalSync Flag**: Exists in ProjectConfig but unused

### Limitations
1. **No Remote-Wide Detection**: Cannot detect changes across entire remote project
2. **No Safe Full Sync**: Running `rclone sync` from project root would delete remote folders not present locally
3. **No Drift Visibility**: Users can't see what's changed on remote without downloading
4. **Manual Discovery**: Users must manually check each folder for updates

---

## Requirements

### Core Requirements
- [ ] Detect drift (differences) between local and remote across entire project
- [ ] Show comprehensive diff summary before any sync operation
- [ ] Support syncing new remote content without deleting undownloaded folders
- [ ] Handle large projects efficiently (VFX projects can have thousands of folders)

### Safety Requirements
- [ ] NEVER delete remote content that exists only on remote (not downloaded locally)
- [ ] Clearly distinguish between:
  - Files changed locally (need push)
  - Files changed remotely (need pull)
  - Folders only on remote (safe, not local)
  - Folders only locally (may need upload)
- [ ] Require explicit user confirmation for destructive operations

---

## Proposed Solution

### Drift Detection Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Drift Detection Flow                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. List Remote Structure                                        │
│     rclone lsf <remote>:<bucket> --dirs-only -R                 │
│     → Returns all folders on remote                              │
│                                                                  │
│  2. List Local Structure                                         │
│     Walk local project directory                                 │
│     → Returns all local folders                                  │
│                                                                  │
│  3. Compare & Categorize                                         │
│     ┌────────────────┬────────────────┬────────────────────────┐│
│     │ Remote Only    │ Local Only     │ Both (need diff)       ││
│     │ (safe to skip) │ (may need push)│ (check for changes)    ││
│     └────────────────┴────────────────┴────────────────────────┘│
│                                                                  │
│  4. For folders in both: Run rclone check                       │
│     rclone check <local> <remote> --one-way                     │
│     → Identifies files that differ                               │
│                                                                  │
│  5. Generate Drift Report                                        │
│     → Summary UI showing all differences                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Sync Strategies

#### Strategy 1: Selective Sync (Current, Enhanced)
- Continue current folder-by-folder approach
- Add bulk operations on selected folders
- Safer, more controlled

#### Strategy 2: Smart Full Sync (New)
```
rclone sync <local> <remote> --exclude <remote-only-folders>
```
- Dynamically generate exclude list from remote-only folders
- Syncs everything local → remote without deleting remote-only content

#### Strategy 3: Bidirectional Sync (Advanced)
```
rclone bisync <local> <remote> --resync
```
- True bidirectional synchronization
- More complex conflict handling
- Requires rclone 1.58+ with bisync support

---

## Implementation Details

### New Data Models

```go
// Drift detection result
type DriftReport struct {
    Timestamp       time.Time              `json:"timestamp"`
    RemoteOnlyDirs  []string               `json:"remote_only_dirs"`
    LocalOnlyDirs   []string               `json:"local_only_dirs"`
    ModifiedDirs    []DirDiff              `json:"modified_dirs"`
    TotalRemote     int                    `json:"total_remote"`
    TotalLocal      int                    `json:"total_local"`
    ScanDurationMs  int64                  `json:"scan_duration_ms"`
}

type DirDiff struct {
    Path           string   `json:"path"`
    LocalNewer     []string `json:"local_newer"`      // Files newer locally
    RemoteNewer    []string `json:"remote_newer"`     // Files newer on remote
    LocalOnly      []string `json:"local_only"`       // Files only local
    RemoteOnly     []string `json:"remote_only"`      // Files only on remote
    SizeDiff       int64    `json:"size_diff"`        // Size difference in bytes
}

// Sync operation configuration
type FullSyncConfig struct {
    Direction       string   `json:"direction"`        // "push", "pull", "bidirectional"
    ExcludeDirs     []string `json:"exclude_dirs"`     // Folders to skip
    IncludeDirs     []string `json:"include_dirs"`     // Only sync these (if set)
    DeleteRemote    bool     `json:"delete_remote"`    // Allow deleting remote files
    DeleteLocal     bool     `json:"delete_local"`     // Allow deleting local files
    DryRun          bool     `json:"dry_run"`
}
```

### Backend Changes

#### New SyncService Methods

```go
// Detect drift across entire project
func (ss *SyncService) DetectFullProjectDrift() (DriftReport, error) {
    report := DriftReport{Timestamp: time.Now()}

    // 1. Get remote folder structure
    remoteDirs, err := ss.listRemoteDirs()
    if err != nil {
        return report, err
    }
    report.TotalRemote = len(remoteDirs)

    // 2. Get local folder structure
    localDirs, err := ss.listLocalDirs()
    if err != nil {
        return report, err
    }
    report.TotalLocal = len(localDirs)

    // 3. Categorize
    remoteSet := toSet(remoteDirs)
    localSet := toSet(localDirs)

    for dir := range remoteSet {
        if !localSet[dir] {
            report.RemoteOnlyDirs = append(report.RemoteOnlyDirs, dir)
        }
    }

    for dir := range localSet {
        if !remoteSet[dir] {
            report.LocalOnlyDirs = append(report.LocalOnlyDirs, dir)
        }
    }

    // 4. For dirs in both, check for differences
    commonDirs := intersection(remoteSet, localSet)
    for _, dir := range commonDirs {
        diff, err := ss.checkDirDiff(dir)
        if err != nil {
            continue // Log and continue
        }
        if diff.HasChanges() {
            report.ModifiedDirs = append(report.ModifiedDirs, diff)
        }
    }

    report.ScanDurationMs = time.Since(report.Timestamp).Milliseconds()
    return report, nil
}

// List all directories on remote
func (ss *SyncService) listRemoteDirs() ([]string, error) {
    remote := ss.getRemotePath()
    // rclone lsf <remote>:<bucket> --dirs-only -R
    cmd := exec.Command("rclone", "lsf", remote, "--dirs-only", "-R")
    output, err := cmd.Output()
    if err != nil {
        return nil, err
    }
    return parseLines(string(output)), nil
}

// Check differences for a specific directory
func (ss *SyncService) checkDirDiff(dir string) (DirDiff, error) {
    localPath := filepath.Join(ss.localRoot, dir)
    remotePath := ss.remotePath + "/" + dir

    // rclone check <local> <remote> --one-way --combined -
    cmd := exec.Command("rclone", "check", localPath, remotePath,
        "--one-way", "--combined", "-")
    output, err := cmd.Output()
    // Parse output for differences
    return parseDiffOutput(dir, string(output)), nil
}

// Execute safe full project sync
func (ss *SyncService) ExecuteFullProjectSync(config FullSyncConfig) ([]RcloneActionOutput, error) {
    var results []RcloneActionOutput

    // Build exclude list (always exclude remote-only dirs when pushing)
    excludeArgs := []string{}
    if config.Direction == "push" && !config.DeleteRemote {
        drift, _ := ss.DetectFullProjectDrift()
        for _, dir := range drift.RemoteOnlyDirs {
            excludeArgs = append(excludeArgs, "--exclude", dir+"/**")
        }
    }

    // Build rclone command
    args := []string{"sync"}
    if config.Direction == "push" {
        args = append(args, ss.localRoot, ss.remotePath)
    } else {
        args = append(args, ss.remotePath, ss.localRoot)
    }
    args = append(args, excludeArgs...)

    if config.DryRun {
        args = append(args, "--dry-run")
    }

    cmd := exec.Command("rclone", args...)
    output, err := cmd.CombinedOutput()

    results = append(results, RcloneActionOutput{
        TargetFolder:  "FULL_PROJECT",
        CommandOutput: string(output),
        CommandError:  errorToString(err),
    })

    return results, err
}
```

#### Performance Optimizations

```go
// Parallel drift detection for large projects
func (ss *SyncService) DetectFullProjectDriftParallel() (DriftReport, error) {
    // Use rclone's built-in parallelism
    // rclone check --checkers 16 --transfers 16

    // Or use Go's concurrency for checking multiple dirs
    var wg sync.WaitGroup
    results := make(chan DirDiff, 100)

    for _, dir := range commonDirs {
        wg.Add(1)
        go func(d string) {
            defer wg.Done()
            diff, _ := ss.checkDirDiff(d)
            if diff.HasChanges() {
                results <- diff
            }
        }(dir)
    }

    go func() {
        wg.Wait()
        close(results)
    }()

    // Collect results
    for diff := range results {
        report.ModifiedDirs = append(report.ModifiedDirs, diff)
    }
}

// Incremental drift detection (cache previous scan)
type DriftCache struct {
    LastScan       time.Time         `json:"last_scan"`
    RemoteChecksum string            `json:"remote_checksum"`  // Hash of dir listing
    CachedReport   DriftReport       `json:"cached_report"`
}

func (ss *SyncService) DetectDriftWithCache() (DriftReport, bool, error) {
    cache, _ := ss.loadDriftCache()

    // Check if remote has changed since last scan
    currentChecksum := ss.getRemoteDirChecksum()
    if cache.RemoteChecksum == currentChecksum {
        return cache.CachedReport, true, nil  // Return cached, fromCache=true
    }

    // Remote changed, do full scan
    report, err := ss.DetectFullProjectDrift()
    if err == nil {
        ss.saveDriftCache(DriftCache{
            LastScan:       time.Now(),
            RemoteChecksum: currentChecksum,
            CachedReport:   report,
        })
    }
    return report, false, err
}
```

### Frontend Changes

#### New Components

**DriftReportPanel** (`components/SyncFolders/DriftReportPanel.tsx`)
```typescript
interface DriftReportPanelProps {
    report: DriftReport | null;
    isLoading: boolean;
    onRefresh: () => void;
    onSyncSelected: (dirs: string[], direction: 'push' | 'pull') => void;
}

const DriftReportPanel: React.FC<DriftReportPanelProps> = ({...}) => {
    return (
        <Box>
            <Box display="flex" justifyContent="space-between">
                <Typography variant="h6">Project Drift Report</Typography>
                <Button onClick={onRefresh} disabled={isLoading}>
                    {isLoading ? <CircularProgress size={20} /> : 'Scan'}
                </Button>
            </Box>

            {report && (
                <>
                    <DriftSummaryCard report={report} />
                    <Tabs>
                        <Tab label={`Remote Only (${report.remote_only_dirs.length})`} />
                        <Tab label={`Local Only (${report.local_only_dirs.length})`} />
                        <Tab label={`Modified (${report.modified_dirs.length})`} />
                    </Tabs>
                    {/* Tab panels with selectable folder lists */}
                </>
            )}
        </Box>
    );
};
```

**DriftSummaryCard**
```typescript
const DriftSummaryCard: React.FC<{ report: DriftReport }> = ({ report }) => {
    return (
        <Card>
            <CardContent>
                <Grid container spacing={2}>
                    <Grid item xs={3}>
                        <Typography variant="h4">{report.total_remote}</Typography>
                        <Typography color="textSecondary">Remote Folders</Typography>
                    </Grid>
                    <Grid item xs={3}>
                        <Typography variant="h4">{report.total_local}</Typography>
                        <Typography color="textSecondary">Local Folders</Typography>
                    </Grid>
                    <Grid item xs={3}>
                        <Typography variant="h4" color="warning.main">
                            {report.modified_dirs.length}
                        </Typography>
                        <Typography color="textSecondary">With Changes</Typography>
                    </Grid>
                    <Grid item xs={3}>
                        <Typography variant="body2">
                            Scanned in {report.scan_duration_ms}ms
                        </Typography>
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
};
```

**FullSyncDialog**
```typescript
interface FullSyncDialogProps {
    open: boolean;
    driftReport: DriftReport;
    onClose: () => void;
    onConfirm: (config: FullSyncConfig) => void;
}

const FullSyncDialog: React.FC<FullSyncDialogProps> = ({...}) => {
    const [direction, setDirection] = useState<'push' | 'pull'>('pull');
    const [excludeDirs, setExcludeDirs] = useState<string[]>([]);

    return (
        <Dialog open={open} maxWidth="md" fullWidth>
            <DialogTitle>Full Project Sync</DialogTitle>
            <DialogContent>
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Full sync will affect all folders. Review carefully.
                </Alert>

                <FormControl>
                    <FormLabel>Direction</FormLabel>
                    <RadioGroup value={direction} onChange={(e) => setDirection(e.target.value)}>
                        <FormControlLabel value="pull" label="Pull from Remote (update local)" />
                        <FormControlLabel value="push" label="Push to Remote (update remote)" />
                    </RadioGroup>
                </FormControl>

                {direction === 'push' && (
                    <Alert severity="info">
                        {driftReport.remote_only_dirs.length} remote-only folders will be preserved
                        (not deleted).
                    </Alert>
                )}

                <Typography variant="subtitle2" sx={{ mt: 2 }}>
                    Folders to exclude:
                </Typography>
                <List>
                    {/* Selectable list of folders to exclude */}
                </List>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={() => onConfirm({direction, excludeDirs, ...})}>
                    Preview Changes
                </Button>
            </DialogActions>
        </Dialog>
    );
};
```

### UI Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Project Dashboard                          [Scan Drift] button │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Drift Report (Last scan: 5 minutes ago)                  │  │
│  │  ┌──────────┬──────────┬──────────┬──────────┐           │  │
│  │  │  1,234   │   156    │    12    │   3      │           │  │
│  │  │ Remote   │  Local   │ Changed  │ Conflict │           │  │
│  │  └──────────┴──────────┴──────────┴──────────┘           │  │
│  │                                                           │  │
│  │  [Remote Only] [Local Only] [Modified] tabs               │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │ ☐ scenes/scene_042/                     (12.4 GB)   │ │  │
│  │  │ ☐ scenes/scene_043/                     (8.7 GB)    │ │  │
│  │  │ ☐ resources/textures_v2/                (2.1 GB)    │ │  │
│  │  │ ...                                                  │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  [Download Selected] [Full Sync...] buttons              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Safety Mechanisms

### Delete Protection

```go
// NEVER delete remote content unless explicitly configured
func (ss *SyncService) ExecuteFullProjectSync(config FullSyncConfig) error {
    // Default: protect remote-only content
    if !config.DeleteRemote {
        drift, _ := ss.DetectFullProjectDrift()
        for _, dir := range drift.RemoteOnlyDirs {
            config.ExcludeDirs = append(config.ExcludeDirs, dir)
        }
    }

    // Require explicit confirmation for delete operations
    if config.DeleteRemote {
        // This should only be possible after user types "DELETE" confirmation
        log.Warn("Delete remote enabled - remote-only content may be removed")
    }
}
```

### Confirmation Dialog for Destructive Operations

```typescript
// Require typing "DELETE" to enable remote deletion
const DeleteConfirmationDialog = ({ onConfirm }) => {
    const [confirmText, setConfirmText] = useState('');

    return (
        <Dialog>
            <DialogTitle color="error">Dangerous Operation</DialogTitle>
            <DialogContent>
                <Alert severity="error">
                    This will permanently delete files from cloud storage.
                    This cannot be undone.
                </Alert>
                <Typography>
                    {remoteOnlyDirs.length} folders exist only on remote and will be deleted.
                </Typography>
                <TextField
                    label="Type DELETE to confirm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onConfirm} disabled={confirmText !== 'DELETE'}>
                    I understand, delete remote content
                </Button>
            </DialogActions>
        </Dialog>
    );
};
```

---

## Implementation Tasks

### Phase 1: Drift Detection
1. [ ] Implement `listRemoteDirs()` using rclone lsf
2. [ ] Implement `listLocalDirs()` using filepath.Walk
3. [ ] Implement `DetectFullProjectDrift()` basic version
4. [ ] Create `DriftReport` data model
5. [ ] Add API endpoint for drift detection

### Phase 2: Frontend Display
1. [ ] Create `DriftReportPanel` component
2. [ ] Create `DriftSummaryCard` component
3. [ ] Add drift scan button to ProjectDashboard
4. [ ] Display categorized folder lists (tabs)
5. [ ] Add folder selection for bulk operations

### Phase 3: Safe Full Sync
1. [ ] Implement `ExecuteFullProjectSync()` with exclusions
2. [ ] Build dynamic exclude list from remote-only folders
3. [ ] Create `FullSyncDialog` component
4. [ ] Add dry-run preview for full sync
5. [ ] Implement push/pull direction selection

### Phase 4: Performance
1. [ ] Add parallel drift detection
2. [ ] Implement drift cache with checksums
3. [ ] Add progress indicators for large scans
4. [ ] Optimize for projects with 1000+ folders

### Phase 5: Safety & UX
1. [ ] Add delete confirmation dialogs
2. [ ] Implement "type DELETE" confirmation
3. [ ] Add operation logging/audit trail
4. [ ] Add undo/recovery information display

---

## Rclone Commands Reference

| Operation | Command |
|-----------|---------|
| List remote dirs | `rclone lsf <remote>:<bucket> --dirs-only -R` |
| List remote files | `rclone lsf <remote>:<bucket> -R` |
| Check differences | `rclone check <local> <remote> --combined -` |
| Sync with excludes | `rclone sync <src> <dst> --exclude "dir/**"` |
| Size comparison | `rclone size <remote>:<bucket>/path` |
| Bidirectional | `rclone bisync <local> <remote> --resync` |

---

## Testing Considerations

- Test with large folder counts (1000+)
- Test with deep nesting (10+ levels)
- Test with mixed content (some local, some remote)
- Test exclude list generation
- Test that remote-only content is never deleted by default
- Test dry-run accuracy matches actual sync
- Test concurrent operations (detect while syncing)
- Test network interruption during scan
