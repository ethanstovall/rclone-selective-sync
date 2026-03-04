import React, { useState } from "react";
import {
    Box, Button, Chip, CircularProgress, Collapse, Divider, IconButton,
    LinearProgress, ListItem, ListItemButton, ListItemText, Tab, Tabs,
    Tooltip, Typography, useTheme,
} from "@mui/material";
import {
    CheckCircle, Close, Error as ErrorIcon, ExpandLess, ExpandMore,
    HourglassBottom, Visibility,
} from "@mui/icons-material";
import { Task, TaskFolderResult } from "../../hooks/TaskQueueContext";

interface TaskPanelItemProps {
    task: Task;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onDismiss: () => void;
    onApprove: () => void;
}

// --- Status helpers ---

function getStatusIcon(task: Task) {
    if (task.status === "pending") return <HourglassBottom fontSize="small" color="disabled" />;
    if (task.status === "completed") return <CheckCircle fontSize="small" color="success" />;
    if (task.status === "error") return <ErrorIcon fontSize="small" color="error" />;
    if (task.status === "awaiting_approval") return <Visibility fontSize="small" color="warning" />;
    if (task.phase === "dry") return <HourglassBottom fontSize="small" color="secondary" />;
    return <HourglassBottom fontSize="small" color="primary" />;
}

function getStatusLabel(task: Task) {
    if (task.status === "pending") return "Queued";
    if (task.status === "completed") return "Done";
    if (task.status === "error") return "Error";
    if (task.status === "awaiting_approval") return "Review";
    const completedCount = Object.keys(task.results).length;
    const totalCount = task.folders.length;
    if (task.phase === "dry") return `Preview ${completedCount}/${totalCount}`;
    return `${completedCount}/${totalCount}`;
}

function getStatusColor(task: Task): "success" | "error" | "warning" | "secondary" | "primary" | "default" {
    if (task.status === "pending") return "default";
    if (task.status === "completed") return "success";
    if (task.status === "error") return "error";
    if (task.status === "awaiting_approval") return "warning";
    if (task.phase === "dry") return "secondary";
    return "primary";
}

// --- Tab panel ---

interface TabPanelProps {
    children: React.ReactNode;
    value: number;
    index: number;
    hasError: boolean;
}

function TabPanel({ children, value, index, hasError, ...other }: TabPanelProps) {
    const theme = useTheme();
    return (
        <Box
            role="tabpanel"
            hidden={value !== index}
            {...other}
            sx={{
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
                overflow: "auto",
                height: 300,
                p: 1.5,
                fontSize: "0.8rem",
                fontFamily: "monospace",
                userSelect: "text",
                cursor: "text",
                boxShadow: hasError ? `inset 0 0 8px ${theme.palette.error.main}` : "none",
            }}
        >
            {value === index && children}
        </Box>
    );
}

// --- Component ---

const TaskPanelItem: React.FC<TaskPanelItemProps> = ({ task, isExpanded, onToggleExpand, onDismiss, onApprove }) => {
    const [tabValue, setTabValue] = useState(0);

    // Show output section if task is running/awaiting approval, or if any result has actual content
    const hasVisibleOutput = task.status === "running" || task.status === "awaiting_approval" ||
        Object.values(task.results).some(r => r.commandOutput || r.commandError);

    return (
        <ListItem disablePadding sx={{ display: "block" }}>
            {/* Header row — taller with more padding */}
            <ListItemButton onClick={onToggleExpand} sx={{ py: 1.25, pr: 1 }}>
                <ListItemText
                    primary={task.label}
                    primaryTypographyProps={{ variant: "body2", noWrap: true }}
                    secondary={task.folders.length <= 3
                        ? task.folders.join(", ")
                        : `${task.folders.slice(0, 3).join(", ")} +${task.folders.length - 3} more`
                    }
                    secondaryTypographyProps={{ variant: "caption", noWrap: true, color: "text.disabled" }}
                />
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: 1, flexShrink: 0 }}>
                    <Chip
                        icon={getStatusIcon(task)}
                        label={getStatusLabel(task)}
                        size="small"
                        variant="outlined"
                        color={getStatusColor(task)}
                    />
                    {task.status !== "running" && (
                        <Tooltip title="Dismiss">
                            <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                            >
                                <Close fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    <Box sx={{ visibility: task.status === "pending" || task.status === "completed" ? "hidden" : "visible" }}>
                        {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                    </Box>
                </Box>
                {task.status === "running" && (
                    <LinearProgress
                        variant="indeterminate"
                        color={task.phase === "dry" ? "secondary" : "primary"}
                        sx={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2 }}
                    />
                )}
            </ListItemButton>

            {/* Inline expandable output — only if there are results to show */}
            <Collapse in={isExpanded && hasVisibleOutput} unmountOnExit>
                <Divider />
                <Box sx={{ bgcolor: "background.default" }}>
                    {/* Folder tabs */}
                    <Tabs
                        value={tabValue}
                        onChange={(_e, v) => setTabValue(v)}
                        variant="scrollable"
                        scrollButtons="auto"
                        onWheel={(e) => {
                            e.stopPropagation();
                            setTabValue(prev => {
                                const next = prev + (e.deltaY > 0 ? 1 : -1);
                                return Math.max(0, Math.min(next, task.folders.length - 1));
                            });
                        }}
                        sx={{
                            minHeight: 36,
                            "& .MuiTab-root": {
                                minHeight: 36,
                                py: 0.5,
                                px: 2,
                                textTransform: "none",
                                fontSize: "0.8rem",
                                maxWidth: "none",
                                minWidth: "fit-content",
                                whiteSpace: "nowrap",
                            },
                        }}
                    >
                        {task.folders.map((folder) => {
                            const result: TaskFolderResult | undefined = task.results[folder];
                            const hasError = result ? result.commandError.length > 0 : false;
                            return (
                                <Tab
                                    key={folder}
                                    label={
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                            {folder}
                                            {result && (
                                                hasError
                                                    ? <ErrorIcon sx={{ fontSize: 14 }} color="error" />
                                                    : task.phase === "dry"
                                                        ? <Visibility sx={{ fontSize: 14 }} color="warning" />
                                                        : <CheckCircle sx={{ fontSize: 14 }} color="success" />
                                            )}
                                        </Box>
                                    }
                                    sx={{
                                        opacity: result ? 1 : 0.5,
                                    }}
                                />
                            );
                        })}
                    </Tabs>

                    {/* Tab panels */}
                    {task.folders.map((folder, index) => {
                        const result: TaskFolderResult | undefined = task.results[folder];
                        const hasError = result ? result.commandError.length > 0 : false;
                        const output = result ? (result.commandError || result.commandOutput || "") : "";

                        return (
                            <TabPanel key={folder} value={tabValue} index={index} hasError={hasError}>
                                {result ? (
                                    output || null
                                ) : (
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 2, justifyContent: "center" }}>
                                        <CircularProgress size={18} />
                                        <Typography variant="body2" color="text.secondary">
                                            {task.phase === "dry" ? "Previewing..." : "Running..."}
                                        </Typography>
                                    </Box>
                                )}
                            </TabPanel>
                        );
                    })}

                    {/* Approve button for dry-run tasks */}
                    {task.status === "awaiting_approval" && (
                        <>
                            <Divider />
                            <Box sx={{ p: 1, display: "flex", justifyContent: "flex-end" }}>
                                <Button
                                    size="small"
                                    variant="contained"
                                    color="primary"
                                    onClick={(e) => { e.stopPropagation(); onApprove(); }}
                                >
                                    Approve & Run
                                </Button>
                            </Box>
                        </>
                    )}
                </Box>
            </Collapse>
        </ListItem>
    );
};

export default TaskPanelItem;
