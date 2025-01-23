import { Box, Grid2, TextField } from "@mui/material";
import { FolderService, FolderConfig, ProjectConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend";
import ActionButton from "../common/ActionButton";
import { Delete, EditRounded, OpenInNewRounded } from "@mui/icons-material";
import React, { useEffect, useMemo, useState } from "react";
import ListItemPaper from "../common/ListItemPaper";
import FolderDescription from "./FolderDescription";
import StandardDialog from "../common/StandardDialog";
import { useProjectConfig } from "../../hooks/ProjectConfigContext";

interface FocusedFolderControls {
    focusedFolder: string | null;
    localFolders: string[];
    projectConfig: ProjectConfig;
};

const FocusedFolderControls: React.FC<FocusedFolderControls> = (
    {
        focusedFolder,
        localFolders,
        projectConfig,
    }
) => {
    // Project config state from context
    const { setProjectConfig } = useProjectConfig();

    // Action state
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);

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

    // Save the edited folder configuration
    const handleSaveEdits = async () => {
        try {
            if (focusedFolder == undefined) {
                // Don't proceed if this is not defined or empty. This should never happen.
                throw new Error(`Focused folder is not defined or empty. Value is: ${focusedFolder}`)
            }
            setIsSaving(true);
            // Trim any trailing whitespace from the edited folder name.
            const trimmedEditedFolderName = editedFolderName.trim()
            await FolderService.EditFolder(focusedFolder, trimmedEditedFolderName, editedFolderConfig)
            setProjectConfig((prev: ProjectConfig | undefined) => {
                if (!prev) {
                    throw new Error("Project configuration is not available.");
                }

                // Add the new folder configuration to the existing project config
                return new ProjectConfig({
                    ...prev, // Spread all other properties of ProjectConfig
                    folders: {
                        ...prev.folders,
                        // There's a slight risk in accepting the folder config edited in the app state to the parent
                        // project config, but we control the inputs enough so that it's easier to just do
                        // that than it is to take a return from the backend. Also note that the backend does not
                        // modify the FolderConfig object passed to it. If it did, we'd need to only reset the state
                        // with an updated/modified copy from the backend.
                        [trimmedEditedFolderName]: editedFolderConfig,
                    },
                });
            });
        } catch (e: any) {
            console.error(e);
        } finally {
            setIsSaving(false);
            setIsSaveDialogOpen(false);
        }

    }

    // Pull the current folder details
    const folderConfig = useMemo(() => {
        if (!focusedFolder || !projectConfig?.folders) {
            return new FolderConfig();
        }
        return projectConfig.folders[focusedFolder];
    }, [focusedFolder, projectConfig]);

    // The user can't save under the following conditions.
    const canSaveEdit = useMemo(() => (editedFolderName !== ""), [editedFolderName])

    // Synchronize editDetails with details when details change
    useEffect(() => {
        setEditedFolderConfig(folderConfig);
    }, [folderConfig]);

    useEffect(() => {
        setEditedFolderName(focusedFolder || "");
    }, [focusedFolder])

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
                <ActionButton
                    text="Deregister"
                    size="large"
                    color="secondary"
                    variant="outlined"
                    tooltip="Deregister Folder"
                    disabled={(focusedFolder === null)}
                    endIcon={<Delete />}
                    onClick={() => { setIsSaveDialogOpen(true); }}
                />
            </Grid2>
            <Grid2 size={12} height={"90%"}>
                <FolderDescription folderConfig={folderConfig} />
                <StandardDialog
                    title={`Edit Configuration for "${focusedFolder}"`}
                    isOpen={isSaveDialogOpen}
                    isLoading={isSaving}
                    isDisabled={!canSaveEdit}
                    handleClose={handleCloseEdit}
                    handleConfirm={handleSaveEdits}
                >
                    <Box>
                        <TextField
                            label="Folder Name"
                            value={editedFolderName}
                            onChange={(event) => setEditedFolderName(event.target.value)}
                            helperText={!editedFolderName.trim() ? "Please enter a folder name." : ""}
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

export default FocusedFolderControls;