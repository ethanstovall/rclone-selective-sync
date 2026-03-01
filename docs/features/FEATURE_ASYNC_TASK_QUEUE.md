# Feature: Asynchronous Background Operations

## Summary

Replace the current blocking rclone workflow with an asynchronous model. When the user triggers a push, pull, or download, the operation runs in the background. Each folder within the operation completes independently and streams its results back to the UI in real time, but the operation is presented to the user as a single task containing tabbed per-folder output.

This also covers making change detection (sync status) reactive per-folder rather than batch.

This document consolidates and supersedes [IMPROVEMENT_BACKGROUND_SYNC.md](../improvements/IMPROVEMENT_BACKGROUND_SYNC.md).

---

## Current State

### Rclone Operations

**Backend:** `ExecuteRcloneAction` in [backend/syncservice.go](../../backend/syncservice.go) accepts `[]string` of target folders, spawns goroutines for all of them, but **blocks until every folder finishes** before returning the collected `[]RcloneActionOutput`.

**Frontend:** `handleRcloneAction` in [ProjectDashboard.tsx](../../frontend/src/components/SyncFolders/ProjectDashboard.tsx) calls `await ExecuteRcloneAction(targetFolders, action, dry)`, which locks the UI behind a loading dialog ([RcloneActionDialog.tsx](../../frontend/src/components/SyncFolders/RcloneActionDialog.tsx)) until the entire batch completes.

```
User selects 5 folders -> clicks "Push"
  -> Dry run starts (all 5 blocked behind LinearProgress)
  -> All 5 dry runs complete -> Preview dialog shown with 5 tabs
  -> User confirms -> Final run starts (all 5 blocked behind LinearProgress)
  -> All 5 complete -> Dialog closes, change detection runs (also blocking)
```

### Change Detection

**Backend:** `DetectChangedFolders` in [backend/syncservice.go](../../backend/syncservice.go) calls `ExecuteRcloneAction` with a dry-run push for all local folders. Again, blocks until all folders are checked.

**Frontend:** `detectChangedFolders` runs after local folders load, and after push/pull operations complete. The entire tree shows "Checking..." until every folder has been evaluated.

### Problems

1. **UI is completely locked** during both dry run and final execution
2. **Slowest folder dictates total wait time** - 4 fast folders wait on 1 slow one before any output is visible
3. **No incremental feedback** - Can't review fast folder results while slow ones are still running
4. **Change detection is all-or-nothing** - Every folder shows "Checking..." even after most have been evaluated
5. **No way to skip dry run** for routine operations the user is confident about
6. **Navigating away loses everything** - All state is local to ProjectDashboard

---

## Proposed Design

### Task Model

A **task** represents a user action: "Push 5 folders to remote" or "Pull 3 folders from remote". Within that task, each folder runs independently and reports back via Wails events. The task panel shows the task as one entry; clicking it opens a tabbed view where each tab loads as its folder completes.

```
┌─────────────────────────────────────────────────────┐
│ Task: Push to Remote (5 folders)                     │
│                                                      │
│ Tab: [FolderA ✓] [FolderB ✓] [FolderC ⟳] [D ⏳] [E ⏳] │
│ ┌──────────────────────────────────────────────────┐ │
│ │ FolderA dry-run output:                          │ │
│ │ 2025/01/15 ...  --dry-run                        │ │
│ │ Transferred: 3 files, 1.2MB                      │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│           [Approve All]  [Cancel Remaining]          │
└─────────────────────────────────────────────────────┘
```

**Key distinction:** The task is the batch. The folders are tabs within the task. Tabs load incrementally as each folder's operation completes.

### Event Flow

```
Frontend                              Backend
   |                                     |
   |-- ExecuteSingleFolderAction ------->|  (folder: "assets", push, dry)
   |-- ExecuteSingleFolderAction ------->|  (folder: "scenes", push, dry)
   |-- ExecuteSingleFolderAction ------->|  (folder: "audio", push, dry)
   |                                     |
   |   (all three run concurrently       |
   |    in separate goroutines)          |
   |                                     |
   |<-- task:folder-complete { ----------|  "assets" finishes first
   |      folder, action, dry, output }  |
   |                                     |
   |   UI: "assets" tab shows output     |
   |   Other tabs still show spinner     |
   |                                     |
   |<-- task:folder-complete { ----------|  "audio" finishes second
   |      folder, action, dry, output }  |
   |                                     |
   |<-- task:folder-complete { ----------|  "scenes" finishes last
   |      folder, action, dry, output }  |
   |                                     |
   |   All tabs loaded. User reviews.    |
   |   Clicks [Approve All].             |
   |                                     |
   |-- ExecuteSingleFolderAction ------->|  (folder: "assets", push, !dry)
   |-- ExecuteSingleFolderAction ------->|  (folder: "scenes", push, !dry)
   |-- ExecuteSingleFolderAction ------->|  (folder: "audio", push, !dry)
   |                                     |
   |<-- task:folder-complete events -----|  (same pattern, tabs update)
```

### Reactive Change Detection

The same per-folder event model applies to change detection. Instead of blocking until all folders are checked, each folder's sync status updates individually:

```
Frontend                              Backend
   |                                     |
   |-- DetectSingleFolderChange -------->|  (folder: "assets")
   |-- DetectSingleFolderChange -------->|  (folder: "scenes")
   |-- DetectSingleFolderChange -------->|  (folder: "audio")
   |                                     |
   |<-- change:detected { --------------|  "assets" -> changed
   |      folder: "assets" }            |
   |                                     |
   |   UI: "assets" shows orange dot     |
   |   "scenes" and "audio" still show   |
   |   "Checking..."                     |
   |                                     |
   |<-- change:not-detected { ----------|  "scenes" -> synced
   |      folder: "scenes" }            |
   |                                     |
   |   UI: "scenes" shows green check    |
   |                                     |
   |<-- change:detected { --------------|  "audio" -> changed
   |      folder: "audio" }             |
```

This means the folder tree updates reactively. The user sees each folder flip from "Checking..." to "Synced" or "Changed" individually as the backend evaluates them.

---

## Backend Changes

### New Endpoints

Add to [backend/syncservice.go](../../backend/syncservice.go):

```go
// ExecuteSingleFolderAction runs an rclone command for a single folder
// in a background goroutine and emits a completion event.
// Returns immediately.
func (ss *SyncService) ExecuteSingleFolderAction(
    targetFolder string,
    action RcloneAction,
    dry bool,
) error {
    go func() {
        output := ss.executeSingleFolder(targetFolder, action, dry)

        app := application.Get()
        app.EmitEvent("task:folder-complete", map[string]interface{}{
            "folder": targetFolder,
            "action": string(action),
            "dry":    dry,
            "output": output,
        })
    }()

    return nil
}

// DetectSingleFolderChange runs a dry-run push for a single folder
// and emits whether it has changes.
func (ss *SyncService) DetectSingleFolderChange(targetFolder string) {
    go func() {
        output := ss.executeSingleFolder(targetFolder, SYNC_PUSH, true)

        changed := strings.Contains(output.CommandOutput, "--dry-run")

        app := application.Get()
        app.EmitEvent("change:result", map[string]interface{}{
            "folder":  targetFolder,
            "changed": changed,
        })
    }()
}
```

### Extract Single-Folder Logic

The existing `ExecuteRcloneAction` loop body should be extracted into a reusable `executeSingleFolder` method:

```go
// executeSingleFolder runs an rclone command for one folder and returns the output.
// This is the core logic extracted from ExecuteRcloneAction's goroutine body.
func (ss *SyncService) executeSingleFolder(
    targetFolder string,
    action RcloneAction,
    dry bool,
) RcloneActionOutput {
    // (existing per-folder logic from ExecuteRcloneAction, lines 40-91)
    // Look up folder config, build paths, create command, execute, return output
}
```

The existing `ExecuteRcloneAction` and `DetectChangedFolders` can optionally be refactored to call `executeSingleFolder` internally, but they don't need to change externally.

---

## Frontend Changes

### TaskQueueContext

A new React context mounted at the **app root level** so tasks persist across page navigation.

```typescript
// frontend/src/hooks/TaskQueueContext.tsx

interface FolderResult {
    folder: string;
    status: "pending" | "running" | "completed" | "failed";
    output: RcloneActionOutput | null;
}

interface SyncTask {
    id: string;
    action: RcloneAction;
    dry: boolean;
    folders: FolderResult[];
    startedAt: number;
    completedAt: number | null;
}

interface TaskQueueContextType {
    tasks: SyncTask[];

    // Submit a batch - creates one task with N folder results
    submitTask: (folders: string[], action: RcloneAction, dry: boolean) => string;

    // Submit without dry run
    submitDirect: (folders: string[], action: RcloneAction) => string;

    // Approve a dry-run task (re-submit all folders as non-dry)
    approveTask: (taskId: string) => void;

    // Dismiss completed tasks
    dismissTask: (taskId: string) => void;
    dismissAll: () => void;

    // Counts for UI
    activeCount: number;
    pendingReviewCount: number;
}
```

**Key behavior:**
- `submitTask` creates a `SyncTask` with all folders set to `"running"` status
- Calls `ExecuteSingleFolderAction` for each folder
- Listens for `task:folder-complete` events and matches them to the correct task/folder
- When all folders in a task complete, the task itself is marked complete
- For dry runs, completed tasks show "Ready for review" and expose [Approve] / [Approve All]

### TaskPanel Component

Persistent, collapsible panel anchored to the bottom-right of the application. Lives in the root layout, outside the page router.

**Collapsed state:**
```
                                    ┌──────────────────┐
                                    │ Tasks (2 active)  │
                                    └──────────────────┘
```

**Expanded state:**
```
┌───────────────────────────────────────┐
│ [▼] Tasks                        [×] │
│───────────────────────────────────────│
│                                       │
│ Push to Remote (5 folders)    ⟳  3/5  │
│   [Click to view]                     │
│                                       │
│ Pull from Remote (2 folders)  ✓  Done │
│   [View Output]  [Dismiss]            │
│                                       │
│ Push to Remote (3 folders)   ⏳ Review│
│   [View Dry Run]  [Approve]           │
│                                       │
│              [Dismiss All Completed]  │
└───────────────────────────────────────┘
```

**Clicking a task** opens a dialog/popover with the tabbed output view (reusing the existing [RcloneActionOutputTabs](../../frontend/src/components/SyncFolders/RcloneActionOutputTabs.tsx) pattern):

```
┌────────────────────────────────────────────────────┐
│ Push to Remote - Dry Run Results                    │
│                                                     │
│ [FolderA ✓] [FolderB ✓] [FolderC ⟳] [FolderD ⏳]  │
│ ┌─────────────────────────────────────────────────┐ │
│ │ FolderA output:                                 │ │
│ │ 2025/01/15 ... --dry-run                        │ │
│ │ Transferred: 3 files, 1.2MB                     │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Tabs with ⟳ show a spinner. Tabs with ⏳ show       │
│ "Waiting..." Completed tabs show rclone output.     │
│                                                     │
│               [Cancel]  [Approve All]               │
└────────────────────────────────────────────────────┘
```

Tabs are clickable as soon as their folder completes. The user doesn't have to wait for all folders to finish before reviewing.

### Reactive Change Detection

Replace the current batch `detectChangedFolders` in ProjectDashboard with per-folder detection:

```typescript
// In ProjectDashboard or a new hook

const detectChangedFolders = (localFolders: string[]) => {
    // Mark all as "checking"
    setCheckingFolders(new Set(localFolders));

    // Dispatch per-folder detection
    localFolders.forEach((folder) => {
        SyncService.DetectSingleFolderChange(folder);
    });
};

// Listen for per-folder results
useEffect(() => {
    const unsubscribe = Events.On("change:result", (event) => {
        const { folder, changed } = event.data;

        // Remove from "checking" set
        setCheckingFolders((prev) => {
            const next = new Set(prev);
            next.delete(folder);
            return next;
        });

        // Update changed folders
        if (changed) {
            setChangedFolders((prev) => [...prev, folder]);
        }
    });

    return () => unsubscribe();
}, []);
```

The folder tree shows:
- "Checking..." with a spinner for folders still being evaluated
- "Synced" with green check as each folder passes
- "Changed" with orange dot as each folder is found to have changes

---

## User Flows

### Standard Flow (with dry run review)

```
1. User selects 5 folders, clicks "Push to Remote"
2. Dry-run task created, appears in TaskPanel as "Push (5 folders) - Running 0/5"
3. Folders complete independently:
   - FolderA finishes -> tab ready to view, counter: 1/5
   - FolderC finishes -> tab ready, counter: 2/5
   - User clicks the task to open it, reviews FolderA output
   - FolderB, D, E finish -> all tabs available, counter: 5/5
4. Task status changes to "Ready for review"
5. User clicks [Approve All] (or removes individual folders first)
6. Final runs submitted -> same incremental completion pattern
7. Task shows green check -> user dismisses
8. Change detection re-runs per-folder, tree updates reactively
```

### Direct Flow (skip dry run)

```
1. User selects folders, clicks "Push (Direct)" or similar
2. Final runs submitted immediately (no dry run phase)
3. TaskPanel shows progress, tabs load as folders complete
4. Task completes -> green check
```

### Reviewing While Running

```
1. User submits 10 folders for dry-run push
2. 3 fast folders complete quickly
3. User opens the task, reviews the 3 completed tabs
4. Meanwhile, 4 more folders complete in the background
5. Their tabs become available (tabs update live)
6. Last 3 folders finish
7. User approves all or selectively
```

---

## Implementation Plan

### Phase 1: Extract Single-Folder Backend Logic

**Files:** [backend/syncservice.go](../../backend/syncservice.go)

- [ ] Extract `executeSingleFolder` method from `ExecuteRcloneAction` loop body
- [ ] Add `ExecuteSingleFolderAction(folder, action, dry)` that runs in goroutine and emits `task:folder-complete` event
- [ ] Add `DetectSingleFolderChange(folder)` that runs in goroutine and emits `change:result` event
- [ ] Keep existing `ExecuteRcloneAction` and `DetectChangedFolders` intact for backward compatibility during transition

### Phase 2: TaskQueueContext

**Files:** New file `frontend/src/hooks/TaskQueueContext.tsx`

- [ ] Define `SyncTask` and `FolderResult` interfaces
- [ ] Implement context with `submitTask`, `submitDirect`, `approveTask`, `dismissTask`, `dismissAll`
- [ ] Subscribe to `task:folder-complete` events, match to correct task/folder
- [ ] Track computed `activeCount` and `pendingReviewCount`

### Phase 3: Mount at App Root

**Files:** [frontend/src/main.tsx](../../frontend/src/main.tsx)

- [ ] Wrap router with `TaskQueueProvider`
- [ ] Mount `TaskPanel` component in RootLayout (outside `<Outlet />`, fixed position)
- [ ] See also [FEATURE_PERSISTENT_PROJECT_STATE.md](FEATURE_PERSISTENT_PROJECT_STATE.md) for lifting other providers

### Phase 4: TaskPanel UI

**Files:** New files in `frontend/src/components/TaskPanel/`

- [ ] `TaskPanel.tsx` - Collapsible bottom-right panel with task list
- [ ] `TaskItem.tsx` - Single task entry with status, progress, and actions
- [ ] `TaskDetailDialog.tsx` - Tabbed output viewer (tabs load independently)
- [ ] Reuse/adapt `RcloneActionOutputTabs` for the tabbed view
- [ ] [View] opens detail dialog, [Approve] re-submits as non-dry, [Dismiss] clears

### Phase 5: Update ProjectDashboard

**Files:** [ProjectDashboard.tsx](../../frontend/src/components/SyncFolders/ProjectDashboard.tsx)

- [ ] Replace `handleRcloneAction` with `useTaskQueue().submitTask()`
- [ ] Remove blocking state: `isRunningRcloneAction`, `rcloneActionDialogOutput`, `isRcloneDialogOpen`
- [ ] Remove or deprecate `RcloneActionDialog` (output viewing moves to TaskPanel)
- [ ] Add "Direct" action option (skip dry run)
- [ ] Replace batch `detectChangedFolders` with per-folder event-based detection
- [ ] Update `FolderStatus` component to show per-folder checking state

### Phase 6: Polish

- [ ] Auto-expand TaskPanel when a dry-run task completes (needs review)
- [ ] Show elapsed time on running tasks
- [ ] Animate panel expand/collapse
- [ ] Keyboard shortcut to toggle TaskPanel
- [ ] Desktop notification on task completion (optional)
- [ ] Handle app closure warning if tasks are in progress

---

## Edge Cases

1. **Duplicate submissions**: If the user submits the same folder while it's already running in another task, either reject or allow but warn
2. **App closure**: Warn before closing if tasks are in progress (rclone processes are OS-level; closing the app won't gracefully stop them)
3. **Project switch**: Warn or complete active tasks before switching projects
4. **Folder config edited between dry run and approval**: Consider warning the user that config has changed since dry run
5. **Many concurrent folders**: Consider concurrency limits (e.g., max 5 rclone processes at once) to avoid overwhelming the system
6. **Event ordering**: Events may arrive in any order; match by folder name, not by arrival order
7. **Network failure mid-operation**: Surface the rclone error in the failed folder's tab; don't block other folders

---

## Relationship to Other Docs

- **[IMPROVEMENT_BACKGROUND_SYNC.md](../improvements/IMPROVEMENT_BACKGROUND_SYNC.md)** - Superseded by this document. Kept as a redirect.
- **[FEATURE_PERSISTENT_PROJECT_STATE.md](FEATURE_PERSISTENT_PROJECT_STATE.md)** - Complementary feature. Lifting context providers to the app root is needed for the TaskPanel and TaskQueueContext to persist across page navigation. Can be implemented simultaneously or as a prerequisite.
