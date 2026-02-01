import { useMemo, useState, useCallback } from "react";
import {
    FolderConfig,
    GroupConfig,
    ProjectConfig,
} from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models";
import { FolderService } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend";
import {
    Box,
    Button,
    Checkbox,
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
} from "@mui/material";
import ListItemPaper from "../common/ListItemPaper";
import FullHeightSkeleton from "../common/FullHeightSkeleton";
import {
    ExpandLess,
    ExpandMore,
    Circle,
    CheckCircle,
    RadioButtonUnchecked,
    FolderOpen,
    Download,
    OpenInNewRounded,
} from "@mui/icons-material";
import { CircularProgress } from "@mui/material";

// Helper types for building the tree structure
interface GroupNode {
    key: string;
    config: GroupConfig;
    children: GroupNode[];
    folders: { key: string; config: FolderConfig }[];
}

interface GroupedFolderTreeProps {
    projectConfig: ProjectConfig | undefined;
    localFolders: string[];
    changedFolders: string[];
    downloadingFolders: string[];
    isLoadingLocalFolders: boolean;
    searchTerm: string;
    targetFolders: string[];
    focusedFolder: string | null;
    setFocusedFolder: (folderName: string | null) => void;
    setTargetFolders: (targetFolders: string[]) => void;
    onDownloadFolder: (folderKey: string) => void;
}

// Build a hierarchical tree from flat groups/folders data
function buildGroupTree(
    groups: Record<string, GroupConfig>,
    folders: Record<string, FolderConfig>
): GroupNode[] {
    const groupNodes: Record<string, GroupNode> = {};

    // Create nodes for all groups
    Object.entries(groups).forEach(([key, config]) => {
        groupNodes[key] = {
            key,
            config,
            children: [],
            folders: [],
        };
    });

    // Assign folders to their groups
    Object.entries(folders).forEach(([folderKey, folderConfig]) => {
        const groupKey = folderConfig.group;
        if (groupKey && groupNodes[groupKey]) {
            groupNodes[groupKey].folders.push({ key: folderKey, config: folderConfig });
        }
    });

    // Build parent-child relationships
    const rootNodes: GroupNode[] = [];
    Object.values(groupNodes).forEach((node) => {
        const parentKey = node.config.parent_group;
        if (parentKey && groupNodes[parentKey]) {
            groupNodes[parentKey].children.push(node);
        } else {
            rootNodes.push(node);
        }
    });

    // Sort groups by sort_order, then alphabetically
    const sortGroups = (nodes: GroupNode[]) => {
        nodes.sort((a, b) => {
            if (a.config.sort_order !== b.config.sort_order) {
                return a.config.sort_order - b.config.sort_order;
            }
            return a.config.name.localeCompare(b.config.name);
        });
        nodes.forEach((node) => sortGroups(node.children));
    };
    sortGroups(rootNodes);

    // Sort folders alphabetically within each group
    Object.values(groupNodes).forEach((node) => {
        node.folders.sort((a, b) => a.key.localeCompare(b.key));
    });

    return rootNodes;
}

// Filter tree based on search term
function filterTree(
    nodes: GroupNode[],
    searchTerm: string
): GroupNode[] {
    if (!searchTerm.trim()) return nodes;

    const term = searchTerm.toLowerCase();

    const filterNode = (node: GroupNode): GroupNode | null => {
        // Filter folders that match
        const matchingFolders = node.folders.filter(
            (f) =>
                f.key.toLowerCase().includes(term) ||
                f.config.description?.toLowerCase().includes(term)
        );

        // Recursively filter children
        const filteredChildren = node.children
            .map(filterNode)
            .filter((n): n is GroupNode => n !== null);

        // Include this group if it has matching folders or filtered children
        if (matchingFolders.length > 0 || filteredChildren.length > 0) {
            return {
                ...node,
                folders: matchingFolders,
                children: filteredChildren,
            };
        }

        return null;
    };

    return nodes.map(filterNode).filter((n): n is GroupNode => n !== null);
}

// Status indicator component
const FolderStatus: React.FC<{
    isLocal: boolean;
    isChanged: boolean;
}> = ({ isLocal, isChanged }) => {
    if (!isLocal) {
        return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <RadioButtonUnchecked sx={{ fontSize: 14, color: "text.disabled" }} />
                <Typography variant="caption" color="text.disabled">
                    Not local
                </Typography>
            </Box>
        );
    }
    if (isChanged) {
        return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Circle sx={{ fontSize: 14, color: "warning.main" }} />
                <Typography variant="caption" color="warning.main">
                    Changed
                </Typography>
            </Box>
        );
    }
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <CheckCircle sx={{ fontSize: 14, color: "success.main" }} />
            <Typography variant="caption" color="success.main">
                Synced
            </Typography>
        </Box>
    );
};

// Single folder item component
const FolderItem: React.FC<{
    folderKey: string;
    folderConfig: FolderConfig;
    isLocal: boolean;
    isChanged: boolean;
    isChecked: boolean;
    isFocused: boolean;
    isDownloading: boolean;
    indentLevel: number;
    onToggle: () => void;
    onFocus: () => void;
    onRequestDownload: () => void;
}> = ({
    folderKey,
    isLocal,
    isChanged,
    isChecked,
    isFocused,
    isDownloading,
    indentLevel,
    onToggle,
    onFocus,
    onRequestDownload,
}) => {
    const handleOpenFolder = async () => {
        try {
            await FolderService.OpenFolder(folderKey);
        } catch (e) {
            console.error("Failed to open folder:", e);
        }
    };

    return (
        <>
            <ListItem
                component={ListItemPaper}
                elevation={isFocused ? 1 : 6}
                sx={{ pl: indentLevel * 2, position: "relative", zIndex: 0 }}
            >
                {/* Only show checkbox for local folders */}
                {isLocal && (
                    <Box>
                        <ListItemButton onClick={onToggle} sx={{ minWidth: "auto", p: 1 }}>
                            <Checkbox
                                edge="start"
                                checked={isChecked}
                                tabIndex={-1}
                                disableRipple
                            />
                        </ListItemButton>
                    </Box>
                )}
                {/* Folder name - clickable area for focus */}
                <Box
                    sx={{
                        flexGrow: 1,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        py: 1,
                        pl: isLocal ? 0 : 2,
                    }}
                    onClick={onFocus}
                >
                    <ListItemText
                        primary={folderKey}
                        primaryTypographyProps={{
                            color: isLocal ? "secondary" : "text.disabled",
                        }}
                    />
                </Box>
                {/* Right-side controls - status aligned, then action button */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mr: 1 }}>
                    {/* Status indicator - fixed width for alignment */}
                    <Box sx={{ minWidth: 80 }}>
                        <FolderStatus isLocal={isLocal} isChanged={isChanged} />
                    </Box>
                    {/* Open folder button for local folders */}
                    {isLocal && (
                        <IconButton
                            size="small"
                            color="primary"
                            onClick={handleOpenFolder}
                            title="Open folder"
                        >
                            <OpenInNewRounded fontSize="small" />
                        </IconButton>
                    )}
                    {/* Download button for non-local folders */}
                    {!isLocal && (
                        <IconButton
                            size="small"
                            color="primary"
                            onClick={onRequestDownload}
                            disabled={isDownloading}
                            title="Download folder"
                        >
                            {isDownloading ? (
                                <CircularProgress size={18} />
                            ) : (
                                <Download fontSize="small" />
                            )}
                        </IconButton>
                    )}
                </Box>
            </ListItem>
            <Divider />
        </>
    );
};

// Group header component (collapsible)
const GroupHeader: React.FC<{
    groupNode: GroupNode;
    isExpanded: boolean;
    indentLevel: number;
    folderCount: number;
    onToggle: () => void;
}> = ({ groupNode, isExpanded, indentLevel, folderCount, onToggle }) => {
    return (
        <>
            <ListItemButton
                onClick={onToggle}
                sx={{
                    pl: indentLevel * 2 + 1,
                    py: 0.5,
                    bgcolor: "action.hover",
                }}
            >
                <ListItemIcon sx={{ minWidth: 32 }}>
                    <FolderOpen color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                    primary={groupNode.config.name}
                    secondary={!isExpanded ? `${folderCount} folder${folderCount !== 1 ? "s" : ""}` : undefined}
                    primaryTypographyProps={{
                        fontWeight: "medium",
                        color: "primary",
                    }}
                />
                <IconButton size="small" edge="end">
                    {isExpanded ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
            </ListItemButton>
            <Divider />
        </>
    );
};

// Recursive group tree component
const GroupTreeNode: React.FC<{
    node: GroupNode;
    indentLevel: number;
    localFolders: string[];
    changedFolders: string[];
    downloadingFolders: string[];
    targetFolders: string[];
    focusedFolder: string | null;
    expandedGroups: Set<string>;
    onToggleGroup: (groupKey: string) => void;
    onToggleFolder: (folderKey: string) => void;
    onFocusFolder: (folderKey: string | null) => void;
    onDownloadFolder: (folderKey: string) => void;
}> = ({
    node,
    indentLevel,
    localFolders,
    changedFolders,
    downloadingFolders,
    targetFolders,
    focusedFolder,
    expandedGroups,
    onToggleGroup,
    onToggleFolder,
    onFocusFolder,
    onDownloadFolder,
}) => {
    const isExpanded = expandedGroups.has(node.key);

    // Count total folders in this group (including nested)
    const countFolders = (n: GroupNode): number => {
        return (
            n.folders.length +
            n.children.reduce((sum, child) => sum + countFolders(child), 0)
        );
    };
    const folderCount = countFolders(node);

    return (
        <Box>
            <GroupHeader
                groupNode={node}
                isExpanded={isExpanded}
                indentLevel={indentLevel}
                folderCount={folderCount}
                onToggle={() => onToggleGroup(node.key)}
            />
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                    {/* Render child groups */}
                    {node.children.map((childNode) => (
                        <GroupTreeNode
                            key={childNode.key}
                            node={childNode}
                            indentLevel={indentLevel + 1}
                            localFolders={localFolders}
                            changedFolders={changedFolders}
                            downloadingFolders={downloadingFolders}
                            targetFolders={targetFolders}
                            focusedFolder={focusedFolder}
                            expandedGroups={expandedGroups}
                            onToggleGroup={onToggleGroup}
                            onToggleFolder={onToggleFolder}
                            onFocusFolder={onFocusFolder}
                            onDownloadFolder={onDownloadFolder}
                        />
                    ))}
                    {/* Render folders in this group */}
                    {node.folders.map(({ key: folderKey, config: folderConfig }) => {
                        const isLocal = localFolders.includes(folderKey);
                        const isChanged = changedFolders.includes(folderKey);
                        const isChecked = targetFolders.includes(folderKey);
                        const isFocused = focusedFolder === folderKey;
                        const isDownloading = downloadingFolders.includes(folderKey);

                        return (
                            <FolderItem
                                key={folderKey}
                                folderKey={folderKey}
                                folderConfig={folderConfig}
                                isLocal={isLocal}
                                isChanged={isChanged}
                                isChecked={isChecked}
                                isFocused={isFocused}
                                isDownloading={isDownloading}
                                indentLevel={indentLevel + 1}
                                onToggle={() => onToggleFolder(folderKey)}
                                onFocus={() =>
                                    onFocusFolder(isFocused ? null : folderKey)
                                }
                                onRequestDownload={() => onDownloadFolder(folderKey)}
                            />
                        );
                    })}
                </List>
            </Collapse>
        </Box>
    );
};

// Main component
const GroupedFolderTree: React.FC<GroupedFolderTreeProps> = ({
    projectConfig,
    localFolders,
    changedFolders,
    downloadingFolders,
    isLoadingLocalFolders,
    searchTerm,
    targetFolders,
    focusedFolder,
    setFocusedFolder,
    setTargetFolders,
    onDownloadFolder,
}) => {
    // Track which groups are expanded (all expanded by default)
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
        if (!projectConfig?.groups) return new Set();
        return new Set(Object.keys(projectConfig.groups));
    });

    // State for download confirmation dialog
    const [pendingDownloadFolder, setPendingDownloadFolder] = useState<string | null>(null);

    // Build and filter the tree
    const groupTree = useMemo(() => {
        if (!projectConfig?.groups || !projectConfig?.folders) {
            return [];
        }
        const tree = buildGroupTree(projectConfig.groups, projectConfig.folders);
        return filterTree(tree, searchTerm);
    }, [projectConfig?.groups, projectConfig?.folders, searchTerm]);

    // Toggle group expansion
    const handleToggleGroup = useCallback((groupKey: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupKey)) {
                next.delete(groupKey);
            } else {
                next.add(groupKey);
            }
            return next;
        });
    }, []);

    // Toggle folder selection
    const handleToggleFolder = useCallback(
        (folderKey: string) => {
            const currentIndex = targetFolders.indexOf(folderKey);
            const newSelected = [...targetFolders];

            if (currentIndex === -1) {
                // Only allow selecting local folders
                if (localFolders.includes(folderKey)) {
                    newSelected.push(folderKey);
                }
            } else {
                newSelected.splice(currentIndex, 1);
            }
            setTargetFolders(newSelected);
        },
        [targetFolders, localFolders, setTargetFolders]
    );

    // Handle folder focus
    const handleFocusFolder = useCallback(
        (folderKey: string | null) => {
            setFocusedFolder(folderKey);
        },
        [setFocusedFolder]
    );

    // Handle download request (opens confirmation dialog)
    const handleRequestDownload = useCallback((folderKey: string) => {
        setPendingDownloadFolder(folderKey);
    }, []);

    // Handle download confirmation
    const handleConfirmDownload = useCallback(() => {
        if (pendingDownloadFolder) {
            onDownloadFolder(pendingDownloadFolder);
            setPendingDownloadFolder(null);
        }
    }, [pendingDownloadFolder, onDownloadFolder]);

    // Handle download cancel
    const handleCancelDownload = useCallback(() => {
        setPendingDownloadFolder(null);
    }, []);

    if (projectConfig === undefined || isLoadingLocalFolders) {
        return <FullHeightSkeleton />;
    }

    // Handle case where no groups exist yet
    if (!projectConfig.groups || Object.keys(projectConfig.groups).length === 0) {
        return (
            <Box sx={{ p: 2, textAlign: "center" }}>
                <Typography color="text.secondary">
                    No groups configured. Create a group to organize your folders.
                </Typography>
            </Box>
        );
    }

    return (
        <Box
            height="100%"
            overflow="auto"
            sx={{
                position: "relative",
                zIndex: 1,
            }}
        >
            <List disablePadding>
                {groupTree.map((node) => (
                    <GroupTreeNode
                        key={node.key}
                        node={node}
                        indentLevel={0}
                        localFolders={localFolders}
                        changedFolders={changedFolders}
                        downloadingFolders={downloadingFolders}
                        targetFolders={targetFolders}
                        focusedFolder={focusedFolder}
                        expandedGroups={expandedGroups}
                        onToggleGroup={handleToggleGroup}
                        onToggleFolder={handleToggleFolder}
                        onFocusFolder={handleFocusFolder}
                        onDownloadFolder={handleRequestDownload}
                    />
                ))}
            </List>

            {/* Download confirmation dialog */}
            <Dialog
                open={pendingDownloadFolder !== null}
                onClose={handleCancelDownload}
            >
                <DialogTitle>Download Folder?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to download "{pendingDownloadFolder}"?
                        This folder may contain a large amount of data.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelDownload}>Cancel</Button>
                    <Button onClick={handleConfirmDownload} variant="contained" color="primary">
                        Download
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default GroupedFolderTree;
