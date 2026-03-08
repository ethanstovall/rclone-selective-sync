# Feature: Bidirectional Sync (Bisync)

## Status: Proposed

## Summary

Add per-folder bidirectional sync (`rclone bisync`) as a sync action alongside the existing push and pull. Bisync merges changes from both local and remote in a single operation, upgrading the collaboration model from **one person per folder** to **one person per file**.

### Problem

The current push/pull model assumes only one person works in a given folder at a time. If two people work in the same folder on different files:

- Person A pushes — their changes go to the remote.
- Person B can't push without overwriting A's new files (push = local overwrites remote).
- Person B can't pull without overwriting their own work (pull = remote overwrites local).
- The only safe path is: B pulls first (losing nothing if they haven't modified A's files), then pushes. But this requires B to *know* that A pushed, and to carefully sequence operations.

### Solution

Bisync resolves both directions in one operation per folder:

- New/modified files on local → copied to remote
- New/modified files on remote → copied to local
- Deleted files on either side → deletion propagated to the other side

Two people editing different files in the same folder "just works" without coordination.

---

## Design

### Sync Action Hierarchy

Bisync becomes the **default** (primary) sync action. Push and pull move to secondary options:

| Button | Action | Use Case |
|--------|--------|----------|
| Left-click | **Bisync** (preview) | Day-to-day sync — merge both directions |
| Dropdown | Push (preview) | Force local → remote (one-way overwrite) |
| Dropdown | Pull (preview) | Force remote → local (one-way overwrite) |
| Dropdown | Bisync directly | Skip preview |
| Dropdown | Push directly | Skip preview |
| Dropdown | Pull directly | Skip preview |

### Backend Changes

Add a new sync action in `syncservice.go`:

```go
// New action type
const ActionBisync = "bisync"

// Per-folder bisync execution
func (s *SyncService) executeBisyncFolder(targetFolder string, dry bool) (string, string) {
    // rclone bisync local:path remote:path --dry-run
    // First-time sync requires --resync flag
}
```

Key considerations:

- **First-run detection**: Bisync requires `--resync` on the first run for each folder pair to establish a baseline. The app should detect this (check for bisync state files or catch the "must resync" error) and handle it automatically or prompt the user.
- **Conflict handling**: Configure `--conflict-resolve newer` as default. Optionally expose conflict resolution strategy in settings (newer, older, larger, path1, path2).
- **State files**: Bisync stores `.rclone-bisync/` metadata. These should live alongside rclone's config, not in the project folder.

### Frontend Changes

- Add `"bisync"` to the `RcloneAction` type
- Update `SplitActionButton` to make bisync the default left-click action
- Move push/pull to dropdown options
- Preview output for bisync should clearly distinguish uploads vs. downloads (parse rclone bisync dry-run output)
- Task labels: "Bisync 3 folders", "Push 3 folders", "Pull 3 folders"

### Task Queue Integration

Bisync tasks use the same FIFO queue as push/pull. No special handling needed — they're just another action type that goes through the pending → running → preview → approve → final flow.

---

## Edge Cases

### First-time bisync for a folder
Rclone bisync fails if no prior sync state exists. Options:
1. **Auto-resync**: Detect the error and automatically retry with `--resync`. Show a notice to the user.
2. **Prompt**: Ask the user to confirm the initial resync, explaining it establishes a baseline.
3. **Track state**: Store in `sync.json` whether a folder has been bisynced before.

Option 1 is simplest. Option 3 is most robust.

### File conflicts (same file edited on both sides)
- Default: keep newer version, rename older as `.conflict` copy
- Preview should flag conflicts prominently so the user can review before approving
- Consider adding a conflicts section to the task output (separate from normal sync output)

### Deletion propagation
- If person A deletes a file locally and bisyncs, it gets deleted from remote
- This is intentional behavior but could surprise users coming from the current "push never deletes remote" mental model
- Preview gate mitigates this — user sees the deletion before it happens
- Consider a setting to disable deletion propagation (`--no-cleanup` or filter rules)

### Folder not yet downloaded locally
- If a folder exists only on remote (user hasn't pulled it yet), bisync would see an empty local side
- With `--resync`, this would work as an initial pull
- Without prior state, could be dangerous — might delete remote files
- Should fall back to pull for folders with no local content

---

## Migration Path

- Push/pull remain fully functional — no breaking changes
- Bisync is additive: new action type, new button position
- Users who prefer explicit push/pull can still use them from the dropdown
- No changes to `sync.json` schema required (bisync state is managed by rclone itself)

---

## Files to Create/Modify

### Modified
| File | Change |
|------|--------|
| `backend/syncservice.go` | Add `executeBisyncFolder`, handle `ActionBisync` in async methods |
| `frontend/src/hooks/TaskQueueContext.tsx` | Add `"bisync"` to `RcloneAction` type |
| `frontend/src/components/common/SplitActionButton.tsx` | Restructure: bisync as default, push/pull as dropdown |
| `frontend/src/components/SyncFolders/ProjectDashboard.tsx` | Wire up bisync action |

### No new files needed
Bisync uses the existing task queue, event system, and UI components.
