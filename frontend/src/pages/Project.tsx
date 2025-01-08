import { Box, Container, Typography } from "@mui/material";
import { useGlobalConfig } from "../hooks/GlobalConfigContext";
import { useEffect } from "react";
import FolderTree from "../components/Project/FolderTree";

function Project() {
    const { globalConfig, selectedProject } = useGlobalConfig();

    useEffect(() => {
        console.warn(globalConfig);
        console.warn(selectedProject);
    }, [globalConfig]);


    return (
        <Container>
            {/* Selected Project Display */}
            <Box justifyContent={"left"}>
                <Typography variant="h4">
                    {selectedProject || "None"}
                </Typography>
            </Box>
            {/* Syncable Folders File Tree */}
            <FolderTree selectedProject={selectedProject}></FolderTree>
        </Container>
    );
}

export default Project