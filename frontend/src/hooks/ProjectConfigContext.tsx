import { createContext, useContext, useEffect, useState } from "react";
import { ProjectConfig } from "../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models.js";
import { ConfigService } from "../../bindings/github.com/ethanstovall/rclone-selective-sync/backend";
import { useGlobalConfig } from "./GlobalConfigContext.js";

interface ProjectConfigContextProps {
    projectConfig: ProjectConfig | undefined;
    isLoadingProject: boolean;
    setProjectConfig: React.Dispatch<React.SetStateAction<ProjectConfig | undefined>>;
}

const ProjectConfigContext = createContext<ProjectConfigContextProps>({
    projectConfig: undefined,
    isLoadingProject: true,
    setProjectConfig: () => { return undefined as never },
})

// Global config consumer hook.
const useProjectConfig = () => {
    // Get the context.
    const context = useContext(ProjectConfigContext);

    // if `undefined`, throw an error
    if (context === undefined) {
        throw new Error("useProjectConfig context was used outside of its Provider");
    }

    return context;
};

const ProjectConfigContextProvider = ({ children }) => {
    // State for global config
    const { globalConfig: _globalConfig, selectedProject, isLoadingGlobalConfig: _isLoadingGlobalConfig, setSelectedProject: _setSelectedProject } = useGlobalConfig();

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

    return (
        // The Provider gives access to the context to its children.
        <ProjectConfigContext.Provider value={{ projectConfig, isLoadingProject, setProjectConfig }}>
            {children}
        </ProjectConfigContext.Provider>
    );
}

export { useProjectConfig, ProjectConfigContextProvider }