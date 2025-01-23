import { useMemo, useState } from "react";
import { FolderConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models";
import StandardDialog from "../common/StandardDialog";
import { Box, InputAdornment, TextField } from "@mui/material";
import { useGlobalConfig } from "../../hooks/GlobalConfigContext";
import ActionIconButton from "../common/ActionIconButton";
import { FolderService } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend";
import { OpenInNewRounded } from "@mui/icons-material";

interface NewFolderDialogProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    setLocalFolders: (localFolders: string[]) => void;
}

const NewFolderDialog: React.FC<NewFolderDialogProps> = ({ isOpen, setIsOpen, setLocalFolders }) => {
    // Global config state
    const { globalConfig, selectedProject } = useGlobalConfig();
    const localRoot = useMemo(() => {
        if (globalConfig === undefined || selectedProject === undefined) {
            return undefined;
        }
        return globalConfig.remotes[selectedProject].local_path;
    }, [globalConfig, selectedProject]);

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
        console.log(updatedConfig);
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
            const updatedLocalFolders = await FolderService.GetLocalFolders();
            setLocalFolders(updatedLocalFolders);
        } catch (e: any) {
            console.error(e);
        } finally {
            setIsSaving(false);
            setIsOpen(false);
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
                />
                <TextField
                    label="Local Path"
                    id="local-folder-path"
                    value={newFolderConfig.local_path ?? localRoot}
                    onChange={(event) => handleInputChange("local_path", event.target.value)}
                    fullWidth
                    margin="normal"
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
                />
            </Box>
        </StandardDialog>

    )
}

export default NewFolderDialog;