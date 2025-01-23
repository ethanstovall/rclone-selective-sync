import { Typography } from "@mui/material";
import { FolderConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend";
import SubheaderTypography from "../common/StandardTypography";
import { useGlobalConfig } from "../../hooks/GlobalConfigContext";
import { useMemo } from "react";
import PaddedBox from "../common/PaddedBox";
import ListItemPaper from "../common/ListItemPaper";
import React from "react";
import HeaderTypography from "../common/HeaderTypography";

interface FolderDescriptionProps {
    folderConfig: FolderConfig;
}

const FolderDescription: React.FC<FolderDescriptionProps> = ({ folderConfig }) => {
    // Global config state
    const { globalConfig, selectedProject } = useGlobalConfig();

    const { localRoot, remoteRoot } = useMemo(() => {
        if (globalConfig === undefined || selectedProject === undefined) {
            return { localRoot: undefined, remoteRoot: undefined };
        }
        return { localRoot: globalConfig.remotes[selectedProject].local_path, remoteRoot: globalConfig.remotes[selectedProject].bucket_name };
    }, [globalConfig, selectedProject])

    return (
        (folderConfig.local_path) ? (
            <PaddedBox
                component={ListItemPaper}
                height={"100%"}
            >
                <React.Fragment>
                    <SubheaderTypography color="secondary">
                        Local Path
                    </SubheaderTypography>
                    <Typography>
                        {`${localRoot}/${folderConfig.local_path}`}
                    </Typography>
                    <SubheaderTypography color="secondary">
                        Remote Path
                    </SubheaderTypography>
                    <Typography>
                        {`${remoteRoot}/${folderConfig.remote_path}`}
                    </Typography>
                    <SubheaderTypography color="secondary">
                        Description
                    </SubheaderTypography>
                    <Typography>
                        {`${folderConfig.description}`}
                    </Typography>
                </React.Fragment>
            </PaddedBox>
        ) : <PaddedBox
            component={ListItemPaper}
            height={"100%"}
            display="flex"
            justifyContent="center"
            alignItems="center"
        >
            <HeaderTypography justifySelf={"center"} alignSelf="center" color="secondary">No Folder Selected</HeaderTypography>
        </PaddedBox>
    )
};

export default FolderDescription;