import { useEffect, useState } from "react";
import { ProjectConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models.ts";
import { ConfigService } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/index.ts";
import { Autocomplete, Box, Checkbox, Collapse, Container, Divider, IconButton, List, ListItem, ListItemButton, ListItemIcon, Paper, Skeleton, TextField, Tooltip, Typography } from "@mui/material";
import { ManageSearch, ExpandLess, CleaningServices, CloudUpload, CloudDownload, FolderOpen } from "@mui/icons-material";
import ListItemPaper from "../common/ListItemPaper.tsx";
import StandardTypography from "../common/StandardTypography.tsx";

const FolderTree: React.FunctionComponent<{
    selectedProject: string | undefined;
}> = ({ selectedProject }) => {
    const [projectConfig, setProjectConfig] = useState<ProjectConfig | undefined>(undefined);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [inspectedFolders, setInspectedFolders] = useState<Record<string, boolean>>({});

    const [selectedFolders, setSelectedFolders] = useState<string[]>([]);

    const [searchTerm, setSearchTerm] = useState("");
    const [filteredFolders, setFilteredFolders] = useState<string[] | undefined>(undefined);

    useEffect(() => {
        if (selectedProject === undefined) {
            return;
        }
        setIsLoading(true);
        ConfigService.LoadProjectConfig(selectedProject).then((loadedProjectConfig: ProjectConfig) => {
            setProjectConfig(loadedProjectConfig);
            setFilteredFolders(Object.entries(loadedProjectConfig.folders).map(([folderName, folderConfig]) => (folderName)));
        }).catch((err: any) => {
            console.error(err);
        }).finally(() => {
            setIsLoading(false);
        })
    }, [selectedProject]);

    const handleInspectFolder = (folderName: string) => {
        setInspectedFolders((prevState) => ({
            ...prevState,
            [folderName]: !prevState[folderName],
        }));
    };

    const handleSelectFolder = (value: string) => () => {
        const currentIndex = selectedFolders.indexOf(value);
        const newSelected = [...selectedFolders];

        if (currentIndex === -1) {
            newSelected.push(value);
        } else {
            newSelected.splice(currentIndex, 1);
        }
        setSelectedFolders(newSelected);
    };

    const handleSearchChange = (event, value) => {
        if (!projectConfig) {
            return; // Exit early if projectConfig is undefined
        }
        // Filter folders based on the search term
        const newFilteredFolders = Object.entries(projectConfig.folders).map(([folderName, _]) => (folderName)).filter((name) =>
            name.toLowerCase().includes(value.toLowerCase())
        );
        setFilteredFolders(newFilteredFolders);
        setSearchTerm(value);
    };

    return (
        !(isLoading) ? (
            <Container>
                {projectConfig && projectConfig.folders ? (
                    <List>
                        {/* Control Bar */}
                        <Box component={Paper} display={"flex"} justifyContent={"space-between"} alignItems={"center"} padding={"10px"}>
                            <Autocomplete
                                freeSolo
                                options={Object.keys(projectConfig.folders).sort()}
                                value={searchTerm}
                                onInputChange={handleSearchChange}
                                renderInput={(params) => <TextField {...params} label="Search Folders" variant="outlined" fullWidth />}
                                sx={{ width: "100%" }}
                            />
                            <Tooltip title="Local Remove">
                                <IconButton color="primary" onClick={() => { }}>
                                    <CleaningServices />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Push">
                                <IconButton color="primary" onClick={() => { }}>
                                    <CloudUpload />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Pull">
                                <IconButton color="warning" onClick={() => { }}>
                                    <CloudDownload />
                                </IconButton>
                            </Tooltip>
                        </Box>
                        {Object.entries(projectConfig.folders).map(([folderName, folderConfig]) => (
                            (filteredFolders?.includes(folderName)) && (
                                <Box key={folderName}>
                                    <ListItem component={ListItemPaper} elevation={3}>
                                        {/* Left-aligned content */}
                                        <ListItemButton role={undefined} onClick={handleSelectFolder(folderName)}>
                                            <ListItemIcon>
                                                <Checkbox
                                                    edge="start"
                                                    checked={selectedFolders.includes(folderName)}
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
                                            <Tooltip title="Details">
                                                <IconButton color="secondary" onClick={() => handleInspectFolder(folderName)}>
                                                    {inspectedFolders[folderName] ? <ExpandLess /> : <ManageSearch />}
                                                </IconButton>
                                            </Tooltip>

                                        </Box>
                                    </ListItem>
                                    <Collapse in={inspectedFolders[folderName]} timeout="auto" unmountOnExit>
                                        <Box sx={{ pl: 2 }}>
                                            <Typography variant="body2" color="secondary">
                                                Remote Path: {folderConfig.remote_path}
                                            </Typography>
                                            <Typography variant="body2" color="secondary">
                                                Local Path: {folderConfig.local_path}
                                            </Typography>
                                        </Box>
                                    </Collapse>
                                    <Divider />
                                </Box>
                            )
                        ))}
                    </List>
                ) : (
                    <Typography variant="body1" color="textSecondary">
                        No folders available for the selected project.
                    </Typography>
                )}
            </Container>
        ) : (
            <Skeleton />
        )
    )
}

export default FolderTree;