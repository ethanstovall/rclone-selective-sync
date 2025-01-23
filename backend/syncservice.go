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

// Error handling is done per request, and gracefully returned to the user for evaluation in the frontend.
func (ss *SyncService) ExecuteRcloneAction(targetFolders []string, action RcloneAction, dry bool) []RcloneActionOutput {
	// Create a map to store the results
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
