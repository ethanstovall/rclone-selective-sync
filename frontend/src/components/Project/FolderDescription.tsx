import { Typography } from "@mui/material";
import { FolderConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend";
import StandardTypography from "../common/StandardTypography";
import { useGlobalConfig } from "../../hooks/GlobalConfigContext";
import { useMemo } from "react";
import PaddedBox from "../common/PaddedBox";
import ListItemPaper from "../common/ListItemPaper";
import FullHeightSkeleton from "../common/FullHeightSkeleton";

interface FolderDescriptionProps {
    folderDetails: FolderConfig | null;
    closeDescription: () => void;
}

const FolderDescription: React.FC<FolderDescriptionProps> = ({ folderDetails, closeDescription }) => {
    // Global config state
    const { globalConfig, selectedProject } = useGlobalConfig();
    console.log(folderDetails);

    const { localRoot, remoteRoot } = useMemo(() => {
        if (globalConfig === undefined || selectedProject === undefined) {
            return { localRoot: undefined, remoteRoot: undefined };
        }
        return { localRoot: globalConfig.remotes[selectedProject].local_path, remoteRoot: globalConfig.remotes[selectedProject].bucket_name };
    }, [globalConfig, selectedProject])

    return (
        (folderDetails) ? (
            <PaddedBox component={ListItemPaper} height={"100%"}>
                <StandardTypography>
                    Local Path
                </StandardTypography>
                <Typography>
                    {`${localRoot}/${folderDetails.local_path}`}
                </Typography>
                <StandardTypography>
                    Remote Path
                </StandardTypography>
                <Typography>
                    {`${remoteRoot}/${folderDetails.remote_path}`}
                </Typography>
                <StandardTypography>
                    Description
                </StandardTypography>
                <Typography>
                    {`${folderDetails.description}`}
                </Typography>
            </PaddedBox>
        ) : (
            <FullHeightSkeleton />
        )
    )
}

export default FolderDescription;