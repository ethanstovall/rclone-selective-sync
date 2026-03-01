import React, { useMemo, useState } from "react";
import { Badge, Box, Button, Collapse, Divider, List, Paper, Typography } from "@mui/material";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import { Task, useTaskQueue } from "../../hooks/TaskQueueContext";
import TaskPanelItem from "./TaskPanelItem";
import TaskDetailDialog from "./TaskDetailDialog";

const TaskPanel: React.FC = () => {
    const { tasks, dismissTask, clearCompletedTasks } = useTaskQueue();
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    // Filter out detect-changes tasks (internal only) and sort by creation time (newest first)
    const visibleTasks = useMemo(() => {
        return Object.values(tasks)
            .filter((t: Task) => t.type !== "detect-changes")
            .sort((a, b) => b.createdAt - a.createdAt);
    }, [tasks]);

    const runningCount = useMemo(() => {
        return visibleTasks.filter(t => t.status === "running").length;
    }, [visibleTasks]);

    const completedCount = useMemo(() => {
        return visibleTasks.filter(t => t.status !== "running").length;
    }, [visibleTasks]);

    const selectedTask = selectedTaskId ? tasks[selectedTaskId] ?? null : null;

    // Don't render anything if there are no tasks
    if (visibleTasks.length === 0) return null;

    return (
        <>
            <Box sx={{
                position: "fixed",
                bottom: 16,
                right: 16,
                zIndex: 1300,
                maxWidth: 380,
                minWidth: 300,
            }}>
                <Paper elevation={8} sx={{ overflow: "hidden" }}>
                    {/* Header */}
                    <Box
                        onClick={() => setIsExpanded(!isExpanded)}
                        sx={{
                            cursor: "pointer",
                            px: 2,
                            py: 1,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            bgcolor: "action.hover",
                        }}
                    >
                        <Badge badgeContent={runningCount} color="primary" invisible={runningCount === 0}>
                            <Typography variant="subtitle2">Tasks</Typography>
                        </Badge>
                        {isExpanded ? <ExpandMore fontSize="small" /> : <ExpandLess fontSize="small" />}
                    </Box>

                    {/* Task list */}
                    <Collapse in={isExpanded}>
                        <List dense disablePadding sx={{ maxHeight: 320, overflow: "auto" }}>
                            {visibleTasks.map(task => (
                                <TaskPanelItem
                                    key={task.taskId}
                                    task={task}
                                    onClick={() => {
                                        setSelectedTaskId(task.taskId);
                                    }}
                                    onDismiss={() => dismissTask(task.taskId)}
                                />
                            ))}
                        </List>
                        {completedCount > 0 && (
                            <>
                                <Divider />
                                <Box sx={{ p: 1, display: "flex", justifyContent: "center" }}>
                                    <Button size="small" onClick={clearCompletedTasks}>
                                        Dismiss All Completed
                                    </Button>
                                </Box>
                            </>
                        )}
                    </Collapse>
                </Paper>
            </Box>

            {/* Task detail dialog */}
            <TaskDetailDialog
                task={selectedTask}
                isOpen={selectedTaskId !== null}
                onClose={() => setSelectedTaskId(null)}
            />
        </>
    );
};

export default TaskPanel;
