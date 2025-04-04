package backend

import (
	"fmt"
	"os"
	"strings"
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

// Error handling is done per request, and gracefully returned to the user for evaluation in the frontend.
func (ss *SyncService) ExecuteRcloneAction(targetFolders []string, action RcloneAction, dry bool) []RcloneActionOutput {
	// Create an array to store the results
	var outputs []RcloneActionOutput
	// Use a WaitGroup to wait for all goroutines to complete
	var wg sync.WaitGroup
	// Use a channel to collect the results
	resultChan := make(chan RcloneActionOutput, len(targetFolders))

	for _, targetFolder := range targetFolders {
		// Increment the WaitGroup counter
		wg.Add(1)
		go func(targetFolder string) {
			defer wg.Done()

			// Access the project config for each target folder
			folderConfig, exists := ss.configManager.GetProjectConfig().Folders[targetFolder]
			if !exists {
				resultChan <- RcloneActionOutput{
					TargetFolder:  targetFolder,
					CommandOutput: "",
					CommandError:  fmt.Errorf("target folder configuration not found: %s", targetFolder).Error(),
				}
				return
			}

			// Get the remote config from the global config
			remoteConfig := ss.configManager.GetGlobalConfig().Remotes[ss.configManager.GetGlobalConfig().SelectedProject]
			fullLocalPath := fmt.Sprintf("%s/%s", remoteConfig.LocalPath, folderConfig.LocalPath)
			fullRemotePath := fmt.Sprintf("%s:%s/%s", remoteConfig.RemoteName, remoteConfig.BucketName, folderConfig.RemotePath)

			// Check if the local directory exists
			_, err := os.Stat(fullLocalPath)
			if !IsFolderOptional(action) {
				if os.IsNotExist(err) {
					resultChan <- RcloneActionOutput{
						TargetFolder:  targetFolder,
						CommandOutput: "",
						CommandError:  fmt.Errorf("local path does not exist: %s", fullLocalPath).Error(),
					}
					return
				} else if err != nil {
					resultChan <- RcloneActionOutput{
						TargetFolder:  targetFolder,
						CommandOutput: "",
						CommandError:  fmt.Errorf("error accessing local path %s: %v", fullLocalPath, err).Error(),
					}
					return
				}
			}

			// Create the Rclone command for this folder
			command, err := NewRcloneCommand(fullRemotePath, fullLocalPath, action, dry)
			if err != nil {
				resultChan <- RcloneActionOutput{TargetFolder: targetFolder, CommandOutput: "", CommandError: err.Error()}
				return
			}

			// Execute the command and collect the output
			output, err := command.Exec()
			if err != nil {
				resultChan <- RcloneActionOutput{TargetFolder: targetFolder, CommandOutput: "", CommandError: err.Error()}
				return
			}

			// Send the result to the result channel
			resultChan <- RcloneActionOutput{TargetFolder: targetFolder, CommandOutput: output, CommandError: ""}
		}(targetFolder)
	}

	// Wait for all goroutines to finish
	wg.Wait()
	// Close channel
	close(resultChan)
	// Collect results
	for result := range resultChan {
		outputs = append(outputs, result)
	}

	return outputs
}

// This function performs the full backup to the specified location for the configured remote.
func (ss *SyncService) ExecuteFullBackup(dry bool) []RcloneActionOutput {
	// Create an array to store the results. Note that though we only will have one RcloneActionOutput, we'll return the array so that
	// the output can easily be integrated with the generic RcloneActionOutputTabs component.
	var outputs []RcloneActionOutput
	// Get the remote config from the global config.
	selectedProject := ss.configManager.GetGlobalConfig().SelectedProject
	remoteConfig := ss.configManager.GetGlobalConfig().Remotes[selectedProject]
	selectedProject = selectedProject + " - Backup"
	// Because we're syncing the entire project to the backup location, just get the top level paths (not folders) for the
	// local and remote locations.
	fullLocalPath := remoteConfig.FullBackupPath
	fullRemotePath := fmt.Sprintf("%s:%s", remoteConfig.RemoteName, remoteConfig.BucketName)

	// Check if the local directory exists
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
		// Create the Rclone command for this folder.
		command, err := NewRcloneCommand(fullRemotePath, fullLocalPath, SYNC_PULL, dry)
		if err != nil {
			outputs = append(outputs, RcloneActionOutput{TargetFolder: selectedProject, CommandOutput: "", CommandError: err.Error()})
		}
		// Execute the command and collect the output.
		output, err := command.Exec()
		if err != nil {
			outputs = append(outputs, RcloneActionOutput{TargetFolder: selectedProject, CommandOutput: "", CommandError: err.Error()})
		} else {
			// Add the successful output to the output array.
			outputs = append(outputs, RcloneActionOutput{TargetFolder: selectedProject, CommandOutput: output, CommandError: ""})
		}
	}
	return outputs
}

// Detect which of the given local folders have any updates. This is a naive check, as it does no checks on modified time to see
// whether the changes are local or upstream. It's up to the user to be careful.
// TODO: Flesh this check out, possibly using "rclone check", especially in cases where multiple users are working on the project at once.
func (ss *SyncService) DetectChangedFolders(localFolders []string) []string {
	// Run a parallel test sync for all the local folders to detect changes.
	dryRunOutput := ss.ExecuteRcloneAction(localFolders, SYNC_PUSH, true)

	// Collect folders where the output indicates a change.
	var changedFolders []string
	for _, output := range dryRunOutput {
		// The "--dry-run" string only appears if any files show up in the debug output. If not, this won't be there.
		if strings.Contains(output.CommandOutput, "--dry-run") {
			changedFolders = append(changedFolders, output.TargetFolder)
		}
	}

	return changedFolders
}
