import { createContext, useContext, useEffect, useState } from "react";
import { ProjectConfig } from "../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models.js";
import { ConfigService } from "../../bindings/github.com/ethanstovall/rclone-selective-sync/backend";
import { useGlobalConfig } from "./GlobalConfigContext.js";
import { Events } from "@wailsio/runtime";
import { Alert, Snackbar } from "@mui/material";

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

interface SyncStatusWarning {
    open: boolean;
    message: string;
    localModTime?: string;
    remoteModTime?: string;
}

const ProjectConfigContextProvider = ({ children }) => {
    // State for global config
    const { selectedProject } = useGlobalConfig();

    // State for project configuration
    const [projectConfig, setProjectConfig] = useState<ProjectConfig | undefined>(undefined);
    const [isLoadingProject, setIsLoadingProject] = useState<boolean>(true);

    // State for sync status warning
    const [syncWarning, setSyncWarning] = useState<SyncStatusWarning>({ open: false, message: "" });

    // Listen for sync-status events from the backend
    useEffect(() => {
        const unsubscribe = Events.On("sync-status", (event: { data: Record<string, string> }) => {
            const data = event.data;
            if (data.status === "local-newer") {
                setSyncWarning({
                    open: true,
                    message: data.message,
                    localModTime: data.localModTime,
                    remoteModTime: data.remoteModTime,
                });
            }
        });

        return () => {
            unsubscribe();
        };
    }, []);

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

    const handleCloseSyncWarning = () => {
        setSyncWarning({ ...syncWarning, open: false });
    };

    return (
        // The Provider gives access to the context to its children.
        <ProjectConfigContext.Provider value={{ projectConfig, isLoadingProject, setProjectConfig }}>
            {children}
            <Snackbar
                open={syncWarning.open}
                autoHideDuration={10000}
                onClose={handleCloseSyncWarning}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert
                    onClose={handleCloseSyncWarning}
                    severity="warning"
                    variant="filled"
                    sx={{ width: "100%" }}
                >
                    {syncWarning.message}
                    {syncWarning.localModTime && syncWarning.remoteModTime && (
                        <div style={{ fontSize: "0.85em", marginTop: "4px" }}>
                            Local: {new Date(syncWarning.localModTime).toLocaleString()} |
                            Remote: {new Date(syncWarning.remoteModTime).toLocaleString()}
                        </div>
                    )}
                </Alert>
            </Snackbar>
        </ProjectConfigContext.Provider>
    );
}

export { useProjectConfig, ProjectConfigContextProvider }