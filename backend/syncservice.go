package backend

import (
	"fmt"
	"os"
	"sync"
)

type SyncService struct {
	configManager *ConfigManager
}

func NewSyncService(configManager *ConfigManager) *SyncService {
	return &SyncService{configManager: configManager}
}

type RcloneActionOutput struct {
	TargetFolder  string `json:"target_folder"`
	CommandOutput string `json:"command_output"`
	CommandError  string `json:"command_error"`
}

// executeSingleFolder runs a single rclone action for one folder and returns the result.
// This is the core logic extracted from ExecuteRcloneAction's goroutine body.
func (ss *SyncService) executeSingleFolder(targetFolder string, action RcloneAction, dry bool) RcloneActionOutput {
	// Access the project config for the target folder
	folderConfig, exists := ss.configManager.GetProjectConfig().Folders[targetFolder]
	if !exists {
		return RcloneActionOutput{
			TargetFolder:  targetFolder,
			CommandOutput: "",
			CommandError:  fmt.Errorf("target folder configuration not found: %s", targetFolder).Error(),
		}
	}

	// Get the remote config from the global config
	remoteConfig := ss.configManager.GetGlobalConfig().Remotes[ss.configManager.GetGlobalConfig().SelectedProject]
	fullLocalPath := fmt.Sprintf("%s/%s", remoteConfig.LocalPath, folderConfig.LocalPath)
	fullRemotePath := fmt.Sprintf("%s:%s/%s", remoteConfig.RemoteName, remoteConfig.BucketName, folderConfig.RemotePath)

	// Check if the local directory exists
	_, err := os.Stat(fullLocalPath)
	if !IsFolderOptional(action) {
		if os.IsNotExist(err) {
			return RcloneActionOutput{
				TargetFolder:  targetFolder,
				CommandOutput: "",
				CommandError:  fmt.Errorf("local path does not exist: %s", fullLocalPath).Error(),
			}
		} else if err != nil {
			return RcloneActionOutput{
				TargetFolder:  targetFolder,
				CommandOutput: "",
				CommandError:  fmt.Errorf("error accessing local path %s: %v", fullLocalPath, err).Error(),
			}
		}
	}

	// Execute the rclone operation via librclone RPC
	var output string
	var rpcErr error

	switch action {
	case SYNC_PUSH:
		output, rpcErr = RcloneSync(fullLocalPath, fullRemotePath, dry)
	case SYNC_PULL:
		output, rpcErr = RcloneSync(fullRemotePath, fullLocalPath, dry)
	case COPY_PULL:
		output, rpcErr = RcloneCopy(fullRemotePath, fullLocalPath, dry)
	default:
		return RcloneActionOutput{TargetFolder: targetFolder, CommandOutput: "", CommandError: fmt.Sprintf("unsupported action: %s", action)}
	}

	if rpcErr != nil {
		return RcloneActionOutput{TargetFolder: targetFolder, CommandOutput: "", CommandError: rpcErr.Error()}
	}

	return RcloneActionOutput{TargetFolder: targetFolder, CommandOutput: output, CommandError: ""}
}

// Error handling is done per request, and gracefully returned to the user for evaluation in the frontend.
func (ss *SyncService) ExecuteRcloneAction(targetFolders []string, action RcloneAction, dry bool) []RcloneActionOutput {
	var outputs []RcloneActionOutput
	var wg sync.WaitGroup
	resultChan := make(chan RcloneActionOutput, len(targetFolders))

	for _, targetFolder := range targetFolders {
		wg.Add(1)
		go func(tf string) {
			defer wg.Done()
			resultChan <- ss.executeSingleFolder(tf, action, dry)
		}(targetFolder)
	}

	wg.Wait()
	close(resultChan)
	for result := range resultChan {
		outputs = append(outputs, result)
	}

	return outputs
}

// ExecuteRcloneActionAsync runs the rclone action for each folder in parallel,
// emitting a "task-folder-complete" event as each folder finishes.
// When all folders are done, emits a "task-complete" event.
// Returns immediately; the taskID correlates events to the original request.
func (ss *SyncService) ExecuteRcloneActionAsync(taskID string, targetFolders []string, action RcloneAction, dry bool) error {
	go func() {
		var wg sync.WaitGroup

		for _, tf := range targetFolders {
			wg.Add(1)
			go func(tf string) {
				defer wg.Done()
				result := ss.executeSingleFolder(tf, action, dry)
				emitEvent(EventTaskFolderComplete, TaskFolderCompletePayload{
					TaskID:        taskID,
					TargetFolder:  result.TargetFolder,
					CommandOutput: result.CommandOutput,
					CommandError:  result.CommandError,
				})
			}(tf)
		}

		wg.Wait()
		emitEvent(EventTaskComplete, TaskCompletePayload{TaskID: taskID})
	}()
	return nil
}

// This function performs the full backup to the specified location for the configured remote.
func (ss *SyncService) ExecuteFullBackup(dry bool) []RcloneActionOutput {
	var outputs []RcloneActionOutput
	selectedProject := ss.configManager.GetGlobalConfig().SelectedProject
	remoteConfig := ss.configManager.GetGlobalConfig().Remotes[selectedProject]
	selectedProject = selectedProject + " - Backup"
	fullLocalPath := remoteConfig.FullBackupPath
	fullRemotePath := fmt.Sprintf("%s:%s", remoteConfig.RemoteName, remoteConfig.BucketName)

	_, err := os.Stat(fullLocalPath)
	if os.IsNotExist(err) {
		outputs = append(outputs, RcloneActionOutput{
			TargetFolder:  selectedProject,
			CommandOutput: "",
			CommandError:  fmt.Errorf("local path does not exist: %s", fullLocalPath).Error(),
		})
	} else if err != nil {
		outputs = append(outputs, RcloneActionOutput{
			TargetFolder:  selectedProject,
			CommandOutput: "",
			CommandError:  fmt.Errorf("error accessing local path %s: %v", fullLocalPath, err).Error(),
		})
	} else {
		output, rpcErr := RcloneSync(fullRemotePath, fullLocalPath, dry)
		if rpcErr != nil {
			outputs = append(outputs, RcloneActionOutput{TargetFolder: selectedProject, CommandOutput: "", CommandError: rpcErr.Error()})
		} else {
			outputs = append(outputs, RcloneActionOutput{TargetFolder: selectedProject, CommandOutput: output, CommandError: ""})
		}
	}
	return outputs
}

// ExecuteFullBackupAsync runs the full backup in a background goroutine,
// emitting events as the operation completes.
func (ss *SyncService) ExecuteFullBackupAsync(taskID string, dry bool) error {
	go func() {
		selectedProject := ss.configManager.GetGlobalConfig().SelectedProject
		remoteConfig := ss.configManager.GetGlobalConfig().Remotes[selectedProject]
		label := selectedProject + " - Backup"
		fullLocalPath := remoteConfig.FullBackupPath
		fullRemotePath := fmt.Sprintf("%s:%s", remoteConfig.RemoteName, remoteConfig.BucketName)

		var result RcloneActionOutput
		_, err := os.Stat(fullLocalPath)
		if os.IsNotExist(err) {
			result = RcloneActionOutput{TargetFolder: label, CommandOutput: "", CommandError: fmt.Sprintf("local path does not exist: %s", fullLocalPath)}
		} else if err != nil {
			result = RcloneActionOutput{TargetFolder: label, CommandOutput: "", CommandError: fmt.Sprintf("error accessing local path %s: %v", fullLocalPath, err)}
		} else {
			output, rpcErr := RcloneSync(fullRemotePath, fullLocalPath, dry)
			if rpcErr != nil {
				result = RcloneActionOutput{TargetFolder: label, CommandOutput: "", CommandError: rpcErr.Error()}
			} else {
				result = RcloneActionOutput{TargetFolder: label, CommandOutput: output, CommandError: ""}
			}
		}

		emitEvent(EventTaskFolderComplete, TaskFolderCompletePayload{
			TaskID:        taskID,
			TargetFolder:  result.TargetFolder,
			CommandOutput: result.CommandOutput,
			CommandError:  result.CommandError,
		})
		emitEvent(EventTaskComplete, TaskCompletePayload{TaskID: taskID})
	}()
	return nil
}

// Detect which of the given local folders have any updates by comparing file listings.
func (ss *SyncService) DetectChangedFolders(localFolders []string) []string {
	var changedFolders []string
	for _, folder := range localFolders {
		folderConfig, exists := ss.configManager.GetProjectConfig().Folders[folder]
		if !exists {
			continue
		}
		remoteConfig := ss.configManager.GetGlobalConfig().Remotes[ss.configManager.GetGlobalConfig().SelectedProject]
		fullLocalPath := fmt.Sprintf("%s/%s", remoteConfig.LocalPath, folderConfig.LocalPath)
		fullRemotePath := fmt.Sprintf("%s:%s/%s", remoteConfig.RemoteName, remoteConfig.BucketName, folderConfig.RemotePath)

		hasChanges, err := RcloneHasChanges(fullLocalPath, fullRemotePath)
		if err != nil {
			fmt.Printf("[WARN] detect changes failed for %s: %v\n", folder, err)
			continue
		}
		if hasChanges {
			changedFolders = append(changedFolders, folder)
		}
	}
	return changedFolders
}

// DetectChangedFoldersAsync runs change detection in parallel, emitting per-folder events.
// Emits "detect-folder-complete" for each folder and "detect-complete" when all done.
func (ss *SyncService) DetectChangedFoldersAsync(taskID string, localFolders []string) error {
	go func() {
		var wg sync.WaitGroup

		for _, f := range localFolders {
			wg.Add(1)
			go func(f string) {
				defer wg.Done()

				folderConfig, exists := ss.configManager.GetProjectConfig().Folders[f]
				if !exists {
					emitEvent(EventDetectFolderComplete, DetectFolderCompletePayload{
						TaskID:       taskID,
						TargetFolder: f,
						HasChanges:   false,
						CommandError: fmt.Sprintf("folder config not found: %s", f),
					})
					return
				}

				remoteConfig := ss.configManager.GetGlobalConfig().Remotes[ss.configManager.GetGlobalConfig().SelectedProject]
				fullLocalPath := fmt.Sprintf("%s/%s", remoteConfig.LocalPath, folderConfig.LocalPath)
				fullRemotePath := fmt.Sprintf("%s:%s/%s", remoteConfig.RemoteName, remoteConfig.BucketName, folderConfig.RemotePath)

				hasChanges, err := RcloneHasChanges(fullLocalPath, fullRemotePath)
				var cmdError string
				if err != nil {
					cmdError = err.Error()
				}

				emitEvent(EventDetectFolderComplete, DetectFolderCompletePayload{
					TaskID:       taskID,
					TargetFolder: f,
					HasChanges:   hasChanges,
					CommandError: cmdError,
				})
			}(f)
		}

		wg.Wait()
		emitEvent(EventDetectComplete, DetectCompletePayload{TaskID: taskID})
	}()
	return nil
}
