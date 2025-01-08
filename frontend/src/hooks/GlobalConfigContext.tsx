import { createContext, useContext, useEffect, useState } from "react";
import {GlobalConfig} from "../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models.js";
import {ConfigService} from "../../bindings/github.com/ethanstovall/rclone-selective-sync/backend";

interface GlobalConfigContextProps {
    globalConfig: GlobalConfig;
    selectedProject: string | undefined;
}

const GlobalConfigContext = createContext<GlobalConfigContextProps>({
    globalConfig: undefined,
    selectedProject: undefined,
})

// Global config consumer hook.
const useGlobalConfig = () => {
    // Get the context.
    const context = useContext(GlobalConfigContext);
  
    // if `undefined`, throw an error
    if (context === undefined) {
      throw new Error("useUserContext was used outside of its Provider");
    }
  
    return context;
};

const GlobalConfigContextProvider = ({children}) => {
    const [globalConfig, setGlobalConfig] = useState<GlobalConfig>(undefined);
    const [selectedProject, setSelectedProject] = useState<string | undefined>(undefined);
    
    useEffect(() => {
    ConfigService.LoadGlobalConfig().then(([loadedGlobalConfig, selectedProject]: [GlobalConfig, string]) => {
        setGlobalConfig(loadedGlobalConfig);
        setSelectedProject(selectedProject);
    }).catch((err: any) => {
        console.error(err);
    })
    }, []);

    return (
        // The Provider gives access to the context to its children.
        <GlobalConfigContext.Provider value={{globalConfig, selectedProject}}>
            {children}
        </GlobalConfigContext.Provider>
    );
}

export {useGlobalConfig, GlobalConfigContextProvider}