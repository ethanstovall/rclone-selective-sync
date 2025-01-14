// import { useEffect, useState } from "react";
// import { ProjectConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models.ts";
// import { ConfigService } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/index.ts";
// import { Autocomplete, Box, Checkbox, Collapse, Container, Divider, IconButton, List, ListItem, ListItemButton, ListItemIcon, Paper, Skeleton, TextField, Tooltip, Typography } from "@mui/material";
// import { Info, ExpandLess, CleaningServices, CloudUpload, CloudDownload, FolderOpen } from "@mui/icons-material";
// import ListItemPaper from "../common/ListItemPaper.tsx";
// import StandardTypography from "../common/StandardTypography.tsx";
// import { dryPushFolders } from "../../services/SyncService.ts";
// import { useGlobalConfig } from "../../hooks/GlobalConfigContext.tsx";

// const FolderTree: React.FunctionComponent = () => {
//     const { globalConfig, selectedProject } = useGlobalConfig();
//     // State for project configuration
//     const [projectConfig, setProjectConfig] = useState<ProjectConfig | undefined>(undefined);
//     const [isLoadingProject, setIsLoadingProject] = useState<boolean>(true);

//     // State for project interaction
//     const [inspectedFolders, setInspectedFolders] = useState<Record<string, boolean>>({});
//     const [selectedFolders, setSelectedFolders] = useState<string[]>([]);

//     // State for project list filtering
//     const [searchTerm, setSearchTerm] = useState("");
//     const [filteredFolders, setFilteredFolders] = useState<string[] | undefined>(undefined);

//     // State for Rclone command output
//     // const []

//     useEffect(() => {
//         if (selectedProject === undefined) {
//             return;
//         }
//         setIsLoadingProject(true);
//         ConfigService.LoadProjectConfig(selectedProject).then((loadedProjectConfig: ProjectConfig) => {
//             setProjectConfig(loadedProjectConfig);
//             setFilteredFolders(Object.entries(loadedProjectConfig.folders).map(([folderName, folderConfig]) => (folderName)));
//         }).catch((err: any) => {
//             console.error(err);
//         }).finally(() => {
//             setIsLoadingProject(false);
//         })
//     }, [selectedProject]);

//     const handleInspectFolder = (folderName: string) => {
//         setInspectedFolders((prevState) => ({
//             ...prevState,
//             [folderName]: !prevState[folderName],
//         }));
//     };

//     const handleSelectFolder = (value: string) => () => {
//         const currentIndex = selectedFolders.indexOf(value);
//         const newSelected = [...selectedFolders];

//         if (currentIndex === -1) {
//             newSelected.push(value);
//         } else {
//             newSelected.splice(currentIndex, 1);
//         }
//         setSelectedFolders(newSelected);
//     };

//     const handleSearchChange = (event, value) => {
//         if (!projectConfig) {
//             return; // Exit early if projectConfig is undefined
//         }
//         // Filter folders based on the search term
//         const newFilteredFolders = Object.entries(projectConfig.folders).map(([folderName, _]) => (folderName)).filter((name) =>
//             name.toLowerCase().includes(value.toLowerCase())
//         );
//         setFilteredFolders(newFilteredFolders);
//         setSearchTerm(value);
//     };

//     const handleDryPush = async () => {
//         const output = await dryPushFolders(selectedFolders);
//         console.warn(output);
//     }

//     return (
//         (!isLoadingProject) ? (
//             <Container>
//                 {projectConfig && projectConfig.folders ? (
//                     <Container>
//                         {/* Control Bar */}
//                         <Box component={Paper} display={"flex"} justifyContent={"space-between"} alignItems={"center"} padding={"10px"}>
//                             <Autocomplete
//                                 freeSolo
//                                 options={Object.keys(projectConfig.folders).sort()}
//                                 value={searchTerm}
//                                 onInputChange={handleSearchChange}
//                                 renderInput={(params) => <TextField {...params} label="Search Folders" variant="outlined" fullWidth />}
//                                 sx={{ width: "100%" }}
//                             />
//                             <Tooltip title="Local Remove">
//                                 <IconButton color="primary" onClick={() => { }}>
//                                     <CleaningServices />
//                                 </IconButton>
//                             </Tooltip>
//                             <Tooltip title="Push">
//                                 <IconButton color="primary" onClick={handleDryPush}>
//                                     <CloudUpload />
//                                 </IconButton>
//                             </Tooltip>
//                             <Tooltip title="Pull">
//                                 <IconButton color="warning" onClick={() => { }}>
//                                     <CloudDownload />
//                                 </IconButton>
//                             </Tooltip>
//                         </Box>
//                         <FolderTree projectConfig={projectConfig}/>
//                     </Container>
//                 ) : (
//                     <Typography variant="body1" color="textSecondary">
//                         No folders available for the selected project.
//                     </Typography>
//                 )}
//             </Container >
//         ) : (
//             <Skeleton />
//         )
//     )
// }

// export default FolderTree;