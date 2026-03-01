# Feature: Asynchronous Task Queue

## Status: Implemented

## Summary

Replaced the blocking rclone workflow with an asynchronous event-driven model backed by a FIFO task queue. When the user triggers a push, pull, backup, or download, the operation is queued and executes in order. Each folder within the operation completes independently and streams its results back to the UI via Wails events. A persistent TaskPanel (bottom of the content area) tracks all operations across page navigation.

Tasks execute one at a time to prevent concurrent Rclone operations from conflicting and to ensure each task sees the true state of the remote.

This feature also incorporated [FEATURE_PERSISTENT_PROJECT_STATE.md](FEATURE_PERSISTENT_PROJECT_STATE.md) — context providers were lifted to the app root as a prerequisite.

---

## Architecture

### Backend

**Event-driven async methods** in [backend/syncservice.go](../../backend/syncservice.go):

- `executeSingleFolder(targetFolder, action, dry)` — extracted core per-folder logic (private)
- `ExecuteRcloneActionAsync(taskID, targetFolders, action, dry)` — spawns goroutines per folder, emits `task-folder-complete` events, then `task-complete`
- `ExecuteFullBackupAsync(taskID, dry)` — async backup with same event pattern
- `DetectChangedFoldersAsync(taskID, localFolders)` — per-folder change detection, emits `detect-folder-complete` events, then `detect-complete`

Original blocking methods (`ExecuteRcloneAction`, `ExecuteFullBackup`, `DetectChangedFolders`) are retained.

**Typed events** defined in [backend/events.go](../../backend/events.go):

| Event | Payload Struct | When |
|-------|---------------|------|
| `task-folder-complete` | `TaskFolderCompletePayload` | Each folder's rclone command finishes |
| `task-complete` | `TaskCompletePayload` | All folders in a task are done |
| `detect-folder-complete` | `DetectFolderCompletePayload` | Each folder's change detection finishes |
| `detect-complete` | `DetectCompletePayload` | All change detection done |
| `sync-status` | `SyncStatusPayload` | Config sync status warnings |

### Frontend

**TaskQueueContext** ([frontend/src/hooks/TaskQueueContext.tsx](../../frontend/src/hooks/TaskQueueContext.tsx)):

- Mounted at app root in `App.tsx`, persists across page navigation
- Subscribes to all 4 task events via `Events.On(...)`
- Tracks tasks in `Record<string, Task>` state
- Task IDs generated via `crypto.randomUUID()` in the browser, passed to backend
- **FIFO queue**: Tasks are created with `"pending"` status. A `useEffect`-driven queue processor launches the oldest pending task when no task is active (running or awaiting approval). `detect-changes` tasks are exempt and run immediately.
- **Error detection**: Final status is determined in the `task-folder-complete` handler when all folders have reported, avoiding race conditions with Wails event delivery order. The `task-complete` handler acts as a fallback.
- **Auto-dismiss**: An interval checks `completedAt` timestamps every 3 seconds; completed tasks older than 30 seconds are removed (unless the user has them paused by viewing their output).
- Queue is cleared on project switch to prevent cross-project errors.

**Task lifecycle:**
```
pending → running → completed (auto-dismiss after 30s)
                  → error (persists until manually dismissed)
                  → awaiting_approval (dry-run) → running (final) → completed/error
```

**Context API:**
- `startRcloneAction(folders, action, dry)` — creates pending task, queue launches it when ready
- `startBackup(dry)` — creates pending backup task
- `startDetectChanges(folders)` — runs immediately (exempt from queue)
- `approveTask(taskId)` — transitions dry-run from awaiting_approval to final execution
- `dismissTask(taskId)` / `clearCompletedTasks()`
- `pauseAutoDismiss(taskId)` / `resumeAutoDismiss(taskId)`
- `detectedChangedFolders: string[]` / `checkedFolders: string[]` / `isDetectingChanges: boolean`

**TaskPanel** ([frontend/src/components/TaskQueue/](../../frontend/src/components/TaskQueue/)):

- `TaskPanel.tsx` — fixed bottom panel centered within the content area, toggled with spacebar
  - Badge shows active task count; error chip appears when tasks have errors
  - "Dismiss Completed" button always visible, disabled when no completed tasks
- `TaskPanelItem.tsx` — single task row with inline expandable output
  - Status chip with icon (Queued/Running/Preview/Review/Done/Error)
  - Per-folder output tabs with scrollable tab bar and mouse wheel navigation
  - Folder name preview as secondary text
  - Expand arrow hidden for queued and completed tasks
  - "Approve & Run" button for dry-run tasks awaiting approval
  - Progress bar colored by phase (secondary for preview, primary for final run)

**SplitActionButton** ([frontend/src/components/common/SplitActionButton.tsx](../../frontend/src/components/common/SplitActionButton.tsx)):

- MUI ButtonGroup + Popper dropdown pattern
- Left-click = default action (dry-run preview)
- Dropdown arrow = "Run Directly (skip preview)"
- Used for Push, Pull, and Backup buttons

### Provider Stack (App.tsx)

```
<ReactRouterAppProvider>
  <CssBaseline />
  <GlobalConfigContextProvider>
    <ProjectConfigContextProvider>
      <TaskQueueContextProvider>
        <Outlet />
      </TaskQueueContextProvider>
    </ProjectConfigContextProvider>
  </GlobalConfigContextProvider>
</ReactRouterAppProvider>
```

---

## User Flows

### Standard Flow (with dry run review)

1. User selects folders, clicks Push/Pull icon (left-click)
2. Task appears in TaskPanel as "Push 5 folders" with preview status
3. Folders complete independently; output tabs load incrementally inline
4. Task transitions to "Review" status; user expands task to review output
5. User clicks "Approve & Run" to submit final run (reuses same task)
6. Task completes, auto-dismisses after 30 seconds

### Direct Flow (skip dry run)

1. User selects folders, clicks dropdown arrow on Push/Pull, selects "Run Directly"
2. Final run queued immediately (no preview phase)
3. TaskPanel shows progress, auto-dismisses on success

### Queued Operations

1. User pushes folders, then immediately starts a backup
2. Push runs first; backup shows "Queued" status
3. Push completes (or is approved after preview) → backup starts automatically
4. Each task sees the true state of the remote

### Backup

1. User clicks Backup split button (left-click = preview, dropdown = direct)
2. Task appears with project-specific label (e.g., "MyProject - Backup")
3. Same completion and auto-dismiss behavior

---

## Files

### Created
| File | Purpose |
|------|---------|
| `backend/events.go` | Typed event definitions and `emitEvent` helper |
| `frontend/src/hooks/TaskQueueContext.tsx` | Core task state machine, FIFO queue, event subscriptions |
| `frontend/src/components/TaskQueue/TaskPanel.tsx` | Persistent bottom panel with spacebar toggle |
| `frontend/src/components/TaskQueue/TaskPanelItem.tsx` | Task row with inline expandable output and folder tabs |
| `frontend/src/components/common/SplitActionButton.tsx` | Split button with dry-run / direct options |

### Modified
| File | Change |
|------|--------|
| `backend/syncservice.go` | Extracted `executeSingleFolder`, added 3 async methods |
| `backend/configservice.go` | Refactored to use typed events |
| `frontend/src/App.tsx` | Lifted providers to root, added TaskQueueContextProvider |
| `frontend/src/pages/SyncFolders.tsx` | Removed provider wrappers |
| `frontend/src/pages/ManageRemotes.tsx` | Removed provider wrapper |
| `frontend/src/pages/RootLayout.tsx` | Added TaskPanel |
| `frontend/src/components/SyncFolders/ProjectDashboard.tsx` | Rewired to task queue, split buttons |
| `frontend/src/components/SyncFolders/ProjectSelectorControlBar.tsx` | Rewired backup to task queue, split button |

### Removed
| File | Reason |
|------|--------|
| `frontend/src/components/SyncFolders/RcloneActionDialog.tsx` | Replaced by inline TaskPanelItem output |
| `frontend/src/components/TaskQueue/TaskDetailDialog.tsx` | Replaced by inline expandable output in TaskPanelItem |
