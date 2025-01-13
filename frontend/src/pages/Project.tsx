import { Box, Container, Typography } from "@mui/material";
import { useGlobalConfig } from "../hooks/GlobalConfigContext";
import { useEffect } from "react";
import FolderTree from "../components/Project/FolderTree";
import HeaderTypography from "../components/common/HeaderTypography";
import PaddedBox from "../components/common/PaddedBox";

function Project() {
    const { globalConfig, selectedProject } = useGlobalConfig();

    useEffect(() => {
        console.warn(globalConfig);
        console.warn(selectedProject);
    }, [globalConfig]);


    return (
        <Container>
            {/* Selected Project Display */}
            <PaddedBox justifyContent={"left"}>
                <HeaderTypography>
                    {selectedProject || "None"}
                </HeaderTypography>
            </PaddedBox>
            {/* Syncable Folders File Tree */}
            <FolderTree selectedProject={selectedProject}></FolderTree>
        </Container>
    );
}

export default Project