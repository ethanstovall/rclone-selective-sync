import { Box, FormControl, Grid2, MenuItem, SelectChangeEvent } from "@mui/material";
import { useGlobalConfig } from "../../hooks/GlobalConfigContext";
import { useMemo } from "react";
import { ProjectConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models";
import HeaderTypography from "../common/HeaderTypography";
import HeaderSelectMenu from "../common/HeaderSelectMenu";
import FullHeightSkeleton from "../common/FullHeightSkeleton";
import { useProjectConfig } from "../../hooks/ProjectConfigContext";
import ActionIconButton from "../common/ActionIconButton";
import { FolderService } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend";
import { OpenInNewRounded } from "@mui/icons-material";

export interface ProjectSelectorChildProps {
    projectConfig: ProjectConfig;
}

interface ProjectSelector {
    ProjectSelectorChild: React.FC<ProjectSelectorChildProps>;
}

const ProjectSelector: React.FC<ProjectSelector> = ({ ProjectSelectorChild }) => {

    // State for global config
    const { globalConfig: globalConfig, selectedProject, isLoadingGlobalConfig, setSelectedProject } = useGlobalConfig();

    const { projectConfig, isLoadingProject } = useProjectConfig();

    // Get the project options.
    const projectOptions = useMemo(() => {
        return Object.keys(globalConfig?.remotes ?? {}) || ["None"];
    }, [globalConfig?.remotes]);

    const handleChange = (event: SelectChangeEvent<unknown>, child: React.ReactNode) => {
        setSelectedProject(event.target.value as string);
    };

    // Open the selected folder in the user's file explorer
    const handleOpenFolder = async () => {
        try {
            await FolderService.OpenFolder("")
        } catch (e: any) {
            console.error(e);
        }
    }

    return (
        <Grid2 container spacing={1} height={650}>
            {
                <Grid2 size={8} height={"10%"}>
                    {
                        (!isLoadingGlobalConfig) ? (
                            <Box display={"flex"} alignItems="center">
                                <FormControl sx={{ m: 1, minWidth: "60%" }}>
                                    <HeaderSelectMenu
                                        value={selectedProject ?? ''}
                                        onChange={handleChange}
                                        displayEmpty
                                        inputProps={{ 'aria-label': 'Selected Project' }}
                                        renderValue={(selected) => (
                                            <HeaderTypography color="primary">
                                                {selected as string ?? ''}
                                            </HeaderTypography>
                                        )}
                                    >
                                        {
                                            projectOptions.map((option) => (
                                                <MenuItem key={option} value={option}>{option}</MenuItem>
                                            ))
                                        }
                                    </HeaderSelectMenu>
                                </FormControl>
                                <ActionIconButton onClick={handleOpenFolder} inputIcon={OpenInNewRounded} color="primary" />
                            </Box>


                        ) : (
                            <FullHeightSkeleton />
                        )
                    }
                </Grid2>
            }
            <Grid2 size={12} height={"90%"}>
                {
                    (projectConfig && !isLoadingProject) ? (
                        <ProjectSelectorChild
                            projectConfig={projectConfig}
                        />
                    ) : (
                        <FullHeightSkeleton />
                    )
                }
            </Grid2>
        </Grid2>
    )
}

export default ProjectSelector;