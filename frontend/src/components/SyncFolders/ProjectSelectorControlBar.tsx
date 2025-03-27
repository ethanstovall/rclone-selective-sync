import { Box, FormControl, MenuItem, SelectChangeEvent } from "@mui/material";
import HeaderTypography from "../common/HeaderTypography";
import HeaderSelectMenu from "../common/HeaderSelectMenu";
import ActionIconButton from "../common/ActionIconButton";
import { OpenInNewRounded, Storage } from "@mui/icons-material";
import { FolderService, RcloneAction, RcloneActionOutput, SyncService } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend";
import ActionButton from "../common/ActionButton";
import { useState } from "react";
import RcloneActionDialog from "./RcloneActionDialog";

interface ProjectSelectorControlBarProps {
    selectedProject: string | undefined;
    projectOptions: string[];
    setSelectedProject: (selectProject: string) => void;
}

const ProjectSelectorControlBar: React.FC<ProjectSelectorControlBarProps> = ({ selectedProject, projectOptions, setSelectedProject }) => {

    // Rclone Action Dialog state. Mostly duplicated from ProjectDashboard. TODO: genericize this more effectively for reuse.
    const [rcloneActionDialogOutput, setRcloneActionDialogOutput] = useState<RcloneActionOutput[] | null>(null);
    const [isRunningRcloneAction, setIsRunningRcloneAction] = useState<boolean>(false);
    const [isRcloneDialogOpen, setIsRcloneDialogOpen] = useState<boolean>(false);
    // Rclone Action Dialog functions. Mostly duplicated from ProjectDashboard. TODO: genericize this more effectively for reuse.
    const handleRcloneDialogClose = async (event, reason) => {
        if (reason === 'backdropClick' && isRunningRcloneAction) {
            // Don't allow the dialog window to close while an Rclone action is running in the background.
            setIsRcloneDialogOpen(true);
            return;
        }
        setIsRcloneDialogOpen(false);
        setRcloneActionDialogOutput(null);
    }
    const handleBackupProject = async (dry: boolean) => {
        setIsRunningRcloneAction(true);
        setIsRcloneDialogOpen(true);
        const output = await SyncService.ExecuteFullBackup(dry);
        setIsRunningRcloneAction(false);
        if (dry) {
            // Open the finalize dialog if the dry run just completed.
            setIsRcloneDialogOpen(true);
            setRcloneActionDialogOutput(output);
        } else {
            // Close the finalize dialog if the final run just completed.
            setIsRcloneDialogOpen(false);
            setRcloneActionDialogOutput(null);
        }
    }

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
            <ActionButton
                text="Backup"
                size="large"
                color="secondary"
                variant="outlined"
                tooltip="Backup to Secondary Location"
                disabled={false}
                endIcon={<Storage />}
                onClick={() => { handleBackupProject(true) }}
            />
            <RcloneActionDialog
                action={RcloneAction.SYNC_PULL}
                rcloneDryOutput={rcloneActionDialogOutput}
                isRunningRcloneAction={isRunningRcloneAction}
                isOpen={isRcloneDialogOpen}
                handleClose={handleRcloneDialogClose}
                runRcloneCommand={() => { handleBackupProject(false) }}
            />
            <ActionIconButton onClick={() => { handleOpenFolder("BACKUP") }} inputIcon={OpenInNewRounded} color="secondary" tooltip="Open Backup" />
        </Box>
    )
}

export default ProjectSelectorControlBar;