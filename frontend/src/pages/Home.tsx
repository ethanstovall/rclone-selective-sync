import { Container, Typography } from "@mui/material";
import { useGlobalConfig } from "../hooks/GlobalConfigContext";
import { useEffect } from "react";

function Home() {
    const {globalConfig, selectedProject} = useGlobalConfig();

    useEffect(() => {
        console.warn(globalConfig);
        console.warn(selectedProject);
    }, [globalConfig])

    return (
        <Container>
            <Typography>{JSON.stringify(globalConfig)}</Typography>
        </Container>
    )
    
}

export default Home