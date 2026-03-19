# Feature: Embedded Rclone via librclone

## Status: Implemented

## Embedded Version: rclone v1.73.2

## Summary

Replaced the `exec.Command("rclone", ...)` approach with rclone's official Go library (`librclone`). Rclone is now compiled directly into the application binary — no separate rclone installation required. The version is pinned in `go.mod` and tracked in `backend/version.go`.

### What Changed

- **No more rclone install requirement**: Users download the app and it just works.
- **Version pinned**: Rclone v1.73.2, locked in `go.mod`. Won't change without an explicit upgrade.
- **Structured diff output**: Dry-run previews now use `operations/list` to compare file listings on both sides, returning structured JSON (additions, updates, deletions) instead of parsing CLI text output.
- **Frontend diff renderer**: New `DiffOutput.tsx` component renders structured diffs with color-coded filenames grouped by folder.

---

## Architecture

### librclone Integration

The app imports rclone as a Go library and calls operations via its in-process JSON RPC API:

```go
import "github.com/rclone/rclone/librclone/librclone"

librclone.Initialize()                          // Called in main.go at startup
output, status := librclone.RPC(method, input)  // JSON in, JSON out
librclone.Finalize()                            // Called on shutdown via defer
```

Backend and command packages are registered via blank imports:

```go
_ "github.com/rclone/rclone/backend/all" // all storage backends (B2, S3, etc.)
_ "github.com/rclone/rclone/cmd/all"     // all RC operations (sync, copy, etc.)
```

### RC API Mapping

| Previous (exec) | Current (RPC) | Notes |
|-----------------|---------------|-------|
| `rclone sync local remote` | `sync/sync` | `{"srcFs": "...", "dstFs": "..."}` |
| `rclone copy remote local` | `sync/copy` | Same params |
| `rclone config file` | `config/paths` | Returns structured JSON with config path |
| `rclone copyto src dst` | `operations/copyfile` | For single file operations (sync.json) |
| `rclone lsjson remote` | `operations/list` | Returns native JSON — no stdout parsing |
| `--dry-run` flag | `operations/list` comparison | File-listing diff instead of CLI log capture |

### Dry-Run Preview Approach

The RC API's `sync/sync` with `dryRun: true` does not return human-readable output (it returns `{}`). Instead of capturing rclone's internal logs (which proved unreliable), dry-run previews now:

1. Call `operations/list` on both source and destination (with `recurse: true`)
2. Compare file metadata (path, size, modification time) to compute a diff
3. Return structured JSON with `additions`, `updates`, and `deletions` arrays
4. The frontend renders these as a color-coded folder-grouped diff view

This is more reliable and produces better output than the CLI approach — structured data with file sizes and change types instead of raw log text.

### Change Detection

`DetectChangedFolders` / `DetectChangedFoldersAsync` now use `RcloneHasChanges()` which performs the same file-listing comparison and returns a boolean. No more string-matching against `"--dry-run"` in CLI output.

---

## Frontend: Diff Output

New component `DiffOutput.tsx` renders structured diff results:

- **Grouped by folder**: Files under the same directory are grouped together with a folder header
- **Sorted**: Folders alphabetically, files by operation type (adds → updates → deletes) then alphabetically
- **Color-coded filenames**: Green for additions, amber for updates, red for deletions
- **Size labels**: In matching operation color at reduced opacity
- **Left border**: Subtle vertical line per folder group for visual containment
- **Summary bar**: Chips showing `+N`, `~N`, `-N` counts with total transfer size highlighted

### Future Improvement: Nested Folder Tree

The current display groups files by immediate parent directory. For deeply nested projects with many subdirectories, a collapsible nested folder tree view could provide better navigation — expanding/collapsing directories to drill into specific areas of change. This would be a frontend-only change since the backend already returns full file paths.

---

## Version Tracking

The embedded rclone version is tracked in three places:

1. **`go.mod`**: `github.com/rclone/rclone v1.73.2` — the authoritative source, pinned by Go module system
2. **`backend/version.go`**: `const RcloneVersion = "v1.73.2"` — exposed to frontend via `GetRcloneVersion()`
3. **`README.md`**: Displayed at the top for visibility

When upgrading rclone, update both `go.mod` (via `go get github.com/rclone/rclone@vX.Y.Z`) and the `RcloneVersion` const.

---

## Files

### Created
| File | Purpose |
|------|---------|
| `backend/rclone_rpc.go` | RPC wrapper: sync, copy, copyfile, list, config paths, mod time, diff |
| `frontend/src/components/TaskQueue/DiffOutput.tsx` | Structured diff renderer with folder grouping and color coding |

### Modified
| File | Change |
|------|--------|
| `go.mod` / `go.sum` | Added `github.com/rclone/rclone v1.73.2` + transitive dependencies |
| `main.go` | Added `InitRclone()` / `defer FinalizeRclone()` |
| `backend/version.go` | Added `RcloneVersion` const and `GetRcloneVersion()` |
| `backend/syncservice.go` | Replaced `NewRcloneCommand`/`Exec` with `RcloneSync`/`RcloneCopy`/`RcloneHasChanges` |
| `backend/configservice.go` | Replaced exec calls with `RcloneGetConfigPath`, `RcloneCopyFile`, `RcloneGetRemoteFileModTime` |
| `backend/configmanager.go` | Replaced `rclone copyto` exec with `RcloneCopyFile` for sync.json upload |
| `backend/exec_windows.go` | Removed `createCommand` (kept `createVisibleCommand` for file explorer) |
| `backend/exec_other.go` | Same — removed `createCommand`, kept `createVisibleCommand` |
| `frontend/src/components/TaskQueue/TaskPanelItem.tsx` | Renders `DiffOutput` for structured diff results, plain text for errors |
| `frontend/public/style.css` | Added `.selectable` class to override global `user-select: none` |
| `README.md` | Added embedded rclone version at top |

### Removed
| File | Reason |
|------|--------|
| `backend/rclonecommand.go` | Replaced entirely by `rclone_rpc.go` |
