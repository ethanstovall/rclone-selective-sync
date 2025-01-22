import { useEffect, useMemo, useState } from "react";
import { RcloneAction, RcloneActionOutput } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/models.ts";
import { Autocomplete, FormControlLabel, Grid2, Paper, Switch, TextField, Typography } from "@mui/material";
import { CleaningServices, CloudUpload, CloudDownload, Download } from "@mui/icons-material";
import FolderTree from "./FolderTree.tsx";
import { ExecuteRcloneAction } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/syncservice.ts";
import RcloneActionDialog from "./RcloneActionDialog.tsx";
import ActionIconButton from "../common/ActionIconButton.tsx";
import { ProjectSelectorChildProps } from "./ProjectSelector.tsx";
import React from "react";
import FolderDescription from "./FolderDescription.tsx";
import { FileSystemService } from "../../../bindings/github.com/ethanstovall/rclone-selective-sync/backend/index.ts";
import StandardDialog from "../common/StandardDialog.tsx";

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

    // State for the folder description
    const [focusedFolder, setFocusedFolder] = useState<string | null>(null);

    // State for all folders which are in the user's file system
    const [localFolders, setLocalFolders] = useState<string[]>([]);
    const [isLoadingLocalFolders, setIsLoadingLocalFolders] = useState<boolean>(true);

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
            await FileSystemService.DeleteLocalFolders(targetFolders);
        } catch (e: any) {
            console.error(e);
        } finally {
            setIsDeletingLocal(false);
            setIsDeleteDialogOpen(false);
        }
        // Last, reload the local folders so that the updates are reflected in the folder tree.
        loadLocalFolders();
    }

    const loadLocalFolders = async () => {
        try {
            setIsLoadingLocalFolders(true);
            const loadedLocalFolders = await FileSystemService.GetLocalFolders();
            setLocalFolders(loadedLocalFolders);
        } catch (error: any) {
            console.error(`Error loading local folders:`, error);
        } finally {
            setIsLoadingLocalFolders(false);
        }
    }

    useEffect(() => {
        loadLocalFolders();
    }, []);

    return (
        <Grid2 container spacing={1} size={12} height={"100%"}>
            {
                (projectConfig.folders) ? (
                    <React.Fragment>
                        <Grid2 container spacing={0} size={6} height={"100%"} display={"table"}>
                            {/* Control Bar */}
                            <Grid2
                                size={12}
                                component={Paper}
                                display={"flex"}
                                justifyContent={"space-between"}
                                alignItems={"center"}
                                padding={"10px"}
                            >
                                <FormControlLabel control={<Switch checked={isShowLocal} onChange={() => { setIsShowLocal((prev) => (!prev)); setTargetFolders([]); }} />} label="Local" />
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
                            <Grid2 size={12}>
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
                        <Grid2 container spacing={0} size={6} height={"100%"}>
                            <Grid2 size={12} height={"100%"}>
                                {
                                    (focusedFolder) && <FolderDescription folderDetails={projectConfig.folders[focusedFolder]} closeDescription={() => { setFocusedFolder(null) }} />
                                }
                            </Grid2>
                        </Grid2>
                    </React.Fragment>

                ) : (
                    <Grid2 size={12}>
                        <Typography variant="body1" color="textSecondary">
                            No folders available for the selected project.
                        </Typography>
                    </Grid2>
                )
            }
        </Grid2>
    )
}

export default ProjectDashboard;