import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Box, Button, Chip, Collapse, List, Paper, Typography } from "@mui/material";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import { Task, useTaskQueue } from "../../hooks/TaskQueueContext";
import TaskPanelItem from "./TaskPanelItem";

const TaskPanel: React.FC = () => {
    const { tasks, approveTask, dismissTask, clearCompletedTasks, pauseAutoDismiss, resumeAutoDismiss } = useTaskQueue();
    const [isExpanded, setIsExpanded] = useState(false);
    // Track expanded task IDs as an array (React reliably detects array reference changes)
    const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>([]);

    // Measure the content area to center the panel within the page (not the full window)
    const anchorRef = useRef<HTMLDivElement>(null);
    const [contentBounds, setContentBounds] = useState<{ left: number; width: number } | null>(null);

    const updateBounds = useCallback(() => {
        const el = anchorRef.current;
        if (el) {
            const rect = el.getBoundingClientRect();
            setContentBounds({ left: rect.left, width: rect.width });
        }
    }, []);

    useEffect(() => {
        updateBounds();
        const el = anchorRef.current;
        if (!el) return;
        const observer = new ResizeObserver(updateBounds);
        observer.observe(el);
        window.addEventListener("resize", updateBounds);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", updateBounds);
        };
    }, [updateBounds]);

    // Filter out detect-changes tasks (internal only) and sort by creation time (newest first)
    const visibleTasks = useMemo(() => {
        return Object.values(tasks)
            .filter((t: Task) => t.type !== "detect-changes")
            .sort((a, b) => b.createdAt - a.createdAt);
    }, [tasks]);

    // Include pending and awaiting_approval in "active" count
    const activeCount = useMemo(() => {
        return visibleTasks.filter(t => t.status === "pending" || t.status === "running" || t.status === "awaiting_approval").length;
    }, [visibleTasks]);

    const errorCount = useMemo(() => {
        return visibleTasks.filter(t => t.status === "error").length;
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

    // Spacebar shortcut to toggle the task panel
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input/textarea/select
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
            if (e.code === "Space") {
                e.preventDefault();
                setIsExpanded(prev => !prev);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Compute panel positioning centered within the content area
    const maxW = 1100;
    const availableWidth = contentBounds ? contentBounds.width - 32 : window.innerWidth - 32;
    const panelWidth = Math.min(maxW, availableWidth);
    const panelLeft = contentBounds
        ? contentBounds.left + (contentBounds.width - panelWidth) / 2
        : (window.innerWidth - panelWidth) / 2;

    return (
        <>
            {/* Invisible anchor to measure the content area — must be in layout flow */}
            <Box ref={anchorRef} sx={{ height: 0, overflow: "hidden" }} />
            <Box sx={{
                    position: "fixed",
                    bottom: 16,
                    left: panelLeft,
                    width: panelWidth,
                    zIndex: 1300,
                }}>
                    <Paper elevation={8} sx={{ overflow: "hidden" }}>
                        {/* Header */}
                        <Box
                            onClick={() => setIsExpanded(!isExpanded)}
                            sx={{
                                cursor: "pointer",
                                px: 2,
                                py: 1.5,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                bgcolor: "action.hover",
                            }}
                        >
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <Badge badgeContent={activeCount} color="primary" invisible={activeCount === 0}>
                                    <Typography variant="subtitle2">Tasks</Typography>
                                </Badge>
                                {errorCount > 0 && (
                                    <Chip
                                        size="small"
                                        label={`${errorCount} error${errorCount !== 1 ? "s" : ""}`}
                                        color="error"
                                        variant="outlined"
                                        sx={{ height: 20, fontSize: "0.7rem" }}
                                    />
                                )}
                            </Box>
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
        </>
    );
};

export default TaskPanel;
