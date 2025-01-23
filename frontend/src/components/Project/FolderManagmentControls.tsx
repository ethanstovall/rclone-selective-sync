import { Box, Grid2, TextField } from "@mui/material";
import { FolderService, FolderConfig, ProjectConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend";
import ActionButton from "../common/ActionButton";
import { EditRounded, OpenInNewRounded } from "@mui/icons-material";
import React, { useEffect, useMemo, useState } from "react";
import ListItemPaper from "../common/ListItemPaper";
import FolderDescription from "./FolderDescription";
import StandardDialog from "../common/StandardDialog";

interface FolderManagementControls {
    focusedFolder: string | null;
    localFolders: string[];
    projectConfig: ProjectConfig;
};

const FolderManagementControls: React.FC<FolderManagementControls> = (
    {
        focusedFolder,
        localFolders,
        projectConfig,
    }
) => {
    useEffect(() => {
        console.warn("rendered fmc")
    }, []);

    // Action state
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState<boolean>(false);
    const [isSaving, _setIsSaving] = useState<boolean>(false);

    // Input state
    const [editedFolderConfig, setEditedFolderConfig] = useState<FolderConfig>(new FolderConfig());
    // The folder name is the key in the ProjectConfig.folders map, so we have to store it separately.
    const [editedFolderName, setEditedFolderName] = useState<string>(focusedFolder ?? "");

    const handleInputChange = (field: keyof FolderConfig, value: string) => {
        // Create a new instance with the updated field
        const updatedConfig = new FolderConfig({
            ...editedFolderConfig,
            [field]: value,
        });
        setEditedFolderConfig(updatedConfig);
    };

    const handleCloseEdit = () => {
        setEditedFolderConfig(folderConfig); // Revert changes
        setEditedFolderName(focusedFolder ?? "");
        setIsSaveDialogOpen(false);
    };

    // Open the selected folder in the user's file explorer
    const handleOpenFolder = async (targetFolder: string) => {
        try {
            await FolderService.OpenFolder(targetFolder)
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
        setEditedFolderConfig(folderConfig);
    }, [folderConfig]);

    return (
        <Grid2 container size={12} padding={2} spacing={1} component={ListItemPaper} >
            <Grid2 size={12} display="flex" justifyContent="space-evenly" height={"10%"}>
                <ActionButton
                    text="Open"
                    size="large"
                    tooltip="Open Folder"
                    color="primary"
                    disabled={focusedFolder === null || !localFolders.includes(focusedFolder)}
                    endIcon={<OpenInNewRounded />}
                    onClick={(focusedFolder === null || !localFolders.includes(focusedFolder)) ? () => { } : () => { handleOpenFolder(focusedFolder) }}
                />
                <ActionButton
                    text="Edit"
                    size="large"
                    color="secondary"
                    variant="outlined"
                    tooltip="Edit Folder Configuration"
                    disabled={(focusedFolder === null)}
                    endIcon={<EditRounded />}
                    onClick={() => { setIsSaveDialogOpen(true); }}
                />
            </Grid2>
            <Grid2 size={12} height={"90%"}>
                <FolderDescription folderConfig={folderConfig} />
                <StandardDialog
                    title={`Edit Configuration for "${focusedFolder}"`}
                    isOpen={isSaveDialogOpen}
                    isLoading={isSaving}
                    handleClose={handleCloseEdit}
                    handleConfirm={() => { }}
                >
                    <Box>
                        <TextField
                            label="Folder Name"
                            value={editedFolderName}
                            onChange={(event) => setEditedFolderName(event.target.value)}
                            fullWidth
                            margin="normal"
                        />
                        <TextField
                            label="Description"
                            value={editedFolderConfig.description}
                            onChange={(event) => handleInputChange("description", event.target.value)}
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