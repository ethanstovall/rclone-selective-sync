import { useEffect, useState } from "react";
import { ProjectConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models.ts";
import { ConfigService } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/index.ts";
import { Box, Button, Collapse, Container, Divider, List, ListItem, Skeleton, Typography } from "@mui/material";
import { ManageSearch, ExpandLess } from "@mui/icons-material";
import ListItemPaper from "../common/ListItemPaper.tsx";
import StandardTypography from "../common/StandardTypography.tsx";

const FolderTree: React.FunctionComponent<{
    selectedProject: string | undefined;
}> = ({ selectedProject }) => {
    const [projectConfig, setProjectConfig] = useState<ProjectConfig | undefined>(undefined);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (selectedProject === undefined) {
            return;
        }
        setIsLoading(true);
        ConfigService.LoadProjectConfig(selectedProject).then((loadedProjectConfig: ProjectConfig) => {
            setProjectConfig(loadedProjectConfig);
        }).catch((err: any) => {
            console.error(err);
        }).finally(() => {
            setIsLoading(false);
        })
    }, [selectedProject]);

    const handleToggleFolder = (folderName: string) => {
        setOpenFolders((prevState) => ({
            ...prevState,
            [folderName]: !prevState[folderName],
        }));
    };

    return (
        !(isLoading) ? (
            <Container>
                {projectConfig && projectConfig.folders ? (
                    <List>
                        {Object.entries(projectConfig.folders).map(([folderName, folderConfig]) => (
                            <Box key={folderName}>
                                <ListItem component={ListItemPaper} elevation={3}>
                                    <Button variant="text" color="secondary" onClick={() => handleToggleFolder(folderName)}>
                                        {openFolders[folderName] ? <ExpandLess /> : <ManageSearch />}
                                    </Button>
                                    <StandardTypography>{folderName}</StandardTypography >
                                </ListItem>
                                <Collapse in={openFolders[folderName]} timeout="auto" unmountOnExit>
                                    <Box>
                                        <Typography variant="body2" color="secondary">
                                            Remote Path: {folderConfig.remote_path}
                                        </Typography>
                                        <Typography variant="body2" color="secondary">
                                            Local Path: {folderConfig.local_path}
                                        </Typography>
                                    </Box>
                                </Collapse>
                                <Divider />
                                <Divider />
                            </Box>
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