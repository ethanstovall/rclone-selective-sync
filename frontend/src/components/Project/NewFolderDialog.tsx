import { useEffect, useMemo, useState } from "react";
import { FolderConfig, ProjectConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models";
import StandardDialog from "../common/StandardDialog";
import { Box, InputAdornment, TextField } from "@mui/material";
import { useGlobalConfig } from "../../hooks/GlobalConfigContext";
import ActionIconButton from "../common/ActionIconButton";
import { FolderService } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend";
import { OpenInNewRounded } from "@mui/icons-material";
import { useProjectConfig } from "../../hooks/ProjectConfigContext";

interface NewFolderDialogProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

const NewFolderDialog: React.FC<NewFolderDialogProps> = ({ isOpen, setIsOpen }) => {
    useEffect(() => {
        console.warn("rerender");
    })

    // Global config state
    const { globalConfig, selectedProject } = useGlobalConfig();
    const localRoot = useMemo(() => {
        if (globalConfig === undefined || selectedProject === undefined) {
            return undefined;
        }
        return globalConfig.remotes[selectedProject].local_path;
    }, [globalConfig, selectedProject]);

    // Project config state
    const { setProjectConfig } = useProjectConfig();

    // Action state
    const [isSaving, setIsSaving] = useState<boolean>(false);

    // Input state
    const [newFolderConfig, setNewFolderConfig] = useState<FolderConfig>(new FolderConfig());
    // The folder name is the key in the ProjectConfig.folders map, so we have to store it separately.
    const [newFolderName, setNewFolderName] = useState<string>("");

    const handleInputChange = (field: keyof FolderConfig, value: string) => {
        // Create a new instance with the updated field
        const updatedConfig = new FolderConfig({
            ...newFolderConfig,
            [field]: value,
        });
        setNewFolderConfig(updatedConfig);
    };


    const handleClose = () => {
        setNewFolderConfig(new FolderConfig()); // Revert changes
        setNewFolderName("");
        setIsOpen(false);
    };

    const handleConfirm = async () => {
        try {
            setIsSaving(true);
            await FolderService.RegisterNewFolder(newFolderName, newFolderConfig);
            // Update the local project configuration state
            setProjectConfig((prev: ProjectConfig | undefined) => {
                if (!prev) {
                    throw new Error("Project configuration is not available.");
                }

                // Add the new folder configuration to the existing project config
                return new ProjectConfig({
                    ...prev, // Spread all other properties of ProjectConfig
                    folders: {
                        ...prev.folders,
                        [newFolderName]: newFolderConfig, // Add the new folder configuration
                    },
                });
            });
        } catch (e: any) {
            console.error("Error while saving new folder:", e);
        } finally {
            setIsSaving(false);
            handleClose();
        }
    };

    // Open the selected folder in the user's file explorer
    const handleOpenFolder = async (targetFolder: string) => {
        try {
            await FolderService.OpenFolder(targetFolder)
        } catch (e: any) {
            console.error(e);
        }
    }

    return (
        <StandardDialog
            title={"Register New Folder"}
            isOpen={isOpen}
            isLoading={isSaving}
            handleClose={handleClose}
            handleConfirm={handleConfirm}
        >
            <Box>
                <TextField
                    label="Folder Name"
                    id="folder-name"
                    value={newFolderName}
                    onChange={(event) => setNewFolderName(event.target.value)}
                    fullWidth
                    margin="normal"
                    autoComplete="off"
                />
                <TextField
                    label="Local Path"
                    id="local-folder-path"
                    value={newFolderConfig.local_path ?? localRoot}
                    onChange={(event) => handleInputChange("local_path", event.target.value)}
                    fullWidth
                    margin="normal"
                    autoComplete="off"
                    slotProps={{
                        input: {
                            startAdornment:
                                <InputAdornment position="start">
                                    <ActionIconButton
                                        color="primary"
                                        inputIcon={OpenInNewRounded}
                                        onClick={() => { handleOpenFolder("") }}
                                    />{`${localRoot}/`}
                                </InputAdornment>,
                        },
                    }}
                />
                <TextField
                    label="Description"
                    id="description"
                    value={newFolderConfig.description}
                    onChange={(event) => handleInputChange("description", event.target.value)}
                    fullWidth
                    multiline
                    rows={3}
                    margin="normal"
                    autoComplete="off"
                />
            </Box>
        </StandardDialog>

    )
}

export default NewFolderDialog;