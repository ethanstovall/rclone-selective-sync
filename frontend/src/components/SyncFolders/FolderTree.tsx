import { ProjectConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models.ts";
import { Box, Checkbox, Divider, List, ListItem, ListItemButton, ListItemIcon } from "@mui/material";
import ListItemPaper from "../common/ListItemPaper.tsx";
import SubheaderTypography from "../common/StandardTypography.tsx";
import FullHeightSkeleton from "../common/FullHeightSkeleton.tsx";
import { ChevronRight, Info } from "@mui/icons-material";
import { useMemo } from "react";

const FolderTree: React.FunctionComponent<{
    isShowLocal: boolean;
    projectConfig: ProjectConfig | undefined;
    localFolders: string[];
    isLoadingLocalFolders: boolean;
    searchTerm: string;
    targetFolders: string[];
    focusedFolder: string | null;
    setFocusedFolder: (folderNameInfo: string | null) => void;
    setTargetFolders: (targetFolders: string[]) => void;
}> = ({ isShowLocal, projectConfig, localFolders, isLoadingLocalFolders, searchTerm, targetFolders, focusedFolder, setFocusedFolder, setTargetFolders }) => {

    const displayFolders: string[] = useMemo(() => {
        if (!projectConfig?.folders) {
            return [];
        }

        if (isShowLocal) {
            // Show all local folders when `isShowLocal` is true
            return [...localFolders].filter((name) =>
                name.toLowerCase().includes(searchTerm.toLowerCase())
            ).sort();
        } else {
            // Show only folders in `projectConfig.folders` that are not in `localFolders`
            return Object.keys(projectConfig.folders).filter(
                folder => !localFolders.includes(folder)
            ).filter((name) =>
                name.toLowerCase().includes(searchTerm.toLowerCase())
            ).sort();
        }
    }, [localFolders, projectConfig?.folders, isShowLocal, searchTerm]);

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

    return (
        ((projectConfig !== undefined) && !isLoadingLocalFolders) ? (
            <Box height={"100%"} overflow={"auto"}>
                <List>
                    {displayFolders?.map((folderName) => (
                        <Box key={folderName} height={"100%"}>
                            <ListItem component={ListItemPaper} elevation={(focusedFolder === folderName) ? 1 : 6}>
                                <Box>
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
                                        onClick={() => { setFocusedFolder((folderName === focusedFolder) ? null : folderName) }}
                                    >
                                        <SubheaderTypography color={localFolders.includes(folderName) ? "secondary" : "textDisabled"}>{folderName}</SubheaderTypography>
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

                    ))}
                </List>
            </Box>
        ) : (
            <FullHeightSkeleton />
        )
    )
}

export default FolderTree;