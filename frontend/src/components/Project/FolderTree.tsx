import { ProjectConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models.ts";
import { Box, Checkbox, Divider, List, ListItem, ListItemButton, ListItemIcon, Skeleton } from "@mui/material";
import { Info, FolderOpen, ChevronRight } from "@mui/icons-material";
import ListItemPaper from "../common/ListItemPaper.tsx";
import StandardTypography from "../common/StandardTypography.tsx";
import ActionIconButton from "../common/ActionIconButton.tsx";
import { OpenFolder } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/filesystemservice.ts";

const FolderTree: React.FunctionComponent<{
    projectConfig: ProjectConfig | undefined;
    filteredFolders: string[] | undefined;
    targetFolders: string[];
    folderNameInfo: string | null;
    setFolderDetails: (folderNameInfo: string | null) => void;
    setTargetFolders: (targetFolders: string[]) => void;
}> = ({ projectConfig, filteredFolders, targetFolders, folderNameInfo, setFolderDetails, setTargetFolders }) => {

    const handleSelectFolder = (value: string) => () => {
        const currentIndex = targetFolders.indexOf(value);
        const newSelected = [...targetFolders];

        if (currentIndex === -1) {
            newSelected.push(value);
        } else {
            newSelected.splice(currentIndex, 1);
        }
        setTargetFolders(newSelected);
    };

    // Open the selected folder in the user's file explorer
    const handleOpenFolder = async (targetFolder: string) => {
        try {
            await OpenFolder(targetFolder)
        } catch (e: any) {
            console.error(e);
        }
    }

    return (
        (projectConfig !== undefined) ? (
            <List>
                {Object.entries(projectConfig.folders).map(([folderName, folderConfig]) => (
                    (filteredFolders?.includes(folderName)) && (
                        <Box key={folderName}>
                            <ListItem component={ListItemPaper} elevation={3}>
                                {/* Left-aligned content */}
                                <ListItemButton role={undefined} onClick={handleSelectFolder(folderName)}>
                                    <ListItemIcon>
                                        <Checkbox
                                            edge="start"
                                            checked={targetFolders.includes(folderName)}
                                            tabIndex={-1}
                                            disableRipple
                                            inputProps={{ 'aria-labelledby': folderName }}
                                        />
                                    </ListItemIcon>
                                    <StandardTypography sx={{ flexGrow: 1 }}>{folderName}</StandardTypography>
                                </ListItemButton>

                                {/* Right-aligned inspect button */}
                                <Box sx={{ display: "flex", gap: 1, alignItems: "center", ml: "auto" }}>
                                    <ActionIconButton
                                        tooltip="Open Folder"
                                        color="secondary"
                                        onClick={() => { handleOpenFolder(folderName) }}
                                        inputIcon={FolderOpen}
                                    />
                                    <ActionIconButton
                                        tooltip="Info"
                                        color="secondary"
                                        onClick={(folderName != folderNameInfo) ? (() => { console.warn(folderName); setFolderDetails(folderName) }) : (() => { setFolderDetails(null) })}
                                        inputIcon={(folderName === folderNameInfo) ? ChevronRight : Info}
                                    />
                                </Box>
                            </ListItem>
                            {/* <Collapse in={inspectedFolders[folderName]} timeout="auto" unmountOnExit>
                                <Box sx={{ pl: 2 }}>
                                    <Typography variant="body2" color="secondary">
                                        Remote Path: {`${remoteRoot}/${folderConfig.remote_path}`}
                                    </Typography>
                                    <Typography variant="body2" color="secondary">
                                        Local Path: {`${localRoot}/${folderConfig.local_path}`}
                                    </Typography>
                                </Box>
                            </Collapse> */}
                            <Divider />
                        </Box>
                    )
                ))}
            </List>
        ) : (
            <Skeleton />
        )
    )
}

export default FolderTree;