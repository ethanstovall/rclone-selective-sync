import { ProjectConfig } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models.ts";
import { Box, Checkbox, Divider, List, ListItem, ListItemButton, ListItemIcon, Tooltip, Typography } from "@mui/material";
import ListItemPaper from "../common/ListItemPaper.tsx";
import SubheaderTypography from "../common/StandardTypography.tsx";
import { OpenFolder } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/filesystemservice.ts";
import FullHeightSkeleton from "../common/FullHeightSkeleton.tsx";
import { ChevronRight, Download, FileDownloadDone, Info } from "@mui/icons-material";
import { useMemo, useState } from "react";
import ActionDialog from "../common/ActionDialog.tsx";
import { SyncService } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/index.ts";

const FolderTree: React.FunctionComponent<{
    projectConfig: ProjectConfig | undefined;
    localFolders: string[];
    isLoadingLocalFolders: boolean;
    filteredFolders: string[] | undefined;
    targetFolders: string[];
    focusedFolder: string | null;
    setFocusedFolder: (folderNameInfo: string | null) => void;
    setTargetFolders: (targetFolders: string[]) => void;
}> = ({ projectConfig, localFolders, isLoadingLocalFolders, filteredFolders, targetFolders, focusedFolder, setFocusedFolder, setTargetFolders }) => {

    const [downloadFolder, setDownloadFolder] = useState<string | null>(null);
    const [isDownloadingFolder, setIsDownloadingFolder] = useState<boolean>(false);
    const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState<boolean>(false);

    const displayFolders: string[] = useMemo(() => {
        if (!projectConfig?.folders) {
            return [];
        }

        // Sort criteria: prioritize `localFolders`, then alphabetical
        const sorted = Object.keys(projectConfig.folders).sort((a, b) => {
            const isInLocalA = localFolders.includes(a);
            const isInLocalB = localFolders.includes(b);

            if (isInLocalA && !isInLocalB) {
                return -1; // a comes before b
            }
            if (!isInLocalA && isInLocalB) {
                return 1; // b comes before a
            }
            // Alphabetical sorting as a fallback
            return a.localeCompare(b);
        });
        // Filter to only include `filteredFolders`
        return sorted.filter(folder => filteredFolders?.includes(folder));
    }, [localFolders, projectConfig?.folders, filteredFolders]);

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

    const handleInitiateFolderDownload = (folderName: string) => {
        setDownloadFolder(folderName);
        setIsDownloadDialogOpen(true);
    }

    const handleConfirmDownload = async () => {
        try {
            if (downloadFolder === null) {
                throw Error("downloadFolder passed was null. This should not be possible.");
            }
            setIsDownloadingFolder(true);
            await SyncService.DownloadLocalFolder(downloadFolder);
        } catch (e: any) {
            console.error(e);
        } finally {
            setIsDownloadDialogOpen(false);
            setIsDownloadingFolder(false);
        }
    }

    const handleDialogClose = (event, reason) => {
        if (reason === 'backdropClick' && isDownloadingFolder) {
            // Don't allow the dialog window to close while the download is running in the background.
            setIsDownloadDialogOpen(true);
            return;
        }
        setIsDownloadDialogOpen(false);
    }

    return (
        ((projectConfig !== undefined) && !isLoadingLocalFolders) ? (
            <Box height={"100%"} overflow={'auto'}>
                <List>
                    {displayFolders?.map((folderName) => (
                        <Box key={folderName} height={"100%"}>
                            <ListItem component={ListItemPaper} elevation={(focusedFolder === folderName) ? 1 : (localFolders.includes(folderName)) ? 6 : 2}>
                                <Box>
                                    <ListItemButton
                                        onClick={handleTargetFolder(folderName)}
                                        disabled={(!localFolders.includes(folderName))}
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
                                <Box>
                                    <Tooltip title={localFolders.includes(folderName) ? "" : "Download"}>
                                        <span>
                                            <ListItemButton
                                                disabled={localFolders.includes(folderName)}
                                                onClick={() => { handleInitiateFolderDownload(folderName) }}
                                            >
                                                {localFolders.includes(folderName) ? <FileDownloadDone color="disabled" /> : <Download color="primary" />}
                                            </ListItemButton>
                                        </span>
                                    </Tooltip>

                                </Box>
                                <Box width={"90%"}>
                                    <ListItemButton
                                        role={undefined}
                                        onClick={() => { setFocusedFolder((folderName === focusedFolder) ? null : folderName) }}
                                        onDoubleClick={(localFolders.includes(folderName)) ? () => { handleOpenFolder(folderName) } : () => { }}
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
                <ActionDialog
                    title={`Download Folder ${downloadFolder}?`}
                    isOpen={isDownloadDialogOpen}
                    isLoading={isDownloadingFolder}
                    isDisabled={false}
                    handleConfirm={handleConfirmDownload}
                    handleClose={handleDialogClose}
                >
                    <Typography>The selected folder will be downloaded to your local file system.</Typography>
                </ActionDialog>
            </Box>
        ) : (
            <FullHeightSkeleton />
        )
    )
}

export default FolderTree;