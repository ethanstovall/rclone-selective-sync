import React, { useState } from "react";
import {
    Box, CircularProgress, Dialog, DialogContent, DialogTitle, DialogActions,
    Paper, Tab, Tabs, Typography, useTheme, styled, Button,
} from "@mui/material";
import { Task, TaskFolderResult, useTaskQueue } from "../../hooks/TaskQueueContext";

// --- Styled tab with error indicator (mirrors RcloneActionOutputTabs pattern) ---

interface StyledTabProps {
    label: string;
    error: boolean;
    completed: boolean;
    id?: string;
    "aria-controls"?: string;
}

const StyledTab = styled((props: StyledTabProps) => (
    <Tab {...props} />
))(({ theme, error, completed }) => ({
    textTransform: "none",
    fontWeight: theme.typography.fontWeightRegular,
    fontSize: theme.typography.pxToRem(14),
    minWidth: "12%",
    boxShadow: error ? `inset 0 0 10px ${theme.palette.error.main}` : "none",
    opacity: completed ? 1 : 0.5,
    "&.Mui-selected": {
        color: error ? theme.palette.error.light : "default",
    },
}));

// --- Tab panel ---

interface TabPanelProps {
    children: React.ReactNode;
    value: number;
    index: number;
    error: boolean;
}

function TabPanel({ children, value, index, error, ...other }: TabPanelProps) {
    const theme = useTheme();
    return (
        <Box
            role="tabpanel"
            hidden={value !== index}
            id={`task-tabpanel-${index}`}
            aria-labelledby={`task-tab-${index}`}
            {...other}
            sx={{
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
                overflow: "auto",
                padding: 3,
                flexGrow: 1,
                boxShadow: error ? `inset 0 0px 10px ${theme.palette.error.main}` : "none",
            }}
        >
            {value === index && <Typography component="div">{children}</Typography>}
        </Box>
    );
}

// --- Dialog ---

interface TaskDetailDialogProps {
    task: Task | null;
    isOpen: boolean;
    onClose: () => void;
}

const TaskDetailDialog: React.FC<TaskDetailDialogProps> = ({ task, isOpen, onClose }) => {
    const [tabValue, setTabValue] = useState(0);
    const { startRcloneAction, pauseAutoDismiss, resumeAutoDismiss } = useTaskQueue();

    // Pause auto-dismiss while the dialog is open
    React.useEffect(() => {
        if (isOpen && task) {
            pauseAutoDismiss(task.taskId);
        }
        return () => {
            if (task) {
                resumeAutoDismiss(task.taskId);
            }
        };
    }, [isOpen, task, pauseAutoDismiss, resumeAutoDismiss]);

    if (!task) return null;

    const folders = task.folders;
    const results = task.results;
    const isDryRun = task.dry === true;
    const allComplete = task.status === "completed" || task.status === "error";

    const handleApprove = () => {
        if (task.action && task.folders.length > 0) {
            startRcloneAction(task.folders, task.action, false);
            onClose();
        }
    };

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            scroll="paper"
        >
            <DialogTitle>{task.label}</DialogTitle>
            <DialogContent dividers sx={{ p: 0, display: "flex", flexDirection: "column", minHeight: 300 }}>
                <Box component={Paper} sx={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
                    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                        <Tabs
                            value={tabValue}
                            onChange={handleTabChange}
                            variant="scrollable"
                            scrollButtons="auto"
                        >
                            {folders.map((folder, index) => {
                                const result: TaskFolderResult | undefined = results[folder];
                                const hasError = result ? result.commandError.length > 0 : false;
                                const isComplete = !!result;

                                return (
                                    <StyledTab
                                        key={folder}
                                        label={folder}
                                        error={hasError}
                                        completed={isComplete}
                                        id={`task-tab-${index}`}
                                        aria-controls={`task-tabpanel-${index}`}
                                    />
                                );
                            })}
                        </Tabs>
                    </Box>
                    {folders.map((folder, index) => {
                        const result: TaskFolderResult | undefined = results[folder];
                        const hasError = result ? result.commandError.length > 0 : false;

                        return (
                            <TabPanel key={folder} value={tabValue} index={index} error={hasError}>
                                {result ? (
                                    result.commandError || result.commandOutput || "No output available"
                                ) : (
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 4, justifyContent: "center" }}>
                                        <CircularProgress size={24} />
                                        <Typography variant="body2" color="text.secondary">Running...</Typography>
                                    </Box>
                                )}
                            </TabPanel>
                        );
                    })}
                </Box>
            </DialogContent>
            <DialogActions sx={{ padding: "16px", justifyContent: "space-between" }}>
                <Button onClick={onClose} variant="text">Close</Button>
                {isDryRun && allComplete && task.action && (
                    <Button onClick={handleApprove} variant="contained" color="primary">
                        Approve & Run
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default TaskDetailDialog;
