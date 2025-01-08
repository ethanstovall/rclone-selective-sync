// import { useEffect, useState } from "react";
// import { ProjectConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models.ts";

// const FolderTree: React.FunctionComponent = () => {
//     const [projectConfig, setProjectConfig] = useState<ProjectConfig>(undefined);
//     projectConfig.

//         useEffect(() => {
//             ConfigService.LoadGlobalConfig().then(([loadedGlobalConfig, selectedProject]: [GlobalConfig, string]) => {
//                 setGlobalConfig(loadedGlobalConfig);
//                 setSelectedProject(selectedProject);
//             }).catch((err: any) => {
//                 console.error(err);
//             })
//         }, []);
// }