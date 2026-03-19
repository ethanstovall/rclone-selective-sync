# Feature: Multi-User Locking Mechanism

## Status: Proposed

## Summary

Implement a collaborative locking system that allows multiple users to work on the same project simultaneously while preventing conflicts. Users can lock files or folders at varying granularity levels, and locks prevent others from overwriting content. This is the most complex proposed feature, requiring infrastructure support and significant UI changes.

> **Prerequisite**: This feature depends on [FEATURE_FILE_EXPLORER.md](./FEATURE_FILE_EXPLORER.md) for the in-app file browser that displays lock status and controls file access.

---

## Problem Statement

### Current Situation
- Single-user design: no awareness of other users
- No protection against concurrent modifications
- Users could overwrite each other's changes
- No visibility into who is working on what

### Risks Without Locking
1. **Lost Work**: User A pushes, overwriting User B's remote changes
2. **Merge Conflicts**: No mechanism to detect or resolve conflicts
3. **Coordination Overhead**: Users must manually communicate who's working where
4. **Accidental Overwrites**: Even well-meaning users can stomp on each other

---

## Requirements

### Core Requirements
- [ ] Users can acquire locks on files or folders
- [ ] Locks prevent other users from pushing changes to locked resources
- [ ] Lock status is visible to all users
- [ ] Locks can be released manually or expire automatically
- [ ] Support granular locking (single file to entire folder tree)

### User Experience Requirements
- [ ] Clear visibility of what's locked and by whom
- [ ] In-app file browser showing lock status
- [ ] Prevent accidental edits to locked content
- [ ] Graceful handling when lock acquisition fails

### Trust & Safety Requirements
- [ ] Users cannot directly modify filesystem outside app (or app must detect this)
- [ ] Lock state must be persistent and shared across all users
- [ ] Recovery mechanism for orphaned locks (user goes offline)
- [ ] Audit trail of lock operations

---

## Architecture Options

### Option A: Cloud-Based Lock Service (Recommended)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Lock Service Architecture                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│    User A (macOS)          Lock Server           User B (Win)   │
│    ┌──────────┐            ┌─────────┐          ┌──────────┐   │
│    │ App      │◄──────────►│ API     │◄────────►│ App      │   │
│    │          │   REST/WS  │ Server  │  REST/WS │          │   │
│    └──────────┘            └────┬────┘          └──────────┘   │
│                                 │                               │
│                            ┌────▼────┐                          │
│                            │ Database│                          │
│                            │ (Locks) │                          │
│                            └─────────┘                          │
│                                                                  │
│    Cloud Storage (B2/S3)                                        │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │  project/                                                │  │
│    │  ├── sync.json                                          │  │
│    │  ├── .locks/ (lock manifest backup)                     │  │
│    │  ├── scenes/                                            │  │
│    │  └── ...                                                │  │
│    └─────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Pros**:
- Real-time lock status via WebSocket
- Proper concurrency control
- Audit logging built-in
- Can integrate with existing auth systems

**Cons**:
- Requires server infrastructure
- Additional operational complexity
- Ongoing costs
- Users need internet connectivity

### Option B: File-Based Distributed Locks

```
┌─────────────────────────────────────────────────────────────────┐
│                    File-Based Lock Architecture                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│    Cloud Storage                                                 │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │  project/                                                │  │
│    │  ├── .locks/                                            │  │
│    │  │   ├── manifest.json          # Lock registry         │  │
│    │  │   ├── scenes_scene_001.lock  # Individual lock files │  │
│    │  │   └── scenes_scene_002.lock                          │  │
│    │  ├── sync.json                                          │  │
│    │  └── scenes/                                            │  │
│    └─────────────────────────────────────────────────────────┘  │
│                                                                  │
│    User A                              User B                    │
│    1. Download .locks/manifest.json    1. Download manifest     │
│    2. Check if resource locked         2. See A has lock        │
│    3. Create lock file, upload         3. Wait or request       │
│    4. Upload manifest update           4. Refresh periodically  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Pros**:
- No additional infrastructure
- Works with existing rclone setup
- Portable across cloud providers

**Cons**:
- Race conditions possible (eventual consistency)
- No real-time updates
- Polling required for status
- Clock skew issues with expiry

### Option C: Hybrid (Recommended Starting Point)

Start with **file-based locks** for simplicity, with a clear upgrade path to **server-based** when needed.

```
Phase 1: File-based locks
  - Store locks in .locks/ directory on remote
  - Poll for updates every 30-60 seconds
  - Optimistic locking with conflict detection

Phase 2: Optional server upgrade
  - Add lock server for real-time updates
  - File-based as fallback when offline
  - Gradual migration for teams
```

---

## Data Models

### Lock Structure

```go
type Lock struct {
    ID           string    `json:"id"`            // UUID
    ResourcePath string    `json:"resource_path"` // Path being locked
    ResourceType string    `json:"resource_type"` // "file" or "folder"
    Recursive    bool      `json:"recursive"`     // Lock subdirectories too
    UserID       string    `json:"user_id"`       // Who holds the lock
    UserName     string    `json:"user_name"`     // Display name
    MachineName  string    `json:"machine_name"`  // For debugging
    AcquiredAt   time.Time `json:"acquired_at"`
    ExpiresAt    time.Time `json:"expires_at"`    // Auto-release time
    Heartbeat    time.Time `json:"heartbeat"`     // Last activity
    Reason       string    `json:"reason"`        // Optional description
}

type LockManifest struct {
    Version     int              `json:"version"`
    UpdatedAt   time.Time        `json:"updated_at"`
    Locks       map[string]Lock  `json:"locks"`       // path → lock
    LockHistory []LockEvent      `json:"lock_history"` // Audit trail
}

type LockEvent struct {
    Timestamp   time.Time `json:"timestamp"`
    EventType   string    `json:"event_type"` // "acquired", "released", "expired", "broken"
    LockID      string    `json:"lock_id"`
    UserID      string    `json:"user_id"`
    ResourcePath string   `json:"resource_path"`
}
```

### User Identity

```go
type UserIdentity struct {
    ID          string `json:"id"`           // UUID, persisted per install
    DisplayName string `json:"display_name"` // User-configurable
    Email       string `json:"email"`        // Optional
    MachineName string `json:"machine_name"` // Hostname
}
```

---

## Backend Implementation

### LockService

```go
type LockService struct {
    configManager  *ConfigManager
    userIdentity   *UserIdentity
    lockManifest   *LockManifest
    manifestMutex  sync.RWMutex
    heartbeatStop  chan struct{}
}

// Initialize lock service
func NewLockService(cm *ConfigManager) *LockService {
    ls := &LockService{
        configManager: cm,
        userIdentity:  loadOrCreateUserIdentity(),
    }
    ls.startHeartbeat()
    return ls
}

// Acquire a lock on a resource
func (ls *LockService) AcquireLock(resourcePath string, recursive bool, reason string) (*Lock, error) {
    ls.manifestMutex.Lock()
    defer ls.manifestMutex.Unlock()

    // 1. Refresh manifest from remote
    if err := ls.refreshManifest(); err != nil {
        return nil, fmt.Errorf("failed to refresh locks: %w", err)
    }

    // 2. Check if resource (or parent/child) is already locked
    if conflictingLock := ls.findConflictingLock(resourcePath, recursive); conflictingLock != nil {
        return nil, &LockConflictError{
            RequestedPath: resourcePath,
            ConflictingLock: conflictingLock,
        }
    }

    // 3. Create new lock
    lock := &Lock{
        ID:           uuid.New().String(),
        ResourcePath: resourcePath,
        ResourceType: ls.detectResourceType(resourcePath),
        Recursive:    recursive,
        UserID:       ls.userIdentity.ID,
        UserName:     ls.userIdentity.DisplayName,
        MachineName:  ls.userIdentity.MachineName,
        AcquiredAt:   time.Now(),
        ExpiresAt:    time.Now().Add(24 * time.Hour), // Default 24h expiry
        Heartbeat:    time.Now(),
        Reason:       reason,
    }

    // 4. Add to manifest
    ls.lockManifest.Locks[resourcePath] = *lock
    ls.lockManifest.UpdatedAt = time.Now()
    ls.lockManifest.LockHistory = append(ls.lockManifest.LockHistory, LockEvent{
        Timestamp:    time.Now(),
        EventType:    "acquired",
        LockID:       lock.ID,
        UserID:       lock.UserID,
        ResourcePath: resourcePath,
    })

    // 5. Upload updated manifest
    if err := ls.uploadManifest(); err != nil {
        delete(ls.lockManifest.Locks, resourcePath) // Rollback
        return nil, fmt.Errorf("failed to save lock: %w", err)
    }

    return lock, nil
}

// Release a lock
func (ls *LockService) ReleaseLock(resourcePath string) error {
    ls.manifestMutex.Lock()
    defer ls.manifestMutex.Unlock()

    // Verify we own the lock
    lock, exists := ls.lockManifest.Locks[resourcePath]
    if !exists {
        return fmt.Errorf("no lock found for %s", resourcePath)
    }
    if lock.UserID != ls.userIdentity.ID {
        return fmt.Errorf("lock owned by %s, not you", lock.UserName)
    }

    // Remove lock
    delete(ls.lockManifest.Locks, resourcePath)
    ls.lockManifest.LockHistory = append(ls.lockManifest.LockHistory, LockEvent{
        Timestamp:    time.Now(),
        EventType:    "released",
        LockID:       lock.ID,
        UserID:       lock.UserID,
        ResourcePath: resourcePath,
    })

    return ls.uploadManifest()
}

// Get current lock status for all resources
func (ls *LockService) GetLockStatus() (*LockManifest, error) {
    ls.manifestMutex.RLock()
    defer ls.manifestMutex.RUnlock()

    if err := ls.refreshManifest(); err != nil {
        return nil, err
    }

    // Clean up expired locks
    ls.cleanupExpiredLocks()

    return ls.lockManifest, nil
}

// Check if a specific resource is locked
func (ls *LockService) IsLocked(resourcePath string) (*Lock, bool) {
    ls.manifestMutex.RLock()
    defer ls.manifestMutex.RUnlock()

    // Direct lock
    if lock, exists := ls.lockManifest.Locks[resourcePath]; exists {
        return &lock, true
    }

    // Parent recursive lock
    for path, lock := range ls.lockManifest.Locks {
        if lock.Recursive && strings.HasPrefix(resourcePath, path+"/") {
            return &lock, true
        }
    }

    return nil, false
}

// Find locks that would conflict with requested lock
func (ls *LockService) findConflictingLock(resourcePath string, recursive bool) *Lock {
    // Check exact path
    if lock, exists := ls.lockManifest.Locks[resourcePath]; exists {
        return &lock
    }

    // Check if any parent has recursive lock
    for path, lock := range ls.lockManifest.Locks {
        if lock.Recursive && strings.HasPrefix(resourcePath, path+"/") {
            return &lock
        }
    }

    // If requesting recursive, check if any child is locked
    if recursive {
        for path, lock := range ls.lockManifest.Locks {
            if strings.HasPrefix(path, resourcePath+"/") {
                return &lock
            }
        }
    }

    return nil
}

// Background heartbeat to keep locks alive
func (ls *LockService) startHeartbeat() {
    ls.heartbeatStop = make(chan struct{})
    go func() {
        ticker := time.NewTicker(5 * time.Minute)
        defer ticker.Stop()
        for {
            select {
            case <-ticker.C:
                ls.updateHeartbeats()
            case <-ls.heartbeatStop:
                return
            }
        }
    }()
}

func (ls *LockService) updateHeartbeats() {
    ls.manifestMutex.Lock()
    defer ls.manifestMutex.Unlock()

    updated := false
    for path, lock := range ls.lockManifest.Locks {
        if lock.UserID == ls.userIdentity.ID {
            lock.Heartbeat = time.Now()
            lock.ExpiresAt = time.Now().Add(24 * time.Hour) // Extend expiry
            ls.lockManifest.Locks[path] = lock
            updated = true
        }
    }

    if updated {
        ls.uploadManifest()
    }
}

// Clean up locks that have expired
func (ls *LockService) cleanupExpiredLocks() {
    now := time.Now()
    for path, lock := range ls.lockManifest.Locks {
        if now.After(lock.ExpiresAt) {
            delete(ls.lockManifest.Locks, path)
            ls.lockManifest.LockHistory = append(ls.lockManifest.LockHistory, LockEvent{
                Timestamp:    now,
                EventType:    "expired",
                LockID:       lock.ID,
                UserID:       lock.UserID,
                ResourcePath: path,
            })
        }
    }
}

// Remote operations
func (ls *LockService) refreshManifest() error {
    // rclone copyto <remote>:bucket/.locks/manifest.json <temp>/manifest.json
    // Parse and merge with local state
}

func (ls *LockService) uploadManifest() error {
    // Write manifest to temp file
    // rclone copyto <temp>/manifest.json <remote>:bucket/.locks/manifest.json
}
```

### Lock-Aware Sync Service

```go
// Modified sync service that checks locks before operations
func (ss *SyncService) ExecuteRcloneActionWithLocks(targetFolders []string, action RcloneAction, dry bool) ([]RcloneActionOutput, error) {
    results := make([]RcloneActionOutput, len(targetFolders))

    for i, folder := range targetFolders {
        // Check lock status before push operations
        if action == SYNC_PUSH {
            if lock, locked := ss.lockService.IsLocked(folder); locked {
                if lock.UserID != ss.lockService.userIdentity.ID {
                    results[i] = RcloneActionOutput{
                        TargetFolder:  folder,
                        CommandError:  fmt.Sprintf("Cannot push: locked by %s since %s", lock.UserName, lock.AcquiredAt),
                    }
                    continue
                }
            }
        }

        // Proceed with normal sync
        results[i] = ss.executeSingleRcloneAction(folder, action, dry)
    }

    return results, nil
}
```

---

## Frontend Implementation

### In-App File Explorer

> **Note**: The base file explorer implementation is detailed in [FEATURE_FILE_EXPLORER.md](./FEATURE_FILE_EXPLORER.md). This section describes the lock-specific extensions.

To enforce locking, users should interact with files through the app rather than directly on filesystem.

```typescript
// components/FileExplorer/FileExplorer.tsx
interface FileExplorerProps {
    rootPath: string;
    lockManifest: LockManifest;
    onLockAcquire: (path: string, recursive: boolean) => Promise<void>;
    onLockRelease: (path: string) => Promise<void>;
}

const FileExplorer: React.FC<FileExplorerProps> = ({...}) => {
    const [currentPath, setCurrentPath] = useState(rootPath);
    const [entries, setEntries] = useState<FileEntry[]>([]);
    const [selectedEntries, setSelectedEntries] = useState<string[]>([]);

    return (
        <Box>
            <Breadcrumbs>{/* Path breadcrumbs */}</Breadcrumbs>

            <Toolbar>
                <Button onClick={() => handleLockSelected(false)}>Lock</Button>
                <Button onClick={() => handleLockSelected(true)}>Lock (Recursive)</Button>
                <Button onClick={handleUnlockSelected}>Unlock</Button>
                <Button onClick={handleOpenInExplorer} disabled={hasLockedByOthers}>
                    Open in Explorer
                </Button>
            </Toolbar>

            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Size</TableCell>
                        <TableCell>Modified</TableCell>
                        <TableCell>Lock Status</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {entries.map(entry => (
                        <FileRow
                            key={entry.path}
                            entry={entry}
                            lockStatus={getLockStatus(entry.path)}
                            onSelect={handleSelect}
                            onDoubleClick={handleNavigate}
                        />
                    ))}
                </TableBody>
            </Table>
        </Box>
    );
};
```

### Lock Status Indicators

```typescript
// components/FileExplorer/LockStatusBadge.tsx
interface LockStatusBadgeProps {
    lock: Lock | null;
    currentUserId: string;
}

const LockStatusBadge: React.FC<LockStatusBadgeProps> = ({ lock, currentUserId }) => {
    if (!lock) {
        return <Chip label="Available" color="default" size="small" />;
    }

    const isOwnLock = lock.user_id === currentUserId;

    return (
        <Tooltip title={`Locked by ${lock.user_name} - ${lock.reason || 'No reason given'}`}>
            <Chip
                icon={isOwnLock ? <LockOpen /> : <Lock />}
                label={isOwnLock ? 'You' : lock.user_name}
                color={isOwnLock ? 'primary' : 'warning'}
                size="small"
            />
        </Tooltip>
    );
};
```

### Lock Acquisition Dialog

```typescript
const LockAcquisitionDialog: React.FC<{
    open: boolean;
    resourcePath: string;
    onClose: () => void;
    onConfirm: (recursive: boolean, reason: string) => void;
}> = ({ open, resourcePath, onClose, onConfirm }) => {
    const [recursive, setRecursive] = useState(false);
    const [reason, setReason] = useState('');

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>Acquire Lock</DialogTitle>
            <DialogContent>
                <Typography>
                    Lock: <strong>{resourcePath}</strong>
                </Typography>

                <FormControlLabel
                    control={<Checkbox checked={recursive} onChange={(e) => setRecursive(e.target.checked)} />}
                    label="Include all subfolders (recursive)"
                />

                <TextField
                    label="Reason (optional)"
                    fullWidth
                    multiline
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Working on scene lighting"
                />

                <Alert severity="info" sx={{ mt: 2 }}>
                    Locks expire after 24 hours of inactivity. Keep the app running to auto-renew.
                </Alert>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={() => onConfirm(recursive, reason)} variant="contained">
                    Acquire Lock
                </Button>
            </DialogActions>
        </Dialog>
    );
};
```

### Lock Conflict Resolution

```typescript
const LockConflictDialog: React.FC<{
    open: boolean;
    conflictingLock: Lock;
    onClose: () => void;
    onRequestRelease: () => void;
    onBreakLock: () => void; // Admin only
}> = ({ open, conflictingLock, onClose, onRequestRelease, onBreakLock }) => {
    return (
        <Dialog open={open}>
            <DialogTitle color="warning.main">Resource Locked</DialogTitle>
            <DialogContent>
                <Alert severity="warning">
                    This resource is locked by another user.
                </Alert>

                <Box sx={{ mt: 2 }}>
                    <Typography><strong>Locked by:</strong> {conflictingLock.user_name}</Typography>
                    <Typography><strong>Since:</strong> {formatDate(conflictingLock.acquired_at)}</Typography>
                    <Typography><strong>Reason:</strong> {conflictingLock.reason || 'Not specified'}</Typography>
                    <Typography><strong>Expires:</strong> {formatDate(conflictingLock.expires_at)}</Typography>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>OK</Button>
                <Button onClick={onRequestRelease} color="primary">
                    Request Release
                </Button>
                {/* Admin only - break lock forcefully */}
            </DialogActions>
        </Dialog>
    );
};
```

### User Activity Panel

```typescript
// Show who's currently working on what
const ActivityPanel: React.FC<{ lockManifest: LockManifest }> = ({ lockManifest }) => {
    const activeUsers = useMemo(() => {
        const users = new Map<string, { name: string; locks: Lock[] }>();
        for (const lock of Object.values(lockManifest.locks)) {
            if (!users.has(lock.user_id)) {
                users.set(lock.user_id, { name: lock.user_name, locks: [] });
            }
            users.get(lock.user_id)!.locks.push(lock);
        }
        return Array.from(users.values());
    }, [lockManifest]);

    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Active Users</Typography>
            <List>
                {activeUsers.map(user => (
                    <ListItem key={user.name}>
                        <ListItemAvatar>
                            <Avatar>{user.name[0]}</Avatar>
                        </ListItemAvatar>
                        <ListItemText
                            primary={user.name}
                            secondary={`${user.locks.length} locked item(s)`}
                        />
                    </ListItem>
                ))}
            </List>
        </Paper>
    );
};
```

---

## Lock Granularity Design

### Granularity Levels

```
Project Root (coarsest)
├── allow_global_sync lock (locks entire project)
│
├── Folder locks (medium)
│   ├── scenes/ (recursive=true locks all scenes)
│   ├── scenes/scene_001/ (just this scene)
│   └── resources/textures/ (just textures)
│
└── File locks (finest)
    ├── scenes/scene_001/main.blend
    └── resources/textures/hero_skin.png
```

### Lock Hierarchy Rules

1. **Parent beats child**: If `/scenes/` is recursively locked, cannot lock `/scenes/scene_001/`
2. **Existing child blocks parent**: If `/scenes/scene_001/` is locked, cannot recursively lock `/scenes/`
3. **Same user can extend**: User A can lock parent if they own all child locks
4. **No overlap from different users**: User B cannot lock anything within User A's recursive lock

---

## Handling Direct Filesystem Access

### The Trust Problem

Users can edit files directly via:
- OS file explorer
- Other applications (Blender, Photoshop, etc.)
- Command line

### Mitigation Strategies

#### 1. Filesystem Monitoring (Recommended)
```go
// Use fsnotify to watch for changes
func (ls *LockService) StartFilesystemMonitor(projectPath string) {
    watcher, _ := fsnotify.NewWatcher()
    watcher.Add(projectPath)

    for {
        select {
        case event := <-watcher.Events:
            if event.Op&fsnotify.Write != 0 {
                ls.handleFileModification(event.Name)
            }
        }
    }
}

func (ls *LockService) handleFileModification(filePath string) {
    lock, isLocked := ls.IsLocked(filePath)
    if isLocked && lock.UserID != ls.userIdentity.ID {
        // Show warning notification
        ls.showWarning(fmt.Sprintf(
            "Warning: %s is locked by %s. Your changes may be overwritten.",
            filePath, lock.UserName,
        ))
    }
}
```

#### 2. Pre-Sync Validation
```go
func (ss *SyncService) ValidateBeforeSync(folder string, action RcloneAction) error {
    if action == SYNC_PUSH {
        // Check if folder is locked by someone else
        if lock, locked := ss.lockService.IsLocked(folder); locked {
            if lock.UserID != ss.lockService.userIdentity.ID {
                return fmt.Errorf("cannot push: %s is locked by %s", folder, lock.UserName)
            }
        }
    }
    return nil
}
```

#### 3. Open in Explorer with Warning
```go
func (fs *FolderService) OpenFolderWithLockWarning(path string) error {
    lock, isLocked := fs.lockService.IsLocked(path)

    if isLocked && lock.UserID != fs.lockService.userIdentity.ID {
        // Show modal warning before opening
        // "This folder is locked by X. Edits may cause conflicts."
    }

    return fs.openInExplorer(path)
}
```

---

## Infrastructure Considerations

### File-Based (Phase 1)

**Requirements**:
- Existing rclone remote storage
- No additional infrastructure

**Limitations**:
- Eventual consistency (30-60s polling)
- Race conditions possible during simultaneous lock attempts
- No real-time notifications

### Server-Based (Phase 2)

**Recommended Stack**:
```
┌─────────────────────────────────────────────────┐
│  Lock Server                                     │
│  ├── Framework: Go (Fiber/Echo) or Node.js      │
│  ├── Database: PostgreSQL or SQLite             │
│  ├── Real-time: WebSocket (gorilla/websocket)   │
│  └── Auth: JWT or API keys                      │
├─────────────────────────────────────────────────┤
│  Deployment Options                              │
│  ├── Self-hosted (Docker)                       │
│  ├── Cloud (Fly.io, Railway, Render)            │
│  └── Serverless (Cloudflare Workers + D1)       │
└─────────────────────────────────────────────────┘
```

**Estimated Costs**:
- Fly.io: ~$5-10/month for small team
- Cloudflare Workers: Free tier covers most use cases
- Self-hosted: Existing server costs only

### Database Schema (Server-Based)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE locks (
    id UUID PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    resource_path VARCHAR(1024) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    recursive BOOLEAN DEFAULT FALSE,
    user_id UUID REFERENCES users(id),
    acquired_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    heartbeat_at TIMESTAMP DEFAULT NOW(),
    reason TEXT,
    UNIQUE(project_id, resource_path)
);

CREATE TABLE lock_events (
    id UUID PRIMARY KEY,
    lock_id UUID,
    event_type VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES users(id),
    resource_path VARCHAR(1024) NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_locks_project ON locks(project_id);
CREATE INDEX idx_locks_user ON locks(user_id);
CREATE INDEX idx_locks_expires ON locks(expires_at);
```

---

## Implementation Tasks

### Phase 1: Foundation
1. [ ] Design and implement `UserIdentity` (UUID generation, persistence)
2. [ ] Define `Lock` and `LockManifest` data models
3. [ ] Implement file-based lock storage (.locks/ directory)
4. [ ] Create `LockService` with basic acquire/release
5. [ ] Add lock manifest refresh/upload via rclone

### Phase 2: Lock Logic
1. [ ] Implement recursive lock handling
2. [ ] Implement lock conflict detection
3. [ ] Add lock expiration and cleanup
4. [ ] Implement heartbeat system
5. [ ] Add lock-aware sync validation

### Phase 3: UI - Lock Management
1. [ ] Create `LockStatusBadge` component
2. [ ] Create `LockAcquisitionDialog`
3. [ ] Create `LockConflictDialog`
4. [ ] Add lock status to folder tree items
5. [ ] Create `ActivityPanel` showing active users

### Phase 4: UI - File Explorer
1. [ ] Create basic `FileExplorer` component
2. [ ] Integrate lock status into file rows
3. [ ] Add lock/unlock toolbar actions
4. [ ] Implement "Open in Explorer" with warnings
5. [ ] Add filesystem change monitoring

### Phase 5: Polish & Safety
1. [ ] Add filesystem watcher for external changes
2. [ ] Implement lock request/notification system
3. [ ] Add audit trail UI
4. [ ] Stress test concurrent lock operations
5. [ ] Documentation and user guide

### Phase 6: Server-Based (Optional)
1. [ ] Design and implement lock server API
2. [ ] Add WebSocket real-time updates
3. [ ] Implement server-side lock database
4. [ ] Update client to support both file and server modes
5. [ ] Add authentication/authorization

---

## Testing Considerations

### Unit Tests
- Lock conflict detection (parent/child relationships)
- Lock expiration logic
- Heartbeat renewal
- Manifest merging

### Integration Tests
- Multi-client lock acquisition (simulated)
- Race condition handling
- Lock survival across app restarts
- Filesystem monitoring accuracy

### Manual Testing
- Two users attempting same lock
- Lock expiration behavior
- Network disconnection scenarios
- Large folder structures (performance)

---

## Open Questions

1. **Lock request notifications**: How do users communicate "please release your lock"?
   - In-app notification system?
   - Email integration?
   - Just rely on external communication?

2. **Admin/break lock capability**: Who can forcefully break someone else's lock?
   - Project owner?
   - Any user with confirmation?
   - Time-based (expired locks only)?

3. **Offline behavior**: What happens when a user goes offline with locks held?
   - Auto-expire after heartbeat timeout?
   - Show "stale lock" warning to others?

4. **Lock granularity default**: Should locking be opt-in or encouraged by default?
   - Require lock before push?
   - Recommend lock but allow push without?
