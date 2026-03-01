import { Box, FormControl, MenuItem, SelectChangeEvent } from "@mui/material";
import HeaderTypography from "../common/HeaderTypography";
import HeaderSelectMenu from "../common/HeaderSelectMenu";
import ActionIconButton from "../common/ActionIconButton";
import { OpenInNewRounded, Storage } from "@mui/icons-material";
import { FolderService } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend";
import SplitActionButton from "../common/SplitActionButton";
import { useCallback } from "react";
import { useTaskQueue } from "../../hooks/TaskQueueContext";

interface ProjectSelectorControlBarProps {
    selectedProject: string | undefined;
    projectOptions: string[];
    setSelectedProject: (selectProject: string) => void;
}

const ProjectSelectorControlBar: React.FC<ProjectSelectorControlBarProps> = ({ selectedProject, projectOptions, setSelectedProject }) => {
    const { startBackup } = useTaskQueue();

    // Submit a backup to the task queue (non-blocking)
    const handleBackupProject = useCallback((dry: boolean) => {
        startBackup(dry);
    }, [startBackup]);

    // Select a project.
    const handleChange = (event: SelectChangeEvent<unknown>, child: React.ReactNode) => {
        setSelectedProject(event.target.value as string);
    };

    // Open the selected folder in the user's file explorer.
    const handleOpenFolder = async (targetFolder: string) => {
        try {
            await FolderService.OpenFolder(targetFolder);
        } catch (e: any) {
            console.error(e);
        }
    }

    return (
        <Box display={"flex"} alignItems="center" justifyItems={"flex-end"} gap={2}>
            <FormControl sx={{ m: 1, minWidth: "60%" }}>
                <HeaderSelectMenu
                    value={selectedProject ?? ''}
                    onChange={handleChange}
                    displayEmpty
                    inputProps={{ 'aria-label': 'Selected Project' }}
                    renderValue={(selected) => (
                        <HeaderTypography color="primary">
                            {selected as string ?? ''}
                        </HeaderTypography>
                    )}
                >
                    {
                        projectOptions.map((option) => (
                            <MenuItem key={option} value={option}>{option}</MenuItem>
                        ))
                    }
                </HeaderSelectMenu>
            </FormControl>
            <ActionIconButton onClick={() => { handleOpenFolder("") }} inputIcon={OpenInNewRounded} color="primary" tooltip="Open Project" />
            <SplitActionButton
                tooltip="Backup to Secondary Location (preview first)"
                directTooltip="Backup Directly (skip preview)"
                color="secondary"
                disabled={false}
                inputIcon={Storage}
                onClickDefault={() => handleBackupProject(true)}
                onClickDirect={() => handleBackupProject(false)}
            />
            <ActionIconButton onClick={() => { handleOpenFolder("BACKUP") }} inputIcon={OpenInNewRounded} color="secondary" tooltip="Open Backup" />
        </Box>
    )
}

export default ProjectSelectorControlBar;