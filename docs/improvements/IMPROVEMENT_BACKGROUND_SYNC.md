# Improvement: Background Rclone Sync Execution

## Summary

Execute rclone sync commands in the background instead of blocking the UI with a loading dialog. This allows users to continue working in the application while long-running sync operations complete, with progress tracking and notifications.

---

## Current State

### Problem

Currently, when users execute rclone operations (push/pull/download), the workflow is:

1. User selects folders and clicks action button
2. Dry-run executes → Shows preview dialog (blocking)
3. User confirms → Final sync executes (blocking with loading spinner)
4. Dialog remains open until operation completes
5. User cannot interact with the rest of the application during sync

**Issues:**
- UI is completely blocked during long sync operations
- No way to cancel or monitor progress mid-operation
- Cannot queue multiple operations
- Poor UX for large file transfers that take minutes/hours
- No visibility into what rclone is currently doing

---

## Solution: Background Task Queue

Implement a background task system that executes rclone commands asynchronously while keeping the UI responsive.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (React)                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ TaskQueue Context (State Management)             │   │
│  │  - Active tasks list                             │   │
│  │  - Task status updates                           │   │
│  │  - Progress tracking                             │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ TaskMonitor Component (Bottom Bar)               │   │
│  │  [📊 2 tasks running] [▼]                        │   │
│  │  └─ Expandable panel with task details           │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                        ↕ WebSocket / Events
┌─────────────────────────────────────────────────────────┐
│ Backend (Go)                                             │
│  ┌──────────────────────────────────────────────────┐   │
│  │ TaskService                                      │   │
│  │  - Task queue management                         │   │
│  │  - Execute rclone in goroutines                  │   │
│  │  - Stream progress updates                       │   │
│  │  - Handle cancellation                           │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation

### Backend: TaskService

Create a new service to manage background tasks:

```go
// backend/taskservice.go
package backend

import (
    "context"
    "fmt"
    "sync"
    "time"

    "github.com/wailsapp/wails/v3/pkg/application"
)

// TaskStatus represents the state of a task
type TaskStatus string

const (
    TaskStatusPending   TaskStatus = "pending"
    TaskStatusRunning   TaskStatus = "running"
    TaskStatusCompleted TaskStatus = "completed"
    TaskStatusFailed    TaskStatus = "failed"
    TaskStatusCancelled TaskStatus = "cancelled"
)

// Task represents a background operation
type Task struct {
    ID          string     `json:"id"`
    Type        string     `json:"type"`        // "sync_push", "sync_pull", "copy_pull"
    Folders     []string   `json:"folders"`     // Target folders
    Status      TaskStatus `json:"status"`
    Progress    int        `json:"progress"`    // 0-100
    Output      string     `json:"output"`      // Stdout/stderr
    Error       string     `json:"error"`       // Error message if failed
    StartTime   time.Time  `json:"start_time"`
    EndTime     *time.Time `json:"end_time"`
    Cancellable bool       `json:"cancellable"` // Can this task be cancelled?

    cancel context.CancelFunc // Internal cancellation function
}

// TaskService manages background tasks
type TaskService struct {
    app           *application.App
    configManager *ConfigManager
    syncService   *SyncService

    mu    sync.RWMutex
    tasks map[string]*Task
}

func NewTaskService(app *application.App, configManager *ConfigManager, syncService *SyncService) *TaskService {
    return &TaskService{
        app:           app,
        configManager: configManager,
        syncService:   syncService,
        tasks:         make(map[string]*Task),
    }
}

// SubmitSyncTask queues a new sync task
func (ts *TaskService) SubmitSyncTask(folders []string, action RcloneAction) (string, error) {
    taskID := fmt.Sprintf("task-%d", time.Now().UnixNano())

    ctx, cancel := context.WithCancel(context.Background())

    task := &Task{
        ID:          taskID,
        Type:        string(action),
        Folders:     folders,
        Status:      TaskStatusPending,
        Progress:    0,
        StartTime:   time.Now(),
        Cancellable: true,
        cancel:      cancel,
    }

    ts.mu.Lock()
    ts.tasks[taskID] = task
    ts.mu.Unlock()

    // Start task in background
    go ts.executeTask(ctx, task, action)

    return taskID, nil
}

// executeTask runs the rclone operation in the background
func (ts *TaskService) executeTask(ctx context.Context, task *Task, action RcloneAction) {
    ts.updateTaskStatus(task.ID, TaskStatusRunning, 10, "", "")

    // Execute rclone command (non-dry-run)
    outputs := ts.syncService.ExecuteRcloneAction(task.Folders, action, false)

    // Check for cancellation
    select {
    case <-ctx.Done():
        ts.updateTaskStatus(task.ID, TaskStatusCancelled, 0, "", "Task cancelled by user")
        return
    default:
    }

    // Check for errors
    hasError := false
    var errorMsg string
    var outputMsg string

    for _, output := range outputs {
        outputMsg += output.CommandOutput + "\n"
        if output.CommandError != "" {
            hasError = true
            errorMsg += output.CommandError + "\n"
        }
    }

    if hasError {
        ts.updateTaskStatus(task.ID, TaskStatusFailed, 100, outputMsg, errorMsg)
    } else {
        ts.updateTaskStatus(task.ID, TaskStatusCompleted, 100, outputMsg, "")
    }
}

// updateTaskStatus updates task state and emits event to frontend
func (ts *TaskService) updateTaskStatus(taskID string, status TaskStatus, progress int, output, errorMsg string) {
    ts.mu.Lock()
    defer ts.mu.Unlock()

    task, exists := ts.tasks[taskID]
    if !exists {
        return
    }

    task.Status = status
    task.Progress = progress
    task.Output = output
    task.Error = errorMsg

    if status == TaskStatusCompleted || status == TaskStatusFailed || status == TaskStatusCancelled {
        now := time.Now()
        task.EndTime = &now
    }

    // Emit event to frontend
    ts.app.EmitEvent("task:update", task)
}

// GetAllTasks returns all tasks
func (ts *TaskService) GetAllTasks() []Task {
    ts.mu.RLock()
    defer ts.mu.RUnlock()

    tasks := make([]Task, 0, len(ts.tasks))
    for _, task := range ts.tasks {
        // Don't send cancel function to frontend
        taskCopy := *task
        taskCopy.cancel = nil
        tasks = append(tasks, taskCopy)
    }

    return tasks
}

// CancelTask cancels a running task
func (ts *TaskService) CancelTask(taskID string) error {
    ts.mu.Lock()
    defer ts.mu.Unlock()

    task, exists := ts.tasks[taskID]
    if !exists {
        return fmt.Errorf("task not found: %s", taskID)
    }

    if !task.Cancellable {
        return fmt.Errorf("task cannot be cancelled")
    }

    if task.Status != TaskStatusRunning && task.Status != TaskStatusPending {
        return fmt.Errorf("task is not running")
    }

    // Trigger cancellation
    if task.cancel != nil {
        task.cancel()
    }

    return nil
}

// ClearCompletedTasks removes completed/failed/cancelled tasks from memory
func (ts *TaskService) ClearCompletedTasks() {
    ts.mu.Lock()
    defer ts.mu.Unlock()

    for id, task := range ts.tasks {
        if task.Status == TaskStatusCompleted ||
           task.Status == TaskStatusFailed ||
           task.Status == TaskStatusCancelled {
            delete(ts.tasks, id)
        }
    }

    ts.app.EmitEvent("tasks:cleared", nil)
}
```

### Update SyncService

Modify `syncService.go` to support context cancellation:

```go
// Add context parameter to ExecuteRcloneAction
func (ss *SyncService) ExecuteRcloneActionWithContext(
    ctx context.Context,
    targetFolders []string,
    action RcloneAction,
    dry bool,
) []RcloneActionOutput {
    // ... existing logic ...

    // Before executing command, check for cancellation
    select {
    case <-ctx.Done():
        return []RcloneActionOutput{{
            TargetFolder:  "all",
            CommandError:  "operation cancelled",
        }}
    default:
    }

    // Execute command with context support
    cmd := exec.CommandContext(ctx, "rclone", args...)
    // ... rest of execution logic ...
}
```

---

## Frontend Implementation

### TaskQueue Context

```typescript
// frontend/src/hooks/TaskQueueContext.tsx

import React, { createContext, useContext, useEffect, useState } from "react";
import { Events } from "@wailsio/runtime";
import { TaskService } from "../../../bindings/...";

interface Task {
    id: string;
    type: string;
    folders: string[];
    status: "pending" | "running" | "completed" | "failed" | "cancelled";
    progress: number;
    output: string;
    error: string;
    start_time: string;
    end_time?: string;
    cancellable: boolean;
}

interface TaskQueueContextType {
    tasks: Task[];
    submitSyncTask: (folders: string[], action: string) => Promise<string>;
    cancelTask: (taskId: string) => Promise<void>;
    clearCompleted: () => Promise<void>;
}

const TaskQueueContext = createContext<TaskQueueContextType | undefined>(undefined);

export const TaskQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [tasks, setTasks] = useState<Task[]>([]);

    useEffect(() => {
        // Listen for task updates
        const unsubscribe = Events.On("task:update", (task: Task) => {
            setTasks((prev) => {
                const index = prev.findIndex((t) => t.id === task.id);
                if (index >= 0) {
                    const newTasks = [...prev];
                    newTasks[index] = task;
                    return newTasks;
                } else {
                    return [...prev, task];
                }
            });
        });

        // Load existing tasks on mount
        TaskService.GetAllTasks().then(setTasks);

        return () => unsubscribe();
    }, []);

    const submitSyncTask = async (folders: string[], action: string) => {
        return await TaskService.SubmitSyncTask(folders, action);
    };

    const cancelTask = async (taskId: string) => {
        await TaskService.CancelTask(taskId);
    };

    const clearCompleted = async () => {
        await TaskService.ClearCompletedTasks();
        setTasks((prev) => prev.filter((t) =>
            t.status === "pending" || t.status === "running"
        ));
    };

    return (
        <TaskQueueContext.Provider value={{ tasks, submitSyncTask, cancelTask, clearCompleted }}>
            {children}
        </TaskQueueContext.Provider>
    );
};

export const useTaskQueue = () => {
    const context = useContext(TaskQueueContext);
    if (!context) {
        throw new Error("useTaskQueue must be used within TaskQueueProvider");
    }
    return context;
};
```

### TaskMonitor Component

```typescript
// frontend/src/components/TaskMonitor/TaskMonitor.tsx

import React, { useState } from "react";
import { Box, Paper, IconButton, Collapse, List, ListItem, Typography, LinearProgress, Chip } from "@mui/material";
import { ExpandMore, ExpandLess, Close, Cancel } from "@mui/icons-material";
import { useTaskQueue } from "../../hooks/TaskQueueContext";

const TaskMonitor: React.FC = () => {
    const { tasks, cancelTask, clearCompleted } = useTaskQueue();
    const [expanded, setExpanded] = useState(false);

    const activeTasks = tasks.filter((t) => t.status === "pending" || t.status === "running");
    const completedTasks = tasks.filter((t) =>
        t.status === "completed" || t.status === "failed" || t.status === "cancelled"
    );

    if (tasks.length === 0) return null;

    return (
        <Paper
            sx={{
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 1300,
            }}
        >
            {/* Header Bar */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 1,
                    cursor: "pointer",
                }}
                onClick={() => setExpanded(!expanded)}
            >
                <Typography variant="body2">
                    {activeTasks.length > 0
                        ? `${activeTasks.length} task(s) running`
                        : `${completedTasks.length} task(s) completed`}
                </Typography>
                <IconButton size="small">
                    {expanded ? <ExpandMore /> : <ExpandLess />}
                </IconButton>
            </Box>

            {/* Expanded Task List */}
            <Collapse in={expanded}>
                <List sx={{ maxHeight: 400, overflow: "auto" }}>
                    {tasks.map((task) => (
                        <ListItem key={task.id} divider>
                            <Box sx={{ width: "100%" }}>
                                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                                    <Typography variant="body2">
                                        {task.type}: {task.folders.join(", ")}
                                    </Typography>
                                    <Box sx={{ display: "flex", gap: 1 }}>
                                        <Chip
                                            label={task.status}
                                            size="small"
                                            color={
                                                task.status === "completed" ? "success" :
                                                task.status === "failed" ? "error" :
                                                task.status === "cancelled" ? "default" : "primary"
                                            }
                                        />
                                        {task.cancellable && task.status === "running" && (
                                            <IconButton
                                                size="small"
                                                onClick={() => cancelTask(task.id)}
                                            >
                                                <Cancel />
                                            </IconButton>
                                        )}
                                    </Box>
                                </Box>
                                {task.status === "running" && (
                                    <LinearProgress variant="determinate" value={task.progress} />
                                )}
                                {task.error && (
                                    <Typography variant="caption" color="error">
                                        {task.error}
                                    </Typography>
                                )}
                            </Box>
                        </ListItem>
                    ))}
                </List>
                <Box sx={{ p: 1, textAlign: "right" }}>
                    <IconButton size="small" onClick={clearCompleted}>
                        <Close />
                    </IconButton>
                </Box>
            </Collapse>
        </Paper>
    );
};

export default TaskMonitor;
```

### Update ProjectDashboard

Replace blocking dialog with background task submission:

```typescript
// Before: Blocking operation
const handleRcloneAction = async (rcloneAction: RcloneAction, dry: boolean) => {
    setIsRunningRcloneAction(true);
    setIsRcloneDialogOpen(true);
    const output = await ExecuteRcloneAction(targetFolders, rcloneAction, dry);
    // ... handle output, keep dialog open until done
};

// After: Background task
const { submitSyncTask } = useTaskQueue();

const handleRcloneAction = async (rcloneAction: RcloneAction) => {
    // Submit to background queue immediately
    const taskId = await submitSyncTask(targetFolders, rcloneAction);

    // Close dialog, let user continue working
    setIsRcloneDialogOpen(false);
    setTargetFolders([]);

    // Show notification
    showNotification(`Sync task submitted: ${taskId}`);
};
```

---

## UI/UX Flow

### Before (Blocking)
```
1. User clicks "Push to Remote"
2. [Loading spinner appears, UI locked]
3. ... wait for operation to complete ...
4. Dialog closes, UI unlocked
```

### After (Background)
```
1. User clicks "Push to Remote"
2. Confirmation dialog appears (dry-run preview)
3. User confirms
4. Dialog closes immediately, task appears in bottom bar
5. User can continue working (browse folders, register new folders, etc.)
6. Bottom bar shows progress: [📊 1 task running] [▼]
7. When complete: [✓ Task completed] (dismissible)
```

---

## Additional Improvements

### Progress Parsing

Parse rclone output to show real progress:

```go
// In executeTask, stream rclone output
scanner := bufio.NewScanner(stdout)
for scanner.Scan() {
    line := scanner.Text()

    // Parse progress from rclone output
    // Example: "Transferred: 15.3MB / 100MB, 15%, 5.1MB/s, ETA 16s"
    if strings.Contains(line, "Transferred:") {
        progress := extractProgressPercentage(line)
        ts.updateTaskStatus(task.ID, TaskStatusRunning, progress, "", "")
    }
}
```

### Notifications

Show desktop notifications when tasks complete:

```go
// When task completes
ts.app.EmitEvent("notification:show", map[string]string{
    "title": "Sync Complete",
    "body":  fmt.Sprintf("Successfully synced %d folders", len(task.Folders)),
})
```

### Task History

Persist task history to disk for audit trail:

```go
// Log completed tasks to JSON file
func (ts *TaskService) logTaskCompletion(task *Task) {
    // Append to ~/.config/rclone-selective-sync/task_history.json
}
```

---

## Benefits

1. **Non-blocking UI** - Users can continue working during sync
2. **Progress visibility** - Real-time updates on sync status
3. **Cancellation support** - Cancel long-running operations
4. **Queue management** - Submit multiple tasks, run in parallel
5. **Better error handling** - Errors don't block the entire UI
6. **Audit trail** - History of all sync operations

---

## Implementation Phases

### Phase 1: Basic Background Execution
- Create TaskService with simple queue
- Execute rclone in goroutines
- Emit task status events to frontend

### Phase 2: UI Components
- Implement TaskQueueContext
- Create TaskMonitor bottom bar component
- Update ProjectDashboard to use background tasks

### Phase 3: Progress & Cancellation
- Parse rclone output for real progress
- Implement context-based cancellation
- Add cancel button to TaskMonitor

### Phase 4: Polish
- Desktop notifications
- Task history persistence
- Parallel task execution (multiple folders simultaneously)
- Task retry on failure

---

## Edge Cases

1. **App closure during task** - Warn user before quitting if tasks are running
2. **Multiple tasks on same folder** - Queue or reject duplicate operations
3. **Task failure** - Allow retry from TaskMonitor
4. **Very long tasks** - Show elapsed time, don't auto-dismiss
5. **Network interruption** - Detect and show appropriate error

---

## Testing Considerations

- Large file transfers (GB+ sizes)
- Network interruption during sync
- Cancellation at various stages
- Multiple concurrent tasks
- App restart with pending tasks
- Rapid task submission (stress test)

---

## References

- [Go Context Package](https://pkg.go.dev/context) - Cancellation support
- [Wails Events](https://wails.io/docs/reference/runtime/events/) - Event emission
- [Rclone Progress](https://rclone.org/docs/#stats) - Progress stats parsing
