import { Container } from "@mui/material";
import { useGlobalConfig } from "../hooks/GlobalConfigContext";
import FolderTree from "../components/Project/FolderTree";
import HeaderTypography from "../components/common/HeaderTypography";
import PaddedBox from "../components/common/PaddedBox";

function Project() {
    const { globalConfig, selectedProject } = useGlobalConfig();

    return (
        <Container>
            {/* Selected Project Display */}
            <PaddedBox justifyContent={"left"}>
                <HeaderTypography>
                    {selectedProject || "None"}
                </HeaderTypography>
            </PaddedBox>
            {/* Syncable Folders File Tree */}
            <FolderTree
                selectedProject={selectedProject}
                remoteRoot={(globalConfig && selectedProject) ? globalConfig.remotes[selectedProject].bucket_name : undefined}
                localRoot={(globalConfig && selectedProject) ? globalConfig.remotes[selectedProject].local_path : undefined}
            />
        </Container>
    );
}

export default Project