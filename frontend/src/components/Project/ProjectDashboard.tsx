import { useEffect, useState } from "react";
import { ProjectConfig, RcloneAction, RcloneActionOutput } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models.ts";
import { ConfigService } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/index.ts";
import { Autocomplete, Box, Container, IconButton, Paper, Skeleton, TextField, Tooltip, Typography } from "@mui/material";
import { CleaningServices, CloudUpload, CloudDownload } from "@mui/icons-material";
import { useGlobalConfig } from "../../hooks/GlobalConfigContext.tsx";
import FolderTree from "./FolderTree.tsx";
import { ExecuteRcloneAction } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/syncservice.ts";
import HeaderTypography from "../common/HeaderTypography.tsx";
import PaddedBox from "../common/PaddedBox.tsx";
import RcloneActionDialog from "./RcloneActionDialog.tsx";

const ProjectDashboard: React.FunctionComponent = () => {
    // State for global config
    const { globalConfig: _, selectedProject, isLoadingGlobalConfig } = useGlobalConfig();

    // State for project configuration
    const [projectConfig, setProjectConfig] = useState<ProjectConfig | undefined>(undefined);
    const [isLoadingProject, setIsLoadingProject] = useState<boolean>(true);

    // State for project list filtering
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredFolders, setFilteredFolders] = useState<string[] | undefined>(undefined);

    // State for Rclone command execution
    const [targetFolders, setTargetFolders] = useState<string[]>([]);
    const [rcloneActionDialogOutput, setRcloneActionDialogOutput] = useState<RcloneActionOutput[] | null>(null);
    const [isRunningRcloneAction, setIsRunningRcloneAction] = useState<boolean>(false);
    const [isRcloneDialogOpen, setIsRcloneDialogOpen] = useState<boolean>(false);
    const [activeRcloneCommand, setActiveRcloneCommand] = useState<RcloneAction>("" as RcloneAction);


    useEffect(() => {
        if (selectedProject === undefined) {
            return;
        }
        setIsLoadingProject(true);
        ConfigService.LoadProjectConfig(selectedProject).then((loadedProjectConfig: ProjectConfig) => {
            setProjectConfig(loadedProjectConfig);
            setFilteredFolders(Object.entries(loadedProjectConfig.folders).map(([folderName, folderConfig]) => (folderName)));
        }).catch((err: any) => {
            console.error(err);
        }).finally(() => {
            setIsLoadingProject(false);
        })
    }, [selectedProject]);

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

    const handleRcloneAction = async (rcloneAction: RcloneAction, dry: boolean) => {
        setIsRunningRcloneAction(true);
        setIsRcloneDialogOpen(true);
        const output = await ExecuteRcloneAction(targetFolders, rcloneAction, dry);
        setIsRunningRcloneAction(false);
        setRcloneActionDialogOutput(output);
        setActiveRcloneCommand(rcloneAction);
    }

    return (
        <Container>
            {
                (!isLoadingGlobalConfig) ? (
                    <PaddedBox>
                        <HeaderTypography>
                            {selectedProject}
                        </HeaderTypography>
                    </PaddedBox>
                ) : (
                    <Skeleton />
                )
            }
            {
                (!isLoadingProject) ? (
                    projectConfig && projectConfig.folders ? (
                        <Container>
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
                                    <IconButton color="primary" onClick={() => { handleRcloneAction("" as RcloneAction, true) }}>
                                        <CleaningServices />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Push">
                                    <IconButton color="primary" onClick={() => { handleRcloneAction(RcloneAction.PUSH, true) }}>
                                        <CloudUpload />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Pull">
                                    <IconButton color="warning" onClick={() => { handleRcloneAction(RcloneAction.PULL, true) }}>
                                        <CloudDownload />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                            <FolderTree
                                projectConfig={projectConfig}
                                filteredFolders={filteredFolders}
                                targetFolders={targetFolders}
                                setTargetFolders={setTargetFolders} />
                            <RcloneActionDialog
                                rcloneDryOutput={rcloneActionDialogOutput}
                                isOpen={isRcloneDialogOpen}
                                handleClose={() => { setIsRcloneDialogOpen(false); setRcloneActionDialogOutput(null); }}
                                runRcloneCommand={() => { ExecuteRcloneAction(targetFolders, activeRcloneCommand, false) }}
                            />
                        </Container>
                    ) : (
                        <Typography variant="body1" color="textSecondary">
                            No folders available for the selected project.
                        </Typography>
                    )
                ) : (
                    <Skeleton />
                )}
        </Container>
    )
}

export default ProjectDashboard;