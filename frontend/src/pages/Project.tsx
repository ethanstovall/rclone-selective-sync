import { Box, Collapse, Container, Divider, List, ListItem, ListItemIcon, Typography } from "@mui/material";
import { useGlobalConfig } from "../hooks/GlobalConfigContext";
import { useEffect, useState } from "react";

function Project() {
    const { globalConfig, selectedProject } = useGlobalConfig();
    const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

    useEffect(() => {
        console.warn(globalConfig);
        console.warn(selectedProject);

        // Initialize folder state to be closed by default
        if (globalConfig && globalConfig.remotes) {
            const initialState = Object.keys(globalConfig.remotes).reduce(
                (state, folder) => ({ ...state, [folder]: false }),
                {}
            );
            setOpenFolders(initialState);
        }
    }, [globalConfig]);

    const handleToggleFolder = (folderName: string) => {
        setOpenFolders((prevState) => ({
            ...prevState,
            [folderName]: !prevState[folderName],
        }));
    };

    return (
        // <Container sx={{ mt: 4 }}>
        //     {/* Selected Project Display */}
        //     <Box sx={{ mb: 4 }}>
        //         <Typography variant="h4" color="primary">
        //             Selected Project: {selectedProject || "None"}
        //         </Typography>
        //     </Box>

        //     {/* Syncable Folders File Tree */}
        //     {globalConfig && globalConfig.folders ? (
        //         <List>
        //             {Object.entries(globalConfig.folders).map(([folderName, folderConfig]) => (
        //                 <Box key={folderName}>
        //                     <ListItem button onClick={() => handleToggleFolder(folderName)}>
        //                         <ListItemIcon>
        //                             <Folder />
        //                         </ListItemIcon>
        //                         <ListItemText primary={folderName} />
        //                         {openFolders[folderName] ? <ExpandLess /> : <ExpandMore />}
        //                     </ListItem>
        //                     <Collapse in={openFolders[folderName]} timeout="auto" unmountOnExit>
        //                         <Box sx={{ pl: 4 }}>
        //                             <Typography variant="body2" color="textSecondary">
        //                                 Remote Path: {folderConfig.remotePath}
        //                             </Typography>
        //                             <Typography variant="body2" color="textSecondary">
        //                                 Local Path: {folderConfig.localPath}
        //                             </Typography>
        //                         </Box>
        //                     </Collapse>
        //                     <Divider />
        //                 </Box>
        //             ))}
        //         </List>
        //     ) : (
        //         <Typography variant="body1" color="textSecondary">
        //             No folders available for the selected project.
        //         </Typography>
        //     )}
        // </Container>
        null
    );
}

export default Project