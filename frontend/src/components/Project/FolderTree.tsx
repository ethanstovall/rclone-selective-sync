import { useMemo, useState } from "react";
import { ProjectConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models.ts";
import { Box, Checkbox, Collapse, Divider, IconButton, List, ListItem, ListItemButton, ListItemIcon, Skeleton, Tooltip, Typography } from "@mui/material";
import { Info, ExpandLess, FolderOpen } from "@mui/icons-material";
import ListItemPaper from "../common/ListItemPaper.tsx";
import StandardTypography from "../common/StandardTypography.tsx";
import { useGlobalConfig } from "../../hooks/GlobalConfigContext.tsx";

const FolderTree: React.FunctionComponent<{
    projectConfig: ProjectConfig | undefined;
    filteredFolders: string[] | undefined;
    targetFolders: string[];
    setTargetFolders: (targetFolders: string[]) => void;
}> = ({ projectConfig, filteredFolders, targetFolders, setTargetFolders }) => {
    // Global config state
    const { globalConfig, selectedProject } = useGlobalConfig();

    // State for project interaction
    const [inspectedFolders, setInspectedFolders] = useState<Record<string, boolean>>({});

    const { localRoot, remoteRoot } = useMemo(() => {
        if (globalConfig === undefined || selectedProject === undefined) {
            return { localRoot: undefined, remoteRoot: undefined };
        }
        return { localRoot: globalConfig.remotes[selectedProject].local_path, remoteRoot: globalConfig.remotes[selectedProject].bucket_name };
    }, [projectConfig])

    const handleInspectFolder = (folderName: string) => {
        setInspectedFolders((prevState) => ({
            ...prevState,
            [folderName]: !prevState[folderName],
        }));
    };

    const handleSelectFolder = (value: string) => () => {
        const currentIndex = targetFolders.indexOf(value);
        const newSelected = [...targetFolders];

        if (currentIndex === -1) {
            newSelected.push(value);
        } else {
            newSelected.splice(currentIndex, 1);
        }
        setTargetFolders(newSelected);
    };

    return (
        (projectConfig !== undefined) ? (
            <List>
                {Object.entries(projectConfig.folders).map(([folderName, folderConfig]) => (
                    (filteredFolders?.includes(folderName)) && (
                        <Box key={folderName}>
                            <ListItem component={ListItemPaper} elevation={3}>
                                {/* Left-aligned content */}
                                <ListItemButton role={undefined} onClick={handleSelectFolder(folderName)}>
                                    <ListItemIcon>
                                        <Checkbox
                                            edge="start"
                                            checked={targetFolders.includes(folderName)}
                                            tabIndex={-1}
                                            disableRipple
                                            inputProps={{ 'aria-labelledby': folderName }}
                                        />
                                    </ListItemIcon>
                                    <StandardTypography sx={{ flexGrow: 1 }}>{folderName}</StandardTypography>
                                </ListItemButton>

                                {/* Right-aligned inspect button */}
                                <Box sx={{ display: "flex", gap: 1, alignItems: "center", ml: "auto" }}>
                                    <Tooltip title="Open Folder">
                                        <IconButton color="secondary">
                                            <FolderOpen />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Info">
                                        <IconButton color="secondary" onClick={() => handleInspectFolder(folderName)}>
                                            {inspectedFolders[folderName] ? <ExpandLess /> : <Info />}
                                        </IconButton>
                                    </Tooltip>

                                </Box>
                            </ListItem>
                            <Collapse in={inspectedFolders[folderName]} timeout="auto" unmountOnExit>
                                <Box sx={{ pl: 2 }}>
                                    <Typography variant="body2" color="secondary">
                                        Remote Path: {`${remoteRoot}/${folderConfig.remote_path}`}
                                    </Typography>
                                    <Typography variant="body2" color="secondary">
                                        Local Path: {`${localRoot}/${folderConfig.local_path}`}
                                    </Typography>
                                </Box>
                            </Collapse>
                            <Divider />
                        </Box>
                    )
                ))}
            </List>
        ) : (
            <Skeleton />
        )
    )
}

export default FolderTree;