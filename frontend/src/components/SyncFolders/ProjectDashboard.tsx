import { useEffect, useMemo, useState } from "react";
import { RcloneAction, RcloneActionOutput } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models.ts";
import { Autocomplete, FormControlLabel, Grid2, Paper, Switch, TextField, Typography } from "@mui/material";
import { CleaningServices, CloudUpload, CloudDownload, Download, CreateNewFolderRounded, Checklist } from "@mui/icons-material";
import FolderTree from "./FolderTree.tsx";
import { ExecuteRcloneAction } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/syncservice.ts";
import RcloneActionDialog from "./RcloneActionDialog.tsx";
import ActionIconButton from "../common/ActionIconButton.tsx";
import { ProjectSelectorChildProps } from "./ProjectSelector.tsx";
import React from "react";
import { FolderService, SyncService } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/index.ts";
import StandardDialog from "../common/StandardDialog.tsx";
import FocusedFolderControls from "./FocusedFolderControls.tsx";
import NewFolderDialog from "./NewFolderDialog.tsx";

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

    // State for the folder description
    const [focusedFolder, setFocusedFolder] = useState<string | null>(null);

    // State for all folders which are in the user's file system
    const [localFolders, setLocalFolders] = useState<string[]>([]);
    const [isLoadingLocalFolders, setIsLoadingLocalFolders] = useState<boolean>(true);
    const [isDetectingChanges, setIsDetectingChanges] = useState<boolean>(false);

    // State for whether to show local or nonlocal folders
    const [isShowLocal, setIsShowLocal] = useState<boolean>(true);

    const areActionButtonsDisabled = useMemo(() => {
        return targetFolders.length === 0;
    }, [targetFolders])

    const handleSearchChange = (event, value) => {
        setSearchTerm(value);
    };

    // Memoize the filtered folders based on the search term.
    const filteredFolders = useMemo(() => {
        if (!projectConfig?.folders) {
            return [];
        }

        return Object.keys(projectConfig.folders).filter((name) =>
            name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [projectConfig?.folders, searchTerm]);


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
        if (!isShowLocal && activeRcloneAction === RcloneAction.COPY_PULL) {
            // Reload the local folders afer this action so that the folder tree is appropriately updated
            loadLocalFolders();
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
    const loadLocalFolders = async () => {
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
    }

    const markChangedFolders = async () => {
        const localFolders = await loadLocalFolders();
        try {
            setIsDetectingChanges(true);
            const changedFolders = await SyncService.DetectChangedFolders(localFolders ?? []);
            setTargetFolders(changedFolders);
        } catch (error: any) {
            console.error(`Error detecting changes in local folders:`, error);
        } finally {
            setIsDetectingChanges(false);
        }
    }

    useEffect(() => {
        // Recalculate the folders the user has locally each time the project configuration changes.
        loadLocalFolders();
    }, [projectConfig]);

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
                        <FormControlLabel control={<Switch checked={isShowLocal} onChange={() => { setIsShowLocal((prev) => (!prev)); setTargetFolders([]); }} />} label="Local" />
                        {
                            (isShowLocal) &&
                            <ActionIconButton
                                tooltip="Select All Changed"
                                color="primary"
                                disabled={false}
                                loading={isLoadingLocalFolders || isDetectingChanges}
                                inputIcon={Checklist}
                                onClick={markChangedFolders}
                            />
                        }
                        {
                            (isShowLocal) &&
                            <ActionIconButton
                                tooltip="Register New"
                                color="primary"
                                disabled={false}
                                loading={false}
                                inputIcon={CreateNewFolderRounded}
                                onClick={() => setIsNewFolderDialogOpen(true)}
                            />
                        }
                        <Autocomplete
                            freeSolo
                            options={Object.keys(projectConfig.folders).sort()}
                            value={searchTerm}
                            onInputChange={handleSearchChange}
                            renderInput={(params) => <TextField {...params} label="Search Folders" variant="outlined" fullWidth />}
                            sx={{ width: "100%" }}
                        />
                        {
                            (isShowLocal) &&
                            <ActionIconButton
                                tooltip="Remove Local"
                                color="primary"
                                disabled={areActionButtonsDisabled}
                                loading={isDeletingLocal}
                                inputIcon={CleaningServices}
                                onClick={() => setIsDeleteDialogOpen(true)}
                            />
                        }
                        {
                            (isShowLocal) &&
                            <ActionIconButton
                                tooltip="Push to Remote"
                                color="primary"
                                disabled={areActionButtonsDisabled} // TODO: Disable for folder selections that are invalid
                                loading={isRunningRcloneAction && activeRcloneAction === RcloneAction.SYNC_PUSH}
                                inputIcon={CloudUpload}
                                onClick={() => { handleRcloneAction(RcloneAction.SYNC_PUSH, true) }}
                            />
                        }
                        <ActionIconButton
                            tooltip={(isShowLocal) ? "Update from Remote" : "Download"}
                            color="primary"
                            disabled={areActionButtonsDisabled} // TODO: Disable for folder selections that are invalid
                            loading={isRunningRcloneAction && activeRcloneAction === RcloneAction.SYNC_PULL}
                            inputIcon={(isShowLocal) ? CloudDownload : Download}
                            onClick={() => { handleRcloneAction((isShowLocal) ? RcloneAction.SYNC_PULL : RcloneAction.COPY_PULL, true) }}
                        />
                        <NewFolderDialog
                            isOpen={isNewFolderDialogOpen}
                            setIsOpen={setIsNewFolderDialogOpen}
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
                        <FolderTree
                            isShowLocal={isShowLocal}
                            projectConfig={projectConfig}
                            localFolders={localFolders}
                            isLoadingLocalFolders={isLoadingLocalFolders}
                            filteredFolders={filteredFolders}
                            targetFolders={targetFolders}
                            focusedFolder={focusedFolder}
                            setFocusedFolder={setFocusedFolder}
                            setTargetFolders={setTargetFolders} />
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