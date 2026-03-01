import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Events } from "@wailsio/runtime";
import { RcloneAction } from "../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models.ts";
import { SyncService } from "../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/index.ts";

// --- Types ---

export interface TaskFolderResult {
    targetFolder: string;
    commandOutput: string;
    commandError: string;
    completedAt: number;
}

export type TaskType = "rclone-action" | "backup" | "detect-changes";
export type TaskStatus = "running" | "completed" | "error";

export interface Task {
    taskId: string;
    label: string;
    type: TaskType;
    action?: RcloneAction;
    dry?: boolean;
    folders: string[];
    status: TaskStatus;
    results: Record<string, TaskFolderResult>;
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

function buildTaskLabel(type: TaskType, action?: RcloneAction, folders?: string[], dry?: boolean): string {
    if (type === "backup") return `Full Backup${dry ? " (preview)" : ""}`;
    if (type === "detect-changes") return "Detecting changes";
    const actionName = action === RcloneAction.SYNC_PUSH ? "Push" : action === RcloneAction.SYNC_PULL ? "Pull" : "Download";
    const count = folders?.length ?? 0;
    return `${actionName} ${count} folder${count !== 1 ? "s" : ""}${dry ? " (preview)" : ""}`;
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
    /** Manually dismiss a task */
    dismissTask: (taskId: string) => void;
    /** Clear all completed/errored tasks */
    clearCompletedTasks: () => void;
    /** Pause auto-dismiss for a task (e.g., when viewing its detail dialog) */
    pauseAutoDismiss: (taskId: string) => void;
    /** Resume auto-dismiss for a task */
    resumeAutoDismiss: (taskId: string) => void;
    /** Change detection results (accumulated from the latest detect run) */
    detectedChangedFolders: string[];
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
    const [tasks, setTasks] = useState<Record<string, Task>>({});
    const [detectedChangedFolders, setDetectedChangedFolders] = useState<string[]>([]);
    const [isDetectingChanges, setIsDetectingChanges] = useState(false);

    // Track auto-dismiss timers so we can clear them
    const dismissTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    // Track tasks that have auto-dismiss paused (user is viewing them)
    const pausedTasks = useRef<Set<string>>(new Set());

    // --- Auto-dismiss logic ---

    const scheduleAutoDismiss = useCallback((taskId: string) => {
        // Don't auto-dismiss if paused
        if (pausedTasks.current.has(taskId)) return;

        // Clear any existing timer
        if (dismissTimers.current[taskId]) {
            clearTimeout(dismissTimers.current[taskId]);
        }

        dismissTimers.current[taskId] = setTimeout(() => {
            setTasks(prev => {
                const task = prev[taskId];
                if (!task || task.status === "error") return prev; // Don't auto-dismiss errors
                const next = { ...prev };
                delete next[taskId];
                return next;
            });
            delete dismissTimers.current[taskId];
        }, AUTO_DISMISS_MS);
    }, []);

    const pauseAutoDismiss = useCallback((taskId: string) => {
        pausedTasks.current.add(taskId);
        if (dismissTimers.current[taskId]) {
            clearTimeout(dismissTimers.current[taskId]);
            delete dismissTimers.current[taskId];
        }
    }, []);

    const resumeAutoDismiss = useCallback((taskId: string) => {
        pausedTasks.current.delete(taskId);
        // Re-schedule if the task is completed successfully
        setTasks(prev => {
            const task = prev[taskId];
            if (task && task.status === "completed") {
                scheduleAutoDismiss(taskId);
            }
            return prev;
        });
    }, [scheduleAutoDismiss]);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            Object.values(dismissTimers.current).forEach(clearTimeout);
        };
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
            setTasks(prev => {
                const task = prev[taskId];
                if (!task) return prev;

                const hasAnyError = Object.values(task.results).some(r => r.commandError.length > 0);
                const finalStatus: TaskStatus = hasAnyError ? "error" : "completed";

                // Schedule auto-dismiss for successful tasks
                if (finalStatus === "completed") {
                    scheduleAutoDismiss(taskId);
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
    }, [scheduleAutoDismiss]);

    // --- Task submission ---

    const startRcloneAction = useCallback((folders: string[], action: RcloneAction, dry: boolean): string => {
        const taskId = crypto.randomUUID();
        const label = buildTaskLabel("rclone-action", action, folders, dry);
        const task: Task = {
            taskId,
            label,
            type: "rclone-action",
            action,
            dry,
            folders,
            status: "running",
            results: {},
            createdAt: Date.now(),
        };
        setTasks(prev => ({ ...prev, [taskId]: task }));
        SyncService.ExecuteRcloneActionAsync(taskId, folders, action, dry);
        return taskId;
    }, []);

    const startBackup = useCallback((dry: boolean): string => {
        const taskId = crypto.randomUUID();
        const label = buildTaskLabel("backup", undefined, undefined, dry);
        const task: Task = {
            taskId,
            label,
            type: "backup",
            dry,
            folders: ["backup"],
            status: "running",
            results: {},
            createdAt: Date.now(),
        };
        setTasks(prev => ({ ...prev, [taskId]: task }));
        SyncService.ExecuteFullBackupAsync(taskId, dry);
        return taskId;
    }, []);

    const startDetectChanges = useCallback((folders: string[]): string => {
        const taskId = crypto.randomUUID();
        setIsDetectingChanges(true);
        setDetectedChangedFolders([]);
        SyncService.DetectChangedFoldersAsync(taskId, folders);
        return taskId;
    }, []);

    // --- Task management ---

    const dismissTask = useCallback((taskId: string) => {
        if (dismissTimers.current[taskId]) {
            clearTimeout(dismissTimers.current[taskId]);
            delete dismissTimers.current[taskId];
        }
        pausedTasks.current.delete(taskId);
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
                if (task.status === "running") {
                    next[id] = task;
                } else {
                    // Clean up timers for dismissed tasks
                    if (dismissTimers.current[id]) {
                        clearTimeout(dismissTimers.current[id]);
                        delete dismissTimers.current[id];
                    }
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
            dismissTask,
            clearCompletedTasks,
            pauseAutoDismiss,
            resumeAutoDismiss,
            detectedChangedFolders,
            isDetectingChanges,
        }}>
            {children}
        </TaskQueueContext.Provider>
    );
};
