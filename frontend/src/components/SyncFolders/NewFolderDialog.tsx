import { useMemo, useState } from "react";
import { FolderConfig, GroupConfig, ProjectConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models";
import StandardDialog from "../common/StandardDialog";
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    InputAdornment,
    InputLabel,
    ListItemIcon,
    ListItemText,
    MenuItem,
    Select,
    SelectChangeEvent,
    TextField,
} from "@mui/material";
import { useGlobalConfig } from "../../hooks/GlobalConfigContext";
import ActionIconButton from "../common/ActionIconButton";
import ActionButton from "../common/ActionButton";
import { FolderService } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend";
import { Add, OpenInNewRounded } from "@mui/icons-material";
import { useProjectConfig } from "../../hooks/ProjectConfigContext";

interface NewFolderDialogProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

// Helper to build a hierarchical label for nested groups
function getGroupDisplayLabel(
    groupKey: string,
    groups: Record<string, GroupConfig>
): string {
    const group = groups[groupKey];
    if (!group) return groupKey;

    const parts: string[] = [group.name];
    let current = group.parent_group;

    while (current && groups[current]) {
        parts.unshift(groups[current].name);
        current = groups[current].parent_group;
    }

    return parts.join(" > ");
}

// Helper to get sorted group keys for display
function getSortedGroupKeys(groups: Record<string, GroupConfig>): string[] {
    return Object.keys(groups).sort((a, b) => {
        const labelA = getGroupDisplayLabel(a, groups);
        const labelB = getGroupDisplayLabel(b, groups);
        return labelA.localeCompare(labelB);
    });
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
    const { projectConfig, setProjectConfig } = useProjectConfig();

    // Get available groups from project config
    const availableGroups = useMemo(() => {
        return projectConfig?.groups ?? {};
    }, [projectConfig?.groups]);

    const sortedGroupKeys = useMemo(() => {
        return getSortedGroupKeys(availableGroups);
    }, [availableGroups]);

    // Action state
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [isBrowsing, setIsBrowsing] = useState<boolean>(false);
    const [browseError, setBrowseError] = useState<string | null>(null);

    // New group dialog state
    const [isNewGroupDialogOpen, setIsNewGroupDialogOpen] = useState<boolean>(false);
    const [newGroupName, setNewGroupName] = useState<string>("");
    const [isCreatingGroup, setIsCreatingGroup] = useState<boolean>(false);

    // Input state
    const [newFolderConfig, setNewFolderConfig] = useState<FolderConfig>(new FolderConfig());
    // The folder name is the key in the ProjectConfig.folders map, so we have to store it separately.
    const [newFolderName, setNewFolderName] = useState<string>("");

    // The user can't save under the following conditions.
    const canSaveEdit = useMemo(
        () => newFolderName.trim() !== "" && newFolderConfig.group !== "",
        [newFolderName, newFolderConfig.group]
    );

    const handleInputChange = (field: keyof FolderConfig, value: string) => {
        // Create a new instance with the updated field
        const updatedConfig = new FolderConfig({
            ...newFolderConfig,
            [field]: value,
        });
        setNewFolderConfig(updatedConfig);
    };

    const handleGroupChange = (event: SelectChangeEvent<string>) => {
        const value = event.target.value;
        if (value === "__create_new__") {
            setIsNewGroupDialogOpen(true);
        } else {
            handleInputChange("group", value);
        }
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
            const trimmedNewFolderName = newFolderName.trim();
            const updatedProjectConfig: ProjectConfig = await FolderService.RegisterNewFolder(
                trimmedNewFolderName,
                newFolderConfig
            );
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
            await FolderService.OpenFolder(targetFolder);
        } catch (e: any) {
            console.error(e);
        }
    };

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
                    const folderName = selectedPath.split("/").pop() || "";
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
    };

    // Create a new group
    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return;

        try {
            setIsCreatingGroup(true);
            // Generate a key from the name (lowercase, replace spaces with hyphens)
            const groupKey = newGroupName
                .trim()
                .toLowerCase()
                .replace(/\s+/g, "-")
                .replace(/[^a-z0-9-]/g, "");

            const groupConfig = new GroupConfig({
                name: newGroupName.trim(),
                parent_group: "",
                sort_order: 0,
            });

            const updatedConfig = await FolderService.CreateGroup(groupKey, groupConfig);
            setProjectConfig(updatedConfig);

            // Select the newly created group
            handleInputChange("group", groupKey);
        } catch (e: any) {
            console.error("Error creating group:", e);
        } finally {
            setIsCreatingGroup(false);
            setIsNewGroupDialogOpen(false);
            setNewGroupName("");
        }
    };

    return (
        <>
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
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <ActionIconButton
                                            color="primary"
                                            inputIcon={OpenInNewRounded}
                                            tooltip="Open project folder"
                                            onClick={() => {
                                                handleOpenFolder("");
                                            }}
                                        />
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <ActionButton
                                            text="Browse..."
                                            variant="outlined"
                                            size="small"
                                            loading={isBrowsing}
                                            disabled={isBrowsing}
                                            onClick={handleBrowseFolder}
                                        />
                                    </InputAdornment>
                                ),
                            },
                        }}
                    />
                    <FormControl fullWidth margin="normal" required>
                        <InputLabel id="group-select-label">Group</InputLabel>
                        <Select
                            labelId="group-select-label"
                            id="group-select"
                            value={newFolderConfig.group || ""}
                            label="Group"
                            onChange={handleGroupChange}
                        >
                            {sortedGroupKeys.map((groupKey) => (
                                <MenuItem key={groupKey} value={groupKey}>
                                    <ListItemText
                                        primary={getGroupDisplayLabel(groupKey, availableGroups)}
                                    />
                                </MenuItem>
                            ))}
                            {sortedGroupKeys.length > 0 && <Divider />}
                            <MenuItem value="__create_new__">
                                <ListItemIcon>
                                    <Add fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary="Create new group..." />
                            </MenuItem>
                        </Select>
                    </FormControl>
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

            {/* Create New Group Dialog */}
            <Dialog
                open={isNewGroupDialogOpen}
                onClose={() => setIsNewGroupDialogOpen(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>Create New Group</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        label="Group Name"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        fullWidth
                        margin="normal"
                        autoComplete="off"
                        helperText="Enter a name for the new folder group"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsNewGroupDialogOpen(false)} disabled={isCreatingGroup}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateGroup}
                        variant="contained"
                        disabled={!newGroupName.trim() || isCreatingGroup}
                    >
                        {isCreatingGroup ? "Creating..." : "Create"}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default NewFolderDialog;
