import { useEffect, useMemo, useState, useCallback } from "react";
import { RcloneAction, RcloneActionOutput } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models.ts";
import { Alert, Autocomplete, Checkbox, FormControlLabel, Grid2, Paper, Snackbar, TextField, Typography } from "@mui/material";
import { CleaningServices, CloudUpload, CloudDownload, CreateNewFolderRounded, Refresh, FolderSpecial } from "@mui/icons-material";
import GroupedFolderTree from "./GroupedFolderTree.tsx";
import { ExecuteRcloneAction } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/syncservice.ts";
import RcloneActionDialog from "./RcloneActionDialog.tsx";
import ActionIconButton from "../common/ActionIconButton.tsx";
import { ProjectSelectorChildProps } from "./ProjectSelector.tsx";
import React from "react";
import { FolderService, SyncService } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/index.ts";
import StandardDialog from "../common/StandardDialog.tsx";
import FocusedFolderControls from "./FocusedFolderControls.tsx";
import NewFolderDialog from "./NewFolderDialog.tsx";
import ManageGroupsDialog from "./ManageGroupsDialog.tsx";

const ProjectDashboard: React.FunctionComponent<ProjectSelectorChildProps> = ({ projectConfig }) => {
    // State for project list filtering
    const [searchTerm, setSearchTerm] = useState("");

    // State for Rclone command execution
    const [targetFolders, setTargetFolders] = useState<string[]>([]);
    const [rcloneActionDialogOutput, setRcloneActionDialogOutput] = useState<RcloneActionOutput[] | null>(null);
    const [isRunningRcloneAction, setIsRunningRcloneAction] = useState<boolean>(false);
    const [isRcloneDialogOpen, setIsRcloneDialogOpen] = useState<boolean>(false);
    const [activeRcloneAction, setActiveRcloneAction] = useState<RcloneAction>("" as RcloneAction);

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
    const [isDetectingChanges, setIsDetectingChanges] = useState<boolean>(false);

    // State for folders that have pending changes
    const [changedFolders, setChangedFolders] = useState<string[]>([]);

    // State for async folder downloads
    const [downloadingFolders, setDownloadingFolders] = useState<string[]>([]);
    const [downloadError, setDownloadError] = useState<{ folder: string; message: string } | null>(null);

    const areActionButtonsDisabled = useMemo(() => {
        return targetFolders.length === 0;
    }, [targetFolders])

    const handleSearchChange = (event, value) => {
        setSearchTerm(value);
    };


    const handleRcloneDialogClose = async (event, reason) => {
        if (reason === 'backdropClick' && isRunningRcloneAction) {
            // Don't allow the dialog window to close while an Rclone action is running in the background.
            setIsRcloneDialogOpen(true);
            return;
        }
        setIsRcloneDialogOpen(false);
        setRcloneActionDialogOutput(null);
        setTargetFolders([]);
    }

    const handleRcloneAction = async (rcloneAction: RcloneAction, dry: boolean) => {
        setActiveRcloneAction(rcloneAction);
        setIsRunningRcloneAction(true);
        setIsRcloneDialogOpen(true);
        const output = await ExecuteRcloneAction(targetFolders, rcloneAction, dry);
        setIsRunningRcloneAction(false);
        if (dry) {
            // Open the finalize dialog if the dry run just completed
            setIsRcloneDialogOpen(true);
            setRcloneActionDialogOutput(output);
        } else {
            // Close the finalize dialog if the final run just completed
            setIsRcloneDialogOpen(false);
            setRcloneActionDialogOutput(null);
            setTargetFolders([]);
        }
        // Reload the local folders after sync/download so the folder tree is updated
        if (activeRcloneAction === RcloneAction.COPY_PULL || activeRcloneAction === RcloneAction.SYNC_PULL) {
            const folders = await loadLocalFolders();
            if (folders) {
                detectChangedFolders(folders);
            }
        }
    }

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
        // Last, reload the local folders so that the updates are reflected in the folder tree.
        loadLocalFolders();
    }

    // Call the backend endpoint responsible for detecting which project folders are downloaded locally.
    const loadLocalFolders = useCallback(async () => {
        try {
            setIsLoadingLocalFolders(true);
            const loadedLocalFolders = await FolderService.GetLocalFolders();
            setLocalFolders(loadedLocalFolders);
            // Return the loaded local folders for any caller that needs to know them.
            return loadedLocalFolders;
        } catch (error: any) {
            console.error(`Error loading local folders:`, error);
        } finally {
            setIsLoadingLocalFolders(false);
        }
    }, [])

    // Detect and store which folders have changes
    const detectChangedFolders = useCallback(async (folders: string[]) => {
        try {
            setIsDetectingChanges(true);
            const detected = await SyncService.DetectChangedFolders(folders);
            setChangedFolders(detected);
            return detected;
        } catch (error: any) {
            console.error(`Error detecting changes in local folders:`, error);
            return [];
        } finally {
            setIsDetectingChanges(false);
        }
    }, []);

    // Check if all changed folders are currently selected
    const allChangedSelected = useMemo(() => {
        if (changedFolders.length === 0) return false;
        return changedFolders.every((folder) => targetFolders.includes(folder));
    }, [changedFolders, targetFolders]);

    // Handle "Select all changed" checkbox toggle
    const handleSelectAllChanged = useCallback(() => {
        if (allChangedSelected) {
            // Deselect all changed folders
            setTargetFolders(targetFolders.filter((f) => !changedFolders.includes(f)));
        } else {
            // Select all changed folders (add any not already selected)
            const newSelection = [...targetFolders];
            changedFolders.forEach((f) => {
                if (!newSelection.includes(f)) {
                    newSelection.push(f);
                }
            });
            setTargetFolders(newSelection);
        }
    }, [allChangedSelected, changedFolders, targetFolders]);

    // Handle async download of a single non-local folder
    const handleDownloadFolder = useCallback(async (folderKey: string) => {
        // Add to downloading list
        setDownloadingFolders((prev) => [...prev, folderKey]);
        setDownloadError(null);

        try {
            // First, create the local folder if it doesn't exist (handles empty remote folders)
            // Ignore errors if folder already exists
            try {
                await FolderService.CreateLocalFolders([folderKey]);
            } catch {
                // Folder may already exist, continue with download
            }

            // Execute download (COPY_PULL) for this single folder without dry run
            const output = await ExecuteRcloneAction([folderKey], RcloneAction.COPY_PULL, false);

            // Check if there was an error
            const folderOutput = output.find((o) => o.target_folder === folderKey);
            if (folderOutput?.command_error) {
                setDownloadError({
                    folder: folderKey,
                    message: folderOutput.command_error,
                });
            }
            // Always refresh local folders list after download attempt
            await loadLocalFolders();
        } catch (error: any) {
            setDownloadError({
                folder: folderKey,
                message: error.message || "Download failed",
            });
        } finally {
            // Remove from downloading list
            setDownloadingFolders((prev) => prev.filter((f) => f !== folderKey));
        }
    }, [loadLocalFolders]);

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
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={allChangedSelected && changedFolders.length > 0}
                                    indeterminate={!allChangedSelected && targetFolders.some((f) => changedFolders.includes(f))}
                                    onChange={handleSelectAllChanged}
                                    disabled={changedFolders.length === 0 || isDetectingChanges}
                                />
                            }
                            label={isDetectingChanges ? "Detecting..." : `Select changed (${changedFolders.length})`}
                        />
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
                        <ActionIconButton
                            tooltip="Push to Remote"
                            color="primary"
                            disabled={areActionButtonsDisabled}
                            loading={isRunningRcloneAction && activeRcloneAction === RcloneAction.SYNC_PUSH}
                            inputIcon={CloudUpload}
                            onClick={() => { handleRcloneAction(RcloneAction.SYNC_PUSH, true) }}
                        />
                        <ActionIconButton
                            tooltip="Pull from Remote"
                            color="primary"
                            disabled={areActionButtonsDisabled}
                            loading={isRunningRcloneAction && activeRcloneAction === RcloneAction.SYNC_PULL}
                            inputIcon={CloudDownload}
                            onClick={() => { handleRcloneAction(RcloneAction.SYNC_PULL, true) }}
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
                            handleClose={(event, reason) => setIsDeleteDialogOpen(false)}
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
                        <RcloneActionDialog
                            action={activeRcloneAction}
                            rcloneDryOutput={rcloneActionDialogOutput}
                            isRunningRcloneAction={isRunningRcloneAction}
                            isOpen={isRcloneDialogOpen}
                            handleClose={handleRcloneDialogClose}
                            runRcloneCommand={() => { handleRcloneAction(activeRcloneAction, false) }}
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