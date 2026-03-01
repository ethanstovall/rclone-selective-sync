# Feature: Asynchronous Background Operations

## Status: Implemented

## Summary

Replaced the blocking rclone workflow with an asynchronous event-driven model. When the user triggers a push, pull, backup, or download, the operation runs in the background. Each folder within the operation completes independently and streams its results back to the UI via Wails events. A persistent TaskPanel (bottom-right corner) tracks all operations across page navigation.

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
- Auto-dismiss: successful tasks fade after 30 seconds; error tasks persist until manually dismissed
- Pause/resume auto-dismiss when user opens task detail dialog

**Context API:**
- `startRcloneAction(folders, action, dry)` — creates task, calls `ExecuteRcloneActionAsync`
- `startBackup(dry)` — creates backup task, calls `ExecuteFullBackupAsync`
- `startDetectChanges(folders)` — creates detect task, calls `DetectChangedFoldersAsync`
- `dismissTask(taskId)` / `clearCompletedTasks()`
- `pauseAutoDismiss(taskId)` / `resumeAutoDismiss(taskId)`
- `detectedChangedFolders: string[]` / `isDetectingChanges: boolean`

**TaskPanel** ([frontend/src/components/TaskQueue/](../../frontend/src/components/TaskQueue/)):

- `TaskPanel.tsx` — fixed bottom-right collapsible panel, shows running/completed tasks
- `TaskPanelItem.tsx` — single task row with label, status chip, progress, dismiss button
- `TaskDetailDialog.tsx` — tabbed output dialog; completed tabs show output, pending tabs show spinner

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
2. Task appears in TaskPanel as "Push 5 folders (preview) — Running"
3. Folders complete independently; tabs load incrementally in TaskDetailDialog
4. User clicks task to review output, clicks "Approve & Run" to submit final run
5. New task created for the final execution
6. Task completes, auto-dismisses after 30 seconds

### Direct Flow (skip dry run)

1. User selects folders, clicks dropdown arrow on Push/Pull, selects "Run Directly"
2. Final runs submitted immediately (no preview phase)
3. TaskPanel shows progress, auto-dismisses on success

### Backup

1. User clicks Backup split button (left-click = preview, dropdown = direct)
2. Task appears with "Full Backup" or "Full Backup (preview)" label
3. Same completion and auto-dismiss behavior

---

## Files

### Created
| File | Purpose |
|------|---------|
| `backend/events.go` | Typed event definitions and `emitEvent` helper |
| `frontend/src/hooks/TaskQueueContext.tsx` | Core task state machine, event subscriptions |
| `frontend/src/components/TaskQueue/TaskPanel.tsx` | Persistent bottom-right panel |
| `frontend/src/components/TaskQueue/TaskPanelItem.tsx` | Single task row |
| `frontend/src/components/TaskQueue/TaskDetailDialog.tsx` | Tabbed output dialog |
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
| `frontend/src/components/SyncFolders/RcloneActionDialog.tsx` | Replaced by TaskDetailDialog |
