import ProjectDashboard from "../components/Project/ProjectDashboard";
import { GlobalConfigContextProvider } from "../hooks/GlobalConfigContext";

function Project() {
    return (
        <GlobalConfigContextProvider>
            <ProjectDashboard />
        </GlobalConfigContextProvider>
    );
}

export default Project