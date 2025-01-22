import { ProjectConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models.ts";
import { Box, Checkbox, Divider, List, ListItem, ListItemButton, ListItemIcon } from "@mui/material";
import { Info, ChevronRight, FolderOpenTwoTone } from "@mui/icons-material";
import ListItemPaper from "../common/ListItemPaper.tsx";
import StandardTypography from "../common/StandardTypography.tsx";
import ActionIconButton from "../common/ActionIconButton.tsx";
import { OpenFolder } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/filesystemservice.ts";
import FullHeightSkeleton from "../common/FullHeightSkeleton.tsx";

const FolderTree: React.FunctionComponent<{
    projectConfig: ProjectConfig | undefined;
    filteredFolders: string[] | undefined;
    targetFolders: string[];
    focusedFolder: string | null;
    setFocusedFolder: (folderNameInfo: string | null) => void;
    setTargetFolders: (targetFolders: string[]) => void;
}> = ({ projectConfig, filteredFolders, targetFolders, focusedFolder, setFocusedFolder, setTargetFolders }) => {

    const handleTargetFolder = (value: string) => () => {
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
            <Box height={"100%"} overflow={'auto'}>
                <List>
                    {Object.entries(projectConfig.folders).map(([folderName, folderConfig]) => (
                        (filteredFolders?.includes(folderName)) && (
                            <Box key={folderName} height={"100%"}>
                                <ListItem component={ListItemPaper} elevation={(focusedFolder === folderName) ? 1 : 5}>
                                    {/* Left-aligned content */}
                                    <ListItemButton
                                        role={undefined}
                                        onClick={handleTargetFolder(folderName)}
                                    >
                                        <ListItemIcon>
                                            <Checkbox
                                                edge="start"
                                                checked={targetFolders.includes(folderName)}
                                                tabIndex={-1}
                                                disableRipple
                                                inputProps={{ 'aria-labelledby': folderName }}
                                                onClick={handleTargetFolder(folderName)}
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
                                            inputIcon={FolderOpenTwoTone}
                                        />
                                        <ActionIconButton
                                            tooltip="Info"
                                            color="secondary"
                                            onClick={(folderName != focusedFolder) ? (() => { setFocusedFolder(folderName) }) : (() => { setFocusedFolder(null) })}
                                            inputIcon={(folderName === focusedFolder) ? ChevronRight : Info}
                                        />
                                    </Box>
                                </ListItem>
                                <Divider />
                            </Box>
                        )
                    ))}
                </List>
            </Box>
        ) : (
            <FullHeightSkeleton />
        )
    )
}

export default FolderTree;