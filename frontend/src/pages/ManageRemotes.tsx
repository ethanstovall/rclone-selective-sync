import { ComponentType } from "react";
import { GlobalConfigContextProvider } from "../hooks/GlobalConfigContext";
import { Typography } from "@mui/material";

const ManageRemotes: ComponentType<{}> = () => {
    return (
        <GlobalConfigContextProvider>
            <Typography>This is the Manage Remotes page.</Typography>
        </GlobalConfigContextProvider>
    );
}

export default ManageRemotes