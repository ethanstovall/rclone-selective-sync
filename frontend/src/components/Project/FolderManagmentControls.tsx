import { Box, Grid2, TextField } from "@mui/material";
import { FileSystemService, FolderConfig, ProjectConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend";
import ActionButton from "../common/ActionButton";
import { CreateNewFolder, EditRounded, OpenInNewRounded } from "@mui/icons-material";
import React, { useEffect, useMemo, useState } from "react";
import ListItemPaper from "../common/ListItemPaper";
import FolderDescription from "./FolderDescription";
import StandardDialog from "../common/StandardDialog";

interface FolderManagementControls {
    focusedFolder: string | null;
    projectConfig: ProjectConfig;
};

const FolderManagementControls: React.FC<FolderManagementControls> = (
    {
        focusedFolder,
        projectConfig,
    }
) => {
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState<boolean>(false);
    const [isSaving, _setIsSaving] = useState<boolean>(false);
    const [isNewSave, _setIsNewSave] = useState<boolean>(false);

    const [editFolderConfig, setEditFolderConfig] = useState(new FolderConfig());

    const handleInputChange = (field: keyof FolderConfig, value: string) => {
        // Create a new instance with the updated field
        const updatedConfig = new FolderConfig({
            ...editFolderConfig,
            [field]: value,
        });
        setEditFolderConfig(updatedConfig);
        console.log(updatedConfig);
    };

    // const handleSaveClick = () => {
    //     // Implement save logic (e.g., API call or state update)
    //     console.log("Saved details:", editFolderConfig);
    //     setIsSaveDialogOpen(false);
    // };

    const handleCloseEdit = () => {
        setEditFolderConfig(folderConfig); // Revert changes
        setIsSaveDialogOpen(false);
    };

    const handleSave = () => {
        console.log();
    };

    // Open the selected folder in the user's file explorer
    const handleOpenFolder = async (targetFolder: string) => {
        try {
            await FileSystemService.OpenFolder(targetFolder)
        } catch (e: any) {
            console.error(e);
        }
    }

    // Pull the current folder details
    const folderConfig = useMemo(() => {
        if (!focusedFolder || !projectConfig?.folders) {
            return new FolderConfig();
        }
        return projectConfig.folders[focusedFolder];
    }, [focusedFolder, projectConfig]);

    // Synchronize editDetails with details when details change
    useEffect(() => {
        setEditFolderConfig(folderConfig);
    }, [folderConfig]);

    return (
        <Grid2 container size={12} padding={2} spacing={1} component={ListItemPaper} >
            <Grid2 size={12} display="flex" justifyContent="space-evenly" height={"10%"}>
                <ActionButton
                    text="Open"
                    size="large"
                    tooltip="Open Folder"
                    color="primary"
                    disabled={(focusedFolder === null)}
                    endIcon={<OpenInNewRounded />}
                    onClick={(focusedFolder === null) ? () => { } : () => { handleOpenFolder(focusedFolder) }}
                />
                <ActionButton
                    text="Edit"
                    size="large"
                    color="secondary"
                    variant="outlined"
                    tooltip="Edit Folder Configuration"
                    endIcon={<EditRounded />}
                    onClick={() => { setIsSaveDialogOpen(true); }}
                />
                <ActionButton
                    text="New"
                    size="large"
                    color="secondary"
                    variant="outlined"
                    tooltip="Register New Folder"
                    endIcon={<CreateNewFolder />}
                    onClick={() => { }}
                />
            </Grid2>
            <Grid2 size={12} height={"90%"}>
                <FolderDescription folderConfig={folderConfig} />
                <StandardDialog
                    title="test"
                    isOpen={isSaveDialogOpen}
                    isLoading={isSaving}
                    handleClose={handleCloseEdit}
                    handleConfirm={handleSave}
                >
                    <Box>
                        <TextField
                            label="Local Path"
                            value={editFolderConfig.local_path}
                            disabled={!isNewSave}
                            onChange={(e) => handleInputChange("local_path", e.target.value)}
                            fullWidth
                            margin="normal"
                        />
                        <TextField
                            label="Description"
                            value={editFolderConfig.description}
                            onChange={(e) => handleInputChange("description", e.target.value)}
                            fullWidth
                            multiline
                            rows={3}
                            margin="normal"
                        />
                    </Box>
                </StandardDialog>
            </Grid2>
        </Grid2 >

    )
}

export default FolderManagementControls;