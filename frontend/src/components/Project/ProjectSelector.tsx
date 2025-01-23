import { FormControl, Grid2, MenuItem, SelectChangeEvent } from "@mui/material";
import { useGlobalConfig } from "../../hooks/GlobalConfigContext";
import { useEffect, useMemo, useState } from "react";
import { ProjectConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models";
import { ConfigService } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend";
import HeaderTypography from "../common/HeaderTypography";
import HeaderSelectMenu from "../common/HeaderSelectMenu";
import FullHeightSkeleton from "../common/FullHeightSkeleton";

export interface ProjectSelectorChildProps {
    projectConfig: ProjectConfig;
}

interface ProjectSelector {
    ProjectSelectorChild: React.FC<ProjectSelectorChildProps>;
}

const ProjectSelector: React.FC<ProjectSelector> = ({ ProjectSelectorChild }) => {

    // State for global config
    const { globalConfig: globalConfig, selectedProject, isLoadingGlobalConfig, setSelectedProject } = useGlobalConfig();

    // State for project configuration
    const [projectConfig, setProjectConfig] = useState<ProjectConfig | undefined>(undefined);
    const [isLoadingProject, setIsLoadingProject] = useState<boolean>(true);

    useEffect(() => {
        const loadProjectConfig = async () => {
            if (!selectedProject) return;

            setIsLoadingProject(true);

            try {
                await ConfigService.SetSelectedProject(selectedProject);
                const loadedProjectConfig = await ConfigService.LoadSelectedProjectConfig();
                setProjectConfig(loadedProjectConfig);
            } catch (error) {
                console.error(`Error loading project ${selectedProject} config:`, error);
            } finally {
                setIsLoadingProject(false);
            }
        };

        loadProjectConfig();
    }, [selectedProject]);

    // Get the project options.
    const projectOptions = useMemo(() => {
        return Object.keys(globalConfig?.remotes ?? {}) || ["None"];
    }, [globalConfig?.remotes]);

    const handleChange = (event: SelectChangeEvent<unknown>, child: React.ReactNode) => {
        setSelectedProject(event.target.value as string);
    };

    return (
        <Grid2 container spacing={1} height={650}>
            {
                <Grid2 size={8} height={"10%"}>
                    {
                        (!isLoadingGlobalConfig) ? (
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