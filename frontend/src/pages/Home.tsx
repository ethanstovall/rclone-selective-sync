import { Container, Typography } from "@mui/material";
import { useGlobalConfig } from "../hooks/GlobalConfigContext";
import { useEffect } from "react";

function Home() {
    const globalConfig = useGlobalConfig();

    useEffect(() => {
        console.warn(globalConfig);
    }, [globalConfig])

    return (
        <Container>
            <Typography>{JSON.stringify(globalConfig)}</Typography>
        </Container>
    )
    
}

export default Home