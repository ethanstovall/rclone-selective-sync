import React from "react";
import { Box, Chip, IconButton, LinearProgress, ListItemButton, ListItemText, Tooltip } from "@mui/material";
import { CheckCircle, Close, Error as ErrorIcon, HourglassBottom } from "@mui/icons-material";
import { Task } from "../../hooks/TaskQueueContext";

interface TaskPanelItemProps {
    task: Task;
    onClick: () => void;
    onDismiss: () => void;
}

const TaskPanelItem: React.FC<TaskPanelItemProps> = ({ task, onClick, onDismiss }) => {
    const completedCount = Object.keys(task.results).length;
    const totalCount = task.folders.length;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    const statusIcon = task.status === "completed"
        ? <CheckCircle fontSize="small" color="success" />
        : task.status === "error"
            ? <ErrorIcon fontSize="small" color="error" />
            : <HourglassBottom fontSize="small" color="primary" />;

    const statusLabel = task.status === "completed"
        ? "Done"
        : task.status === "error"
            ? "Error"
            : `${completedCount}/${totalCount}`;

    return (
        <ListItemButton onClick={onClick} dense sx={{ pr: 1 }}>
            <ListItemText
                primary={task.label}
                primaryTypographyProps={{ variant: "body2", noWrap: true }}
            />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: 1, flexShrink: 0 }}>
                <Chip
                    icon={statusIcon}
                    label={statusLabel}
                    size="small"
                    variant="outlined"
                    color={task.status === "error" ? "error" : task.status === "completed" ? "success" : "primary"}
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
            </Box>
            {task.status === "running" && (
                <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2 }}
                />
            )}
        </ListItemButton>
    );
};

export default TaskPanelItem;
