import { ComponentType } from "react";
import ProjectDashboard from "../components/SyncFolders/ProjectDashboard";
import ProjectSelector from "../components/SyncFolders/ProjectSelector";
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