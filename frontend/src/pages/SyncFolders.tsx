import { ComponentType } from "react";
import ProjectDashboard from "../components/Project/ProjectDashboard";
import ProjectSelector from "../components/Project/ProjectSelector";
import { GlobalConfigContextProvider } from "../hooks/GlobalConfigContext";
import { ProjectConfigContextProvider } from "../hooks/ProjectConfigContext";

const SyncFolders: ComponentType<{}> = () => {
    return (
        <GlobalConfigContextProvider>
            <ProjectConfigContextProvider>
                <ProjectSelector ProjectSelectorChild={ProjectDashboard}>
                </ProjectSelector>
            </ProjectConfigContextProvider>
        </GlobalConfigContextProvider>
    );
}

export default SyncFolders