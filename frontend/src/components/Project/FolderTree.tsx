import { ProjectConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models.ts";
import { Box, Checkbox, Divider, List, ListItem, ListItemButton, ListItemIcon } from "@mui/material";
import ListItemPaper from "../common/ListItemPaper.tsx";
import StandardTypography from "../common/StandardTypography.tsx";
import { OpenFolder } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/filesystemservice.ts";
import FullHeightSkeleton from "../common/FullHeightSkeleton.tsx";
import { ChevronRight, Info } from "@mui/icons-material";

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
                                    <Box width={"10%"}>
                                        <ListItemButton
                                            onClick={handleTargetFolder(folderName)}
                                        >
                                            <Checkbox
                                                edge="start"
                                                checked={targetFolders.includes(folderName)}
                                                tabIndex={-1}
                                                disableRipple
                                                inputProps={{ 'aria-labelledby': folderName }}
                                            />
                                        </ListItemButton>
                                    </Box>
                                    <Box width={"90%"}>
                                        <ListItemButton
                                            role={undefined}
                                            onClick={() => { setFocusedFolder(folderName) }}
                                            onDoubleClick={() => { handleOpenFolder(folderName) }}
                                        >
                                            <StandardTypography sx={{ flexGrow: 1 }}>{folderName}</StandardTypography>
                                            <Box sx={{ display: "flex", gap: 1, alignItems: "center", ml: "auto" }}>
                                                <ListItemIcon>
                                                    <Info color={(focusedFolder === folderName) ? "secondary" : "disabled"}></Info>
                                                    {(focusedFolder === folderName) && (<ChevronRight color="secondary" />)}
                                                </ListItemIcon>
                                            </Box>
                                        </ListItemButton>
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