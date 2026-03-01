import React, { useMemo, useState } from "react";
import { Badge, Box, Button, ClickAwayListener, Collapse, List, Paper, Typography } from "@mui/material";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import { Task, useTaskQueue } from "../../hooks/TaskQueueContext";
import TaskPanelItem from "./TaskPanelItem";

const TaskPanel: React.FC = () => {
    const { tasks, approveTask, dismissTask, clearCompletedTasks, pauseAutoDismiss, resumeAutoDismiss } = useTaskQueue();
    const [isExpanded, setIsExpanded] = useState(false);
    // Track expanded task IDs as an array (React reliably detects array reference changes)
    const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>([]);

    // Filter out detect-changes tasks (internal only) and sort by creation time (newest first)
    const visibleTasks = useMemo(() => {
        return Object.values(tasks)
            .filter((t: Task) => t.type !== "detect-changes")
            .sort((a, b) => b.createdAt - a.createdAt);
    }, [tasks]);

    // Include awaiting_approval in "active" count so badge doesn't flash between dry→final
    const activeCount = useMemo(() => {
        return visibleTasks.filter(t => t.status === "running" || t.status === "awaiting_approval").length;
    }, [visibleTasks]);

    const completedCount = useMemo(() => {
        return visibleTasks.filter(t => t.status === "completed" || t.status === "error").length;
    }, [visibleTasks]);

    const toggleTaskExpanded = (taskId: string) => {
        setExpandedTaskIds(prev => {
            if (prev.includes(taskId)) {
                resumeAutoDismiss(taskId);
                return prev.filter(id => id !== taskId);
            } else {
                pauseAutoDismiss(taskId);
                return [...prev, taskId];
            }
        });
    };

    // Panel goes wide when the panel is open AND at least one task's output is expanded
    const isWide = isExpanded && expandedTaskIds.some(id => tasks[id] && tasks[id].type !== "detect-changes");

    const handleClickAway = () => {
        if (isExpanded) setIsExpanded(false);
    };

    return (
        <ClickAwayListener onClickAway={handleClickAway}>
            <Box sx={{
                position: "fixed",
                bottom: 16,
                right: 16,
                zIndex: 1300,
                width: isWide ? "min(1100px, calc(100vw - 32px))" : 380,
                transition: "width 0.25s ease",
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
                        <Badge badgeContent={activeCount} color="primary" invisible={activeCount === 0}>
                            <Typography variant="subtitle2">Tasks</Typography>
                        </Badge>
                        {isExpanded ? <ExpandMore fontSize="small" /> : <ExpandLess fontSize="small" />}
                    </Box>

                    {/* Task list */}
                    <Collapse in={isExpanded} timeout={150}>
                        {visibleTasks.length === 0 ? (
                            <Box sx={{ px: 2, py: 2 }}>
                                <Typography variant="body2" color="text.secondary">No active tasks</Typography>
                            </Box>
                        ) : (
                            <>
                                <List disablePadding sx={{ maxHeight: 600, overflow: "auto" }}>
                                    {visibleTasks.map(task => (
                                        <TaskPanelItem
                                            key={task.taskId}
                                            task={task}
                                            isExpanded={expandedTaskIds.includes(task.taskId)}
                                            onToggleExpand={() => toggleTaskExpanded(task.taskId)}
                                            onDismiss={() => dismissTask(task.taskId)}
                                            onApprove={() => approveTask(task.taskId)}
                                        />
                                    ))}
                                </List>
                                <Box sx={{ p: 0.75, display: "flex", justifyContent: "center", bgcolor: "action.hover" }}>
                                    <Button
                                        size="small"
                                        onClick={clearCompletedTasks}
                                        disabled={completedCount === 0}
                                        sx={{ whiteSpace: "nowrap" }}
                                    >
                                        Dismiss Completed
                                    </Button>
                                </Box>
                            </>
                        )}
                    </Collapse>
                </Paper>
            </Box>
        </ClickAwayListener>
    );
};

export default TaskPanel;
