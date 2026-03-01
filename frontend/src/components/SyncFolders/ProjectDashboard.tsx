import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { RcloneAction } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models.ts";
import { Alert, Autocomplete, Box, Checkbox, FormControlLabel, Grid2, Paper, Snackbar, TextField, Typography } from "@mui/material";
import { CleaningServices, CloudUpload, CloudDownload, CreateNewFolderRounded, Refresh, FolderSpecial } from "@mui/icons-material";
import GroupedFolderTree from "./GroupedFolderTree.tsx";
import ActionIconButton from "../common/ActionIconButton.tsx";
import SplitActionButton from "../common/SplitActionButton.tsx";
import { ProjectSelectorChildProps } from "./ProjectSelector.tsx";
import React from "react";
import { FolderService } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/index.ts";
import StandardDialog from "../common/StandardDialog.tsx";
import FocusedFolderControls from "./FocusedFolderControls.tsx";
import NewFolderDialog from "./NewFolderDialog.tsx";
import ManageGroupsDialog from "./ManageGroupsDialog.tsx";
import { useTaskQueue } from "../../hooks/TaskQueueContext.tsx";

const ProjectDashboard: React.FunctionComponent<ProjectSelectorChildProps> = ({ projectConfig }) => {
    const { tasks, startRcloneAction, startDetectChanges, detectedChangedFolders, checkedFolders, isDetectingChanges } = useTaskQueue();

    // State for project list filtering
    const [searchTerm, setSearchTerm] = useState("");

    // State for folder selection
    const [targetFolders, setTargetFolders] = useState<string[]>([]);

    // State for local deletion
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
    const [isDeletingLocal, setIsDeletingLocal] = useState<boolean>(false);

    // State for new folder registration
    const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState<boolean>(false)

    // State for group management
    const [isManageGroupsDialogOpen, setIsManageGroupsDialogOpen] = useState<boolean>(false)

    // State for the folder description
    const [focusedFolder, setFocusedFolder] = useState<string | null>(null);

    // State for all folders which are in the user's file system
    const [localFolders, setLocalFolders] = useState<string[]>([]);
    const [isLoadingLocalFolders, setIsLoadingLocalFolders] = useState<boolean>(true);

    // State for async folder downloads
    const [downloadingFolders, setDownloadingFolders] = useState<string[]>([]);
    const [downloadError, setDownloadError] = useState<{ folder: string; message: string } | null>(null);

    const areActionButtonsDisabled = useMemo(() => {
        return targetFolders.length === 0;
    }, [targetFolders])

    const handleSearchChange = (_event, value) => {
        setSearchTerm(value);
    };

    // Submit an rclone action to the task queue (non-blocking)
    const handleRcloneAction = useCallback((rcloneAction: RcloneAction, dry: boolean) => {
        startRcloneAction(targetFolders, rcloneAction, dry);
        setTargetFolders([]);
    }, [targetFolders, startRcloneAction]);

    // Delete the targeted folders from the local file system.
    const handleRemoveLocal = async () => {
        try {
            setIsDeletingLocal(true);
            await FolderService.DeleteLocalFolders(targetFolders);
        } catch (e: any) {
            console.error(e);
        } finally {
            setIsDeletingLocal(false);
            setIsDeleteDialogOpen(false);
            setTargetFolders([]);
        }
        loadLocalFolders();
    }

    // Call the backend endpoint responsible for detecting which project folders are downloaded locally.
    const loadLocalFolders = useCallback(async () => {
        try {
            setIsLoadingLocalFolders(true);
            const loadedLocalFolders = await FolderService.GetLocalFolders();
            setLocalFolders(loadedLocalFolders);
            return loadedLocalFolders;
        } catch (error: any) {
            console.error(`Error loading local folders:`, error);
        } finally {
            setIsLoadingLocalFolders(false);
        }
    }, [])

    // Trigger async change detection via the task queue
    const detectChangedFolders = useCallback((folders: string[]) => {
        startDetectChanges(folders);
    }, [startDetectChanges]);

    // Use changedFolders from the task queue context
    const changedFolders = detectedChangedFolders;

    // Check if all changed folders are currently selected
    const allChangedSelected = useMemo(() => {
        if (changedFolders.length === 0) return false;
        return changedFolders.every((folder) => targetFolders.includes(folder));
    }, [changedFolders, targetFolders]);

    // Handle "Select all changed" checkbox toggle
    const handleSelectAllChanged = useCallback(() => {
        if (allChangedSelected) {
            setTargetFolders(targetFolders.filter((f) => !changedFolders.includes(f)));
        } else {
            const newSelection = [...targetFolders];
            changedFolders.forEach((f) => {
                if (!newSelection.includes(f)) {
                    newSelection.push(f);
                }
            });
            setTargetFolders(newSelection);
        }
    }, [allChangedSelected, changedFolders, targetFolders]);

    // Handle async download of a single non-local folder (still uses old blocking path for now)
    const handleDownloadFolder = useCallback(async (folderKey: string) => {
        setDownloadingFolders((prev) => [...prev, folderKey]);
        setDownloadError(null);

        try {
            try {
                await FolderService.CreateLocalFolders([folderKey]);
            } catch {
                // Folder may already exist, continue with download
            }

            // Use the task queue for download too
            startRcloneAction([folderKey], RcloneAction.COPY_PULL, false);
            // Refresh local folders list after a short delay to allow the download to start
            setTimeout(async () => {
                await loadLocalFolders();
                setDownloadingFolders((prev) => prev.filter((f) => f !== folderKey));
            }, 2000);
        } catch (error: any) {
            setDownloadError({
                folder: folderKey,
                message: error.message || "Download failed",
            });
            setDownloadingFolders((prev) => prev.filter((f) => f !== folderKey));
        }
    }, [loadLocalFolders, startRcloneAction]);

    useEffect(() => {
        // Recalculate the folders the user has locally and detect changes
        const loadAndDetect = async () => {
            const folders = await loadLocalFolders();
            if (folders) {
                detectChangedFolders(folders);
            }
        };
        loadAndDetect();
    }, [projectConfig, detectChangedFolders, loadLocalFolders]);

    // Re-trigger change detection when a final (non-dry) task completes successfully
    const handledTaskCompletions = useRef<Set<string>>(new Set());
    useEffect(() => {
        for (const task of Object.values(tasks)) {
            if (
                task.status === "completed" &&
                task.phase === "final" &&
                task.type !== "detect-changes" &&
                !handledTaskCompletions.current.has(task.taskId)
            ) {
                handledTaskCompletions.current.add(task.taskId);
                loadLocalFolders().then(folders => {
                    if (folders) detectChangedFolders(folders);
                });
                break; // one re-detection per render is enough
            }
        }
    }, [tasks, loadLocalFolders, detectChangedFolders]);

    return (
        (projectConfig.folders) ? (
            <Grid2 container spacing={1} size={12} height={"100%"}>
                <Grid2 container spacing={1} size={7} height={"100%"} display={"table"}>
                    {/* Control Bar */}
                    <Grid2
                        size={12}
                        component={Paper}
                        display={"flex"}
                        justifyContent={"space-between"}
                        alignItems={"center"}
                        padding={"10px"}
                        height={"14%"}
                    >
                        <Box sx={{ minWidth: 180, marginRight: 2 }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={allChangedSelected && changedFolders.length > 0}
                                        indeterminate={!allChangedSelected && targetFolders.some((f) => changedFolders.includes(f))}
                                        onChange={handleSelectAllChanged}
                                        disabled={changedFolders.length === 0 || isDetectingChanges}
                                    />
                                }
                                label={isDetectingChanges ? "Detecting..." : `Select Changed: ${changedFolders.length}`}
                            />
                        </Box>
                        <ActionIconButton
                            tooltip="Refresh - Detect Changed Folders"
                            color="primary"
                            disabled={isLoadingLocalFolders || isDetectingChanges}
                            loading={isDetectingChanges}
                            inputIcon={Refresh}
                            onClick={async () => {
                                const folders = await loadLocalFolders();
                                if (folders) {
                                    detectChangedFolders(folders);
                                }
                            }}
                        />
                        <ActionIconButton
                            tooltip="Manage Groups"
                            color="primary"
                            disabled={false}
                            loading={false}
                            inputIcon={FolderSpecial}
                            onClick={() => setIsManageGroupsDialogOpen(true)}
                        />
                        <ActionIconButton
                            tooltip="Register New Folder"
                            color="primary"
                            disabled={false}
                            loading={false}
                            inputIcon={CreateNewFolderRounded}
                            onClick={() => setIsNewFolderDialogOpen(true)}
                        />
                        <Autocomplete
                            freeSolo
                            options={Object.keys(projectConfig.folders).sort()}
                            value={searchTerm}
                            onInputChange={handleSearchChange}
                            renderInput={(params) => <TextField {...params} label="Search Folders" variant="outlined" fullWidth />}
                            sx={{ width: "100%" }}
                        />
                        <ActionIconButton
                            tooltip="Remove Local"
                            color="primary"
                            disabled={areActionButtonsDisabled}
                            loading={isDeletingLocal}
                            inputIcon={CleaningServices}
                            onClick={() => setIsDeleteDialogOpen(true)}
                        />
                        <SplitActionButton
                            tooltip="Push to Remote (preview first)"
                            color="primary"
                            disabled={areActionButtonsDisabled}
                            inputIcon={CloudUpload}
                            onClickDefault={() => handleRcloneAction(RcloneAction.SYNC_PUSH, true)}
                            onClickDirect={() => handleRcloneAction(RcloneAction.SYNC_PUSH, false)}
                        />
                        <SplitActionButton
                            tooltip="Pull from Remote (preview first)"
                            color="primary"
                            disabled={areActionButtonsDisabled}
                            inputIcon={CloudDownload}
                            onClickDefault={() => handleRcloneAction(RcloneAction.SYNC_PULL, true)}
                            onClickDirect={() => handleRcloneAction(RcloneAction.SYNC_PULL, false)}
                        />
                        <NewFolderDialog
                            isOpen={isNewFolderDialogOpen}
                            setIsOpen={setIsNewFolderDialogOpen}
                        />
                        <ManageGroupsDialog
                            isOpen={isManageGroupsDialogOpen}
                            setIsOpen={setIsManageGroupsDialogOpen}
                        />
                        <StandardDialog
                            title="Delete Selected Folders?"
                            isDisabled={false}
                            isLoading={isDeletingLocal}
                            isOpen={isDeleteDialogOpen}
                            handleClose={(_event, _reason) => setIsDeleteDialogOpen(false)}
                            handleConfirm={handleRemoveLocal}
                        >
                            <Typography>All selected folders will be deleted from your local file system.</Typography>
                        </StandardDialog>
                    </Grid2>
                    <Grid2 size={12} height={"86%"} display={"table"}>
                        <GroupedFolderTree
                            projectConfig={projectConfig}
                            localFolders={localFolders}
                            changedFolders={changedFolders}
                            checkedFolders={checkedFolders}
                            downloadingFolders={downloadingFolders}
                            isLoadingLocalFolders={isLoadingLocalFolders}
                            isDetectingChanges={isDetectingChanges}
                            searchTerm={searchTerm}
                            targetFolders={targetFolders}
                            focusedFolder={focusedFolder}
                            setFocusedFolder={setFocusedFolder}
                            setTargetFolders={setTargetFolders}
                            onDownloadFolder={handleDownloadFolder}
                        />
                    </Grid2>
                </Grid2>
                <Grid2 container spacing={0} size={5} height={"100%"}>
                    <FocusedFolderControls
                        focusedFolder={focusedFolder}
                        localFolders={localFolders}
                        projectConfig={projectConfig}
                        setFocusedFolder={setFocusedFolder}
                    />
                </Grid2>

                {/* Download error snackbar */}
                <Snackbar
                    open={downloadError !== null}
                    autoHideDuration={6000}
                    onClose={() => setDownloadError(null)}
                    anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                >
                    <Alert
                        onClose={() => setDownloadError(null)}
                        severity="error"
                        variant="filled"
                    >
                        Failed to download "{downloadError?.folder}": {downloadError?.message}
                    </Alert>
                </Snackbar>
            </Grid2>

        ) : (
            <Grid2 size={12}>
                <Typography variant="body1" color="textSecondary">
                    No folders available for the selected project.
                </Typography>
            </Grid2>
        )
    )
}

export default ProjectDashboard;
