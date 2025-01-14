import { useEffect, useMemo, useState } from "react";
import { ProjectConfig, RcloneAction, RcloneActionOutput } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models.ts";
import { ConfigService } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/index.ts";
import { Autocomplete, Box, Container, Paper, Skeleton, TextField, Typography } from "@mui/material";
import { CleaningServices, CloudUpload, CloudDownload } from "@mui/icons-material";
import { useGlobalConfig } from "../../hooks/GlobalConfigContext.tsx";
import FolderTree from "./FolderTree.tsx";
import { ExecuteRcloneAction } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/syncservice.ts";
import HeaderTypography from "../common/HeaderTypography.tsx";
import PaddedBox from "../common/PaddedBox.tsx";
import RcloneActionDialog from "./RcloneActionDialog.tsx";
import ActionIconButton from "../common/ActionIconButton.tsx";

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
    const [activeRcloneAction, setActiveRcloneAction] = useState<RcloneAction>("" as RcloneAction);

    const areActionButtonsDisabled = useMemo(() => {
        return targetFolders.length === 0;
    }, [targetFolders])


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
        setActiveRcloneAction(rcloneAction);
        setIsRunningRcloneAction(true);
        setIsRcloneDialogOpen(true);
        const output = await ExecuteRcloneAction(targetFolders, rcloneAction, dry);
        setIsRunningRcloneAction(false);
        if (dry) {
            // Open the finalize dialog if the dry run just completed
            setIsRcloneDialogOpen(true);
            setRcloneActionDialogOutput(output);
        } else {
            // Close the finalize dialog if the final run just completed
            setIsRcloneDialogOpen(false);
            setRcloneActionDialogOutput(null);
        }
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
                                <ActionIconButton
                                    tooltip="Remove Local"
                                    color="primary"
                                    disabled={areActionButtonsDisabled}
                                    loading={false}
                                    inputIcon={CleaningServices}
                                    onClick={() => { }}
                                />
                                <ActionIconButton
                                    tooltip="Push to Remote"
                                    color="primary"
                                    disabled={areActionButtonsDisabled} // TODO: Disable for folder selections that are invalid
                                    loading={isRunningRcloneAction && activeRcloneAction === RcloneAction.PUSH}
                                    inputIcon={CloudUpload}
                                    onClick={() => { handleRcloneAction(RcloneAction.PUSH, true) }}
                                />
                                <ActionIconButton
                                    tooltip="Pull from Remote"
                                    color="primary"
                                    disabled={areActionButtonsDisabled} // TODO: Disable for folder selections that are invalid
                                    loading={isRunningRcloneAction && activeRcloneAction === RcloneAction.PULL}
                                    inputIcon={CloudDownload}
                                    onClick={() => { handleRcloneAction(RcloneAction.PULL, true) }}
                                />
                            </Box>
                            <FolderTree
                                projectConfig={projectConfig}
                                filteredFolders={filteredFolders}
                                targetFolders={targetFolders}
                                setTargetFolders={setTargetFolders} />
                            <RcloneActionDialog
                                action={activeRcloneAction}
                                rcloneDryOutput={rcloneActionDialogOutput}
                                isRunningRcloneAction={isRunningRcloneAction}
                                isOpen={isRcloneDialogOpen}
                                handleClose={() => { setIsRcloneDialogOpen(false); setRcloneActionDialogOutput(null); setTargetFolders([]); }}
                                runRcloneCommand={() => { ExecuteRcloneAction(targetFolders, activeRcloneAction, false) }}
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