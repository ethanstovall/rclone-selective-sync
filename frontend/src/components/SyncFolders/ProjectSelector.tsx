import { Grid2 } from "@mui/material";
import { useGlobalConfig } from "../../hooks/GlobalConfigContext";
import { useMemo } from "react";
import { ProjectConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models";
import FullHeightSkeleton from "../common/FullHeightSkeleton";
import { useProjectConfig } from "../../hooks/ProjectConfigContext";
import ProjectSelectorControlBar from "./ProjectSelectorControlBar";

export interface ProjectSelectorChildProps {
    projectConfig: ProjectConfig;
}

interface ProjectSelectorProps {
    ProjectSelectorChild: React.FC<ProjectSelectorChildProps>;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ ProjectSelectorChild }) => {

    // State for global config
    const { globalConfig: globalConfig, selectedProject, isLoadingGlobalConfig, setSelectedProject } = useGlobalConfig();

    const { projectConfig, isLoadingProject } = useProjectConfig();

    // Get the project options.
    const projectOptions = useMemo(() => {
        return Object.keys(globalConfig?.remotes ?? {}) || ["None"];
    }, [globalConfig?.remotes]);

    return (
        <Grid2 container spacing={1} height={800}>
            <Grid2 size={8} height={"10%"}>
                {
                    (!isLoadingGlobalConfig) ? (
                        <ProjectSelectorControlBar
                            selectedProject={selectedProject}
                            projectOptions={projectOptions}
                            setSelectedProject={setSelectedProject}
                        />
                    ) : (
                        <FullHeightSkeleton />
                    )
                }
            </Grid2>
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