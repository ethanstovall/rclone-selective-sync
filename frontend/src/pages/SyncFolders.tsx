import { ComponentType } from "react";
import ProjectDashboard from "../components/SyncFolders/ProjectDashboard";
import ProjectSelector from "../components/SyncFolders/ProjectSelector";

const SyncFolders: ComponentType<{}> = () => {
    return (
        <ProjectSelector ProjectSelectorChild={ProjectDashboard} />
    );
}

export default SyncFolders