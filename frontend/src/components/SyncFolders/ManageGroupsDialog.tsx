import { useMemo, useState } from "react";
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    IconButton,
    InputLabel,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    MenuItem,
    Select,
    SelectChangeEvent,
    TextField,
    Typography,
} from "@mui/material";
import { Add, Delete, Edit, FolderOpen } from "@mui/icons-material";
import { FolderService } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend";
import { GroupConfig, ProjectConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models";
import { useProjectConfig } from "../../hooks/ProjectConfigContext";

interface ManageGroupsDialogProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

// Helper to build a hierarchical label for nested groups
function getGroupDisplayLabel(
    groupKey: string,
    groups: Record<string, GroupConfig>,
    excludeKey?: string
): string {
    const group = groups[groupKey];
    if (!group) return groupKey;

    const parts: string[] = [group.name];
    let current = group.parent_group;

    while (current && groups[current] && current !== excludeKey) {
        parts.unshift(groups[current].name);
        current = groups[current].parent_group;
    }

    return parts.join(" > ");
}

// Get indentation level for a group
function getIndentLevel(groupKey: string, groups: Record<string, GroupConfig>): number {
    let level = 0;
    let current = groups[groupKey]?.parent_group;
    while (current && groups[current]) {
        level++;
        current = groups[current].parent_group;
    }
    return level;
}

// Sort groups hierarchically
function getSortedGroupsHierarchical(groups: Record<string, GroupConfig>): string[] {
    const result: string[] = [];
    const visited = new Set<string>();

    const addGroup = (key: string, depth: number) => {
        if (visited.has(key)) return;
        visited.add(key);
        result.push(key);

        // Find children and add them
        Object.entries(groups)
            .filter(([, g]) => g.parent_group === key)
            .sort(([, a], [, b]) => {
                if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
                return a.name.localeCompare(b.name);
            })
            .forEach(([childKey]) => addGroup(childKey, depth + 1));
    };

    // Start with root groups
    Object.entries(groups)
        .filter(([, g]) => !g.parent_group)
        .sort(([, a], [, b]) => {
            if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
            return a.name.localeCompare(b.name);
        })
        .forEach(([key]) => addGroup(key, 0));

    return result;
}

const ManageGroupsDialog: React.FC<ManageGroupsDialogProps> = ({ isOpen, setIsOpen }) => {
    const { projectConfig, setProjectConfig } = useProjectConfig();

    // Get available groups from project config
    const availableGroups = useMemo(() => {
        return projectConfig?.groups ?? {};
    }, [projectConfig?.groups]);

    const sortedGroupKeys = useMemo(() => {
        return getSortedGroupsHierarchical(availableGroups);
    }, [availableGroups]);

    // Count folders in each group
    const folderCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        Object.values(projectConfig?.folders ?? {}).forEach((folder) => {
            if (folder.group) {
                counts[folder.group] = (counts[folder.group] || 0) + 1;
            }
        });
        return counts;
    }, [projectConfig?.folders]);

    // Count child groups for each group
    const childGroupCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        Object.values(availableGroups).forEach((group) => {
            if (group.parent_group) {
                counts[group.parent_group] = (counts[group.parent_group] || 0) + 1;
            }
        });
        return counts;
    }, [availableGroups]);

    // Dialog state
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null);

    // Form state
    const [newGroupName, setNewGroupName] = useState("");
    const [newGroupParent, setNewGroupParent] = useState("");
    const [newGroupSortOrder, setNewGroupSortOrder] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleClose = () => {
        setIsOpen(false);
        setError(null);
    };

    const handleOpenAdd = () => {
        setNewGroupName("");
        setNewGroupParent("");
        setNewGroupSortOrder(0);
        setError(null);
        setIsAddDialogOpen(true);
    };

    const handleOpenEdit = (groupKey: string) => {
        const group = availableGroups[groupKey];
        if (group) {
            setEditingGroupKey(groupKey);
            setNewGroupName(group.name);
            setNewGroupParent(group.parent_group || "");
            setNewGroupSortOrder(group.sort_order || 0);
            setError(null);
            setIsEditDialogOpen(true);
        }
    };

    const handleAddGroup = async () => {
        if (!newGroupName.trim()) return;

        try {
            setIsLoading(true);
            setError(null);

            // Generate a key from the name
            const groupKey = newGroupName
                .trim()
                .toLowerCase()
                .replace(/\s+/g, "-")
                .replace(/[^a-z0-9-]/g, "");

            const groupConfig = new GroupConfig({
                name: newGroupName.trim(),
                parent_group: newGroupParent || "",
                sort_order: newGroupSortOrder,
            });

            const updatedConfig: ProjectConfig = await FolderService.CreateGroup(groupKey, groupConfig);
            setProjectConfig(updatedConfig);
            setIsAddDialogOpen(false);
            setNewGroupName("");
            setNewGroupParent("");
            setNewGroupSortOrder(0);
        } catch (e: any) {
            setError(e.message || "Failed to create group");
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditGroup = async () => {
        if (!editingGroupKey || !newGroupName.trim()) return;

        try {
            setIsLoading(true);
            setError(null);

            const groupConfig = new GroupConfig({
                name: newGroupName.trim(),
                parent_group: newGroupParent || "",
                sort_order: newGroupSortOrder,
            });

            const updatedConfig: ProjectConfig = await FolderService.UpdateGroup(editingGroupKey, groupConfig);
            setProjectConfig(updatedConfig);
            setIsEditDialogOpen(false);
            setEditingGroupKey(null);
            setNewGroupName("");
            setNewGroupParent("");
            setNewGroupSortOrder(0);
        } catch (e: any) {
            setError(e.message || "Failed to update group");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteGroup = async (groupKey: string) => {
        try {
            setIsLoading(true);
            setError(null);

            const updatedConfig: ProjectConfig = await FolderService.DeleteGroup(groupKey);
            setProjectConfig(updatedConfig);
        } catch (e: any) {
            setError(e.message || "Failed to delete group");
        } finally {
            setIsLoading(false);
        }
    };

    const handleParentChange = (event: SelectChangeEvent<string>) => {
        setNewGroupParent(event.target.value);
    };

    // Get valid parent options (exclude self and descendants when editing)
    const getValidParentOptions = () => {
        if (!editingGroupKey) return sortedGroupKeys;

        const invalidKeys = new Set<string>([editingGroupKey]);

        // Find all descendants of the editing group
        const findDescendants = (key: string) => {
            Object.entries(availableGroups).forEach(([k, g]) => {
                if (g.parent_group === key && !invalidKeys.has(k)) {
                    invalidKeys.add(k);
                    findDescendants(k);
                }
            });
        };
        findDescendants(editingGroupKey);

        return sortedGroupKeys.filter((k) => !invalidKeys.has(k));
    };

    return (
        <>
            <Dialog open={isOpen} onClose={handleClose} maxWidth="sm" fullWidth>
                <DialogTitle>Manage Groups</DialogTitle>
                <DialogContent>
                    {error && (
                        <Typography color="error" sx={{ mb: 2 }}>
                            {error}
                        </Typography>
                    )}

                    {sortedGroupKeys.length === 0 ? (
                        <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                            No groups yet. Create your first group to organize folders.
                        </Typography>
                    ) : (
                        <List dense>
                            {sortedGroupKeys.map((groupKey) => {
                                const group = availableGroups[groupKey];
                                const indentLevel = getIndentLevel(groupKey, availableGroups);
                                const folderCount = folderCounts[groupKey] || 0;
                                const childCount = childGroupCounts[groupKey] || 0;
                                const canDelete = folderCount === 0 && childCount === 0;

                                return (
                                    <ListItem
                                        key={groupKey}
                                        sx={{ pl: indentLevel * 3 }}
                                        secondaryAction={
                                            <Box>
                                                <IconButton
                                                    edge="end"
                                                    size="small"
                                                    onClick={() => handleOpenEdit(groupKey)}
                                                    title="Edit group"
                                                >
                                                    <Edit fontSize="small" />
                                                </IconButton>
                                                <IconButton
                                                    edge="end"
                                                    size="small"
                                                    onClick={() => handleDeleteGroup(groupKey)}
                                                    disabled={!canDelete || isLoading}
                                                    title={
                                                        canDelete
                                                            ? "Delete group"
                                                            : `Cannot delete: ${folderCount} folders, ${childCount} child groups`
                                                    }
                                                >
                                                    <Delete fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        }
                                    >
                                        <ListItemIcon sx={{ minWidth: 36 }}>
                                            <FolderOpen color="primary" fontSize="small" />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={group.name}
                                            secondary={`${folderCount} folder${folderCount !== 1 ? "s" : ""}`}
                                        />
                                    </ListItem>
                                );
                            })}
                        </List>
                    )}

                    <Divider sx={{ my: 2 }} />

                    <Button
                        variant="outlined"
                        startIcon={<Add />}
                        onClick={handleOpenAdd}
                        fullWidth
                    >
                        Add New Group
                    </Button>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Add Group Dialog */}
            <Dialog
                open={isAddDialogOpen}
                onClose={() => setIsAddDialogOpen(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>Add New Group</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        label="Group Name"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        fullWidth
                        margin="normal"
                        autoComplete="off"
                    />
                    <FormControl fullWidth margin="normal">
                        <InputLabel id="parent-group-label">Parent Group (optional)</InputLabel>
                        <Select
                            labelId="parent-group-label"
                            value={newGroupParent}
                            label="Parent Group (optional)"
                            onChange={handleParentChange}
                        >
                            <MenuItem value="">
                                <em>None (top-level)</em>
                            </MenuItem>
                            {sortedGroupKeys.map((key) => (
                                <MenuItem key={key} value={key}>
                                    {getGroupDisplayLabel(key, availableGroups)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField
                        label="Sort Order"
                        type="number"
                        value={newGroupSortOrder}
                        onChange={(e) => setNewGroupSortOrder(parseInt(e.target.value) || 0)}
                        fullWidth
                        margin="normal"
                        helperText="Lower numbers appear first. Groups with same order are sorted alphabetically."
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsAddDialogOpen(false)} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAddGroup}
                        variant="contained"
                        disabled={!newGroupName.trim() || isLoading}
                    >
                        {isLoading ? "Creating..." : "Create"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit Group Dialog */}
            <Dialog
                open={isEditDialogOpen}
                onClose={() => setIsEditDialogOpen(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>Edit Group</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        label="Group Name"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        fullWidth
                        margin="normal"
                        autoComplete="off"
                    />
                    <FormControl fullWidth margin="normal">
                        <InputLabel id="edit-parent-group-label">Parent Group</InputLabel>
                        <Select
                            labelId="edit-parent-group-label"
                            value={newGroupParent}
                            label="Parent Group"
                            onChange={handleParentChange}
                        >
                            <MenuItem value="">
                                <em>None (top-level)</em>
                            </MenuItem>
                            {getValidParentOptions().map((key) => (
                                <MenuItem key={key} value={key}>
                                    {getGroupDisplayLabel(key, availableGroups, editingGroupKey ?? undefined)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField
                        label="Sort Order"
                        type="number"
                        value={newGroupSortOrder}
                        onChange={(e) => setNewGroupSortOrder(parseInt(e.target.value) || 0)}
                        fullWidth
                        margin="normal"
                        helperText="Lower numbers appear first. Groups with same order are sorted alphabetically."
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsEditDialogOpen(false)} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleEditGroup}
                        variant="contained"
                        disabled={!newGroupName.trim() || isLoading}
                    >
                        {isLoading ? "Saving..." : "Save"}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default ManageGroupsDialog;
