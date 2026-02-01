import { useMemo, useState } from "react";
import { FolderConfig, ProjectConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models";
import StandardDialog from "../common/StandardDialog";
import { Box, InputAdornment, TextField } from "@mui/material";
import { useGlobalConfig } from "../../hooks/GlobalConfigContext";
import ActionIconButton from "../common/ActionIconButton";
import ActionButton from "../common/ActionButton";
import { FolderService } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend";
import { OpenInNewRounded } from "@mui/icons-material";
import { useProjectConfig } from "../../hooks/ProjectConfigContext";

interface NewFolderDialogProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

const NewFolderDialog: React.FC<NewFolderDialogProps> = ({ isOpen, setIsOpen }) => {
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
    const [isBrowsing, setIsBrowsing] = useState<boolean>(false);
    const [browseError, setBrowseError] = useState<string | null>(null);

    // Input state
    const [newFolderConfig, setNewFolderConfig] = useState<FolderConfig>(new FolderConfig());
    // The folder name is the key in the ProjectConfig.folders map, so we have to store it separately.
    const [newFolderName, setNewFolderName] = useState<string>("");

    // The user can't save under the following conditions.
    const canSaveEdit = useMemo(() => (newFolderName !== ""), [newFolderName]);

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
        setBrowseError(null);
        setIsOpen(false);
    };

    const handleConfirm = async () => {
        try {
            setIsSaving(true);
            const trimmedNewFolderName = newFolderName.trim()
            const updatedProjectConfig: ProjectConfig = await FolderService.RegisterNewFolder(trimmedNewFolderName, newFolderConfig);
            // Update the local project configuration state
            setProjectConfig(updatedProjectConfig);
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

    // Open native folder picker dialog
    const handleBrowseFolder = async () => {
        setIsBrowsing(true);
        setBrowseError(null);
        try {
            const selectedPath = await FolderService.OpenFolderPicker();

            if (selectedPath) {
                // Update the local_path with selected folder
                handleInputChange("local_path", selectedPath);

                // Auto-fill folder name if empty (use last path segment)
                if (!newFolderName.trim()) {
                    const folderName = selectedPath.split('/').pop() || '';
                    setNewFolderName(folderName);
                }
            }
            // If empty string, user cancelled - do nothing
        } catch (e: any) {
            console.error("Error selecting folder:", e);
            setBrowseError(e.message || "Failed to select folder");
        } finally {
            setIsBrowsing(false);
        }
    }

    return (
        <StandardDialog
            title={"Register New Folder"}
            isOpen={isOpen}
            isLoading={isSaving}
            handleClose={handleClose}
            handleConfirm={handleConfirm}
            isDisabled={!canSaveEdit}
        >
            <Box>
                <TextField
                    label="Folder Name"
                    id="folder-name"
                    value={newFolderName}
                    onChange={(event) => setNewFolderName(event.target.value)}
                    helperText={!newFolderName.trim() ? "Please enter a folder name." : ""}
                    fullWidth
                    margin="normal"
                    autoComplete="off"
                />
                <TextField
                    label="Local Path"
                    id="local-folder-path"
                    value={newFolderConfig.local_path || ""}
                    onChange={(event) => handleInputChange("local_path", event.target.value)}
                    error={!!browseError}
                    helperText={browseError || `Relative to project root: ${localRoot}/`}
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
                                        tooltip="Open project folder"
                                        onClick={() => { handleOpenFolder("") }}
                                    />
                                </InputAdornment>,
                            endAdornment:
                                <InputAdornment position="end">
                                    <ActionButton
                                        text="Browse..."
                                        variant="outlined"
                                        size="small"
                                        loading={isBrowsing}
                                        disabled={isBrowsing}
                                        onClick={handleBrowseFolder}
                                    />
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