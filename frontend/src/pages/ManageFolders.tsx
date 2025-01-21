import { ComponentType } from "react";
import ProjectDashboard from "../components/Project/ProjectDashboard";
import ProjectSelector from "../components/Project/ProjectSelector";
import { GlobalConfigContextProvider } from "../hooks/GlobalConfigContext";

const ManageFolders: ComponentType<{}> = () => {
    return (
        <GlobalConfigContextProvider>
            <ProjectSelector ProjectSelectorChild={ProjectDashboard}>
            </ProjectSelector>
        </GlobalConfigContextProvider>
    );
}

export default ManageFolders