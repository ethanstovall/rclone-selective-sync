import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Events } from "@wailsio/runtime";
import { RcloneAction } from "../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models.ts";
import { SyncService } from "../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/index.ts";
import { useGlobalConfig } from "./GlobalConfigContext.tsx";

// --- Types ---

export interface TaskFolderResult {
    targetFolder: string;
    commandOutput: string;
    commandError: string;
    completedAt: number;
}

export type TaskType = "rclone-action" | "backup" | "detect-changes";
export type TaskStatus = "pending" | "running" | "awaiting_approval" | "completed" | "error";

export interface Task {
    taskId: string;
    label: string;
    type: TaskType;
    action?: RcloneAction;
    dry?: boolean;
    phase: "dry" | "final";
    folders: string[];
    status: TaskStatus;
    results: Record<string, TaskFolderResult>;
    dryResults?: Record<string, TaskFolderResult>;
    createdAt: number;
    completedAt?: number;
}

// --- Event payload types (mirrors backend events.go) ---

interface TaskFolderCompleteEvent {
    taskId: string;
    targetFolder: string;
    commandOutput: string;
    commandError: string;
}

interface TaskCompleteEvent {
    taskId: string;
}

interface DetectFolderCompleteEvent {
    taskId: string;
    targetFolder: string;
    hasChanges: boolean;
    commandError: string;
}

interface DetectCompleteEvent {
    taskId: string;
}

// --- Label generation ---

function buildTaskLabel(type: TaskType, action?: RcloneAction, folders?: string[]): string {
    if (type === "backup") return "Full Backup";
    if (type === "detect-changes") return "Detecting changes";
    const actionName = action === RcloneAction.SYNC_PUSH ? "Push" : action === RcloneAction.SYNC_PULL ? "Pull" : "Download";
    const count = folders?.length ?? 0;
    return `${actionName} ${count} folder${count !== 1 ? "s" : ""}`;
}

// --- Auto-dismiss delay ---

const AUTO_DISMISS_MS = 30_000;

// --- Context ---

interface TaskQueueContextProps {
    /** All tracked tasks (rclone-action and backup only; detect-changes are internal) */
    tasks: Record<string, Task>;
    /** Start an async rclone action. Returns the generated taskId. */
    startRcloneAction: (folders: string[], action: RcloneAction, dry: boolean) => string;
    /** Start an async full backup. Returns the generated taskId. */
    startBackup: (dry: boolean) => string;
    /** Start async change detection. Returns the generated taskId. */
    startDetectChanges: (folders: string[]) => string;
    /** Approve a dry-run task and transition it to final execution */
    approveTask: (taskId: string) => void;
    /** Manually dismiss a task */
    dismissTask: (taskId: string) => void;
    /** Clear all completed/errored tasks */
    clearCompletedTasks: () => void;
    /** Pause auto-dismiss for a task (e.g., when viewing output inline) */
    pauseAutoDismiss: (taskId: string) => void;
    /** Resume auto-dismiss for a task */
    resumeAutoDismiss: (taskId: string) => void;
    /** Change detection results (accumulated from the latest detect run) */
    detectedChangedFolders: string[];
    /** Folders that have completed detection (checked, regardless of changed or not) */
    checkedFolders: string[];
    /** Whether change detection is currently in progress */
    isDetectingChanges: boolean;
}

const TaskQueueContext = createContext<TaskQueueContextProps | undefined>(undefined);

export const useTaskQueue = () => {
    const context = useContext(TaskQueueContext);
    if (context === undefined) {
        throw new Error("useTaskQueue was used outside of its Provider");
    }
    return context;
};

// --- Provider ---

export const TaskQueueContextProvider = ({ children }: { children: React.ReactNode }) => {
    const { selectedProject } = useGlobalConfig();
    const [tasks, setTasks] = useState<Record<string, Task>>({});
    const [detectedChangedFolders, setDetectedChangedFolders] = useState<string[]>([]);
    const [checkedFolders, setCheckedFolders] = useState<string[]>([]);
    const [isDetectingChanges, setIsDetectingChanges] = useState(false);

    // Track tasks that have auto-dismiss paused (user is viewing them)
    const pausedTasks = useRef<Set<string>>(new Set());

    // --- Auto-dismiss logic (interval-based, checks completedAt timestamps) ---

    const pauseAutoDismiss = useCallback((taskId: string) => {
        pausedTasks.current.add(taskId);
    }, []);

    const resumeAutoDismiss = useCallback((taskId: string) => {
        pausedTasks.current.delete(taskId);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setTasks(prev => {
                const now = Date.now();
                let changed = false;
                const next = { ...prev };
                for (const [id, task] of Object.entries(next)) {
                    if (task.status === "completed" && task.completedAt &&
                        now - task.completedAt >= AUTO_DISMISS_MS) {
                        delete next[id];
                        pausedTasks.current.delete(id);
                        changed = true;
                    }
                }
                return changed ? next : prev;
            });
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    // --- Clear queue on project switch ---

    useEffect(() => {
        setTasks({});
        setDetectedChangedFolders([]);
        setCheckedFolders([]);
        setIsDetectingChanges(false);
        pausedTasks.current.clear();
        launchedTaskIds.current.clear();
    }, [selectedProject]);

    // --- FIFO queue processing ---

    // Ref to prevent double-launching from React batching
    const launchedTaskIds = useRef<Set<string>>(new Set());

    const launchTask = useCallback((task: Task) => {
        if (launchedTaskIds.current.has(task.taskId)) return;
        launchedTaskIds.current.add(task.taskId);

        setTasks(prev => {
            const existing = prev[task.taskId];
            if (!existing || existing.status !== "pending") return prev;
            return { ...prev, [task.taskId]: { ...existing, status: "running" } };
        });

        if (task.type === "rclone-action" && task.action !== undefined) {
            SyncService.ExecuteRcloneActionAsync(task.taskId, task.folders, task.action, task.dry ?? false);
        } else if (task.type === "backup") {
            SyncService.ExecuteFullBackupAsync(task.taskId, task.dry ?? false);
        }
    }, []);

    // --- Event subscriptions ---

    useEffect(() => {
        const unsubFolderComplete = Events.On("task-folder-complete", (event: { data: TaskFolderCompleteEvent }) => {
            const { taskId, targetFolder, commandOutput, commandError } = event.data;
            setTasks(prev => {
                const task = prev[taskId];
                if (!task) return prev;

                const updatedResults = {
                    ...task.results,
                    [targetFolder]: {
                        targetFolder,
                        commandOutput,
                        commandError,
                        completedAt: Date.now(),
                    },
                };

                // Check if all folders have reported — determine final status here
                // to avoid race condition with task-complete event delivery order
                const allComplete = task.folders.every(f => f in updatedResults);
                if (allComplete) {
                    const hasAnyError = Object.values(updatedResults).some(r => r.commandError.length > 0);

                    // Dry run succeeded without errors → awaiting approval
                    if (task.dry && !hasAnyError) {
                        return {
                            ...prev,
                            [taskId]: {
                                ...task,
                                results: updatedResults,
                                status: "awaiting_approval",
                                completedAt: Date.now(),
                            },
                        };
                    }

                    const finalStatus: TaskStatus = hasAnyError ? "error" : "completed";

                    return {
                        ...prev,
                        [taskId]: {
                            ...task,
                            results: updatedResults,
                            status: finalStatus,
                            completedAt: Date.now(),
                        },
                    };
                }

                return {
                    ...prev,
                    [taskId]: {
                        ...task,
                        results: updatedResults,
                    },
                };
            });
        });

        const unsubTaskComplete = Events.On("task-complete", (event: { data: TaskCompleteEvent }) => {
            const { taskId } = event.data;
            // Fallback: only finalize if folder-complete handler hasn't already
            setTasks(prev => {
                const task = prev[taskId];
                if (!task || task.status !== "running") return prev;

                const hasAnyError = Object.values(task.results).some(r => r.commandError.length > 0);
                const finalStatus: TaskStatus = hasAnyError ? "error" : "completed";

                if (task.dry && !hasAnyError) {
                    return {
                        ...prev,
                        [taskId]: {
                            ...task,
                            status: "awaiting_approval",
                            completedAt: Date.now(),
                        },
                    };
                }

                return {
                    ...prev,
                    [taskId]: {
                        ...task,
                        status: finalStatus,
                        completedAt: Date.now(),
                    },
                };
            });
        });

        const unsubDetectFolder = Events.On("detect-folder-complete", (event: { data: DetectFolderCompleteEvent }) => {
            const { targetFolder, hasChanges } = event.data;
            setCheckedFolders(prev =>
                prev.includes(targetFolder) ? prev : [...prev, targetFolder]
            );
            if (hasChanges) {
                setDetectedChangedFolders(prev =>
                    prev.includes(targetFolder) ? prev : [...prev, targetFolder]
                );
            }
        });

        const unsubDetectComplete = Events.On("detect-complete", (_event: { data: DetectCompleteEvent }) => {
            setIsDetectingChanges(false);
        });

        return () => {
            unsubFolderComplete();
            unsubTaskComplete();
            unsubDetectFolder();
            unsubDetectComplete();
        };
    }, []);

    // --- Queue processor: launch next pending task when active slot is free ---

    useEffect(() => {
        const taskList = Object.values(tasks);
        const hasActiveTask = taskList.some(
            t => t.type !== "detect-changes" &&
                 (t.status === "running" || t.status === "awaiting_approval")
        );
        if (hasActiveTask) return;

        const nextPending = taskList
            .filter(t => t.status === "pending")
            .sort((a, b) => a.createdAt - b.createdAt)[0];

        if (nextPending) launchTask(nextPending);
    }, [tasks, launchTask]);

    // --- Task submission ---

    const startRcloneAction = useCallback((folders: string[], action: RcloneAction, dry: boolean): string => {
        const taskId = crypto.randomUUID();
        const label = buildTaskLabel("rclone-action", action, folders);
        const task: Task = {
            taskId,
            label,
            type: "rclone-action",
            action,
            dry,
            phase: dry ? "dry" : "final",
            folders,
            status: "pending",
            results: {},
            createdAt: Date.now(),
        };
        setTasks(prev => ({ ...prev, [taskId]: task }));
        return taskId;
    }, []);

    const startBackup = useCallback((dry: boolean): string => {
        const taskId = crypto.randomUUID();
        const projectName = selectedProject ?? "Unknown";
        const label = `${projectName} - Backup`;
        const task: Task = {
            taskId,
            label,
            type: "backup",
            dry,
            phase: dry ? "dry" : "final",
            folders: [`${projectName} - Backup`],
            status: "pending",
            results: {},
            createdAt: Date.now(),
        };
        setTasks(prev => ({ ...prev, [taskId]: task }));
        return taskId;
    }, [selectedProject]);

    const startDetectChanges = useCallback((folders: string[]): string => {
        const taskId = crypto.randomUUID();
        setIsDetectingChanges(true);
        setDetectedChangedFolders([]);
        setCheckedFolders([]);
        SyncService.DetectChangedFoldersAsync(taskId, folders);
        return taskId;
    }, []);

    // --- Task approval (dry-run → final) ---

    const approveTask = useCallback((taskId: string) => {
        pausedTasks.current.delete(taskId);
        setTasks(prev => {
            const task = prev[taskId];
            if (!task || task.status !== "awaiting_approval") return prev;

            const updatedTask: Task = {
                ...task,
                dryResults: { ...task.results },
                results: {},
                status: "running",
                phase: "final",
                dry: false,
                completedAt: undefined,
                label: task.label,
            };

            // Reuse the same taskId so backend events update this task
            if (task.type === "rclone-action" && task.action) {
                SyncService.ExecuteRcloneActionAsync(taskId, task.folders, task.action, false);
            } else if (task.type === "backup") {
                SyncService.ExecuteFullBackupAsync(taskId, false);
            }

            return { ...prev, [taskId]: updatedTask };
        });
    }, []);

    // --- Task management ---

    const dismissTask = useCallback((taskId: string) => {
        pausedTasks.current.delete(taskId);
        launchedTaskIds.current.delete(taskId);
        setTasks(prev => {
            const next = { ...prev };
            delete next[taskId];
            return next;
        });
    }, []);

    const clearCompletedTasks = useCallback(() => {
        setTasks(prev => {
            const next: Record<string, Task> = {};
            for (const [id, task] of Object.entries(prev)) {
                if (task.status === "pending" || task.status === "running" || task.status === "awaiting_approval") {
                    next[id] = task;
                } else {
                    pausedTasks.current.delete(id);
                }
            }
            return next;
        });
    }, []);

    return (
        <TaskQueueContext.Provider value={{
            tasks,
            startRcloneAction,
            startBackup,
            startDetectChanges,
            approveTask,
            dismissTask,
            clearCompletedTasks,
            pauseAutoDismiss,
            resumeAutoDismiss,
            detectedChangedFolders,
            checkedFolders,
            isDetectingChanges,
        }}>
            {children}
        </TaskQueueContext.Provider>
    );
};
