import ProjectDashboard from "../components/Project/ProjectDashboard";
import ProjectSelector from "../components/Project/ProjectSelector";
import { GlobalConfigContextProvider } from "../hooks/GlobalConfigContext";

function Project() {
    return (
        <GlobalConfigContextProvider>
            <ProjectSelector ProjectSelectorChild={ProjectDashboard}>
            </ProjectSelector>
        </GlobalConfigContextProvider>
    );
}

export default Project