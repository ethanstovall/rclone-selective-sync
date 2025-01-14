package backend

import (
	"fmt"
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
	CommandError  error  `json:"command_error"`
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
			projectConfig, exists := ss.configManager.GetProjectConfig().Folders[targetFolder]
			if !exists {
				resultChan <- RcloneActionOutput{TargetFolder: targetFolder, CommandOutput: "", CommandError: fmt.Errorf("target folder not found: %s", targetFolder)}
				return
			}

			// Create the Rclone command for this folder
			remoteConfig := ss.configManager.GetGlobalConfig().Remotes[ss.configManager.GetGlobalConfig().SelectedProject]
			command, err := NewRcloneCommand(remoteConfig, projectConfig.RemotePath, projectConfig.LocalPath, action, dry)
			if err != nil {
				resultChan <- RcloneActionOutput{TargetFolder: targetFolder, CommandOutput: "", CommandError: err}
				return
			}

			// Execute the command and collect the output
			output, err := command.Exec()
			if err != nil {
				resultChan <- RcloneActionOutput{TargetFolder: targetFolder, CommandOutput: "", CommandError: err}
				return
			}

			// Send the result to the result channel
			resultChan <- RcloneActionOutput{TargetFolder: targetFolder, CommandOutput: output, CommandError: nil}
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

// func (s *SyncService) Test() error {
// 	selectedProject := ConfigInstance.SelectedProject
// 	rcloneConfig := ConfigInstance.Projects[selectedProject]
// 	cmd := exec.Command(
// 		"rclone",
// 		"sync",
// 		rcloneConfig.LocalPath,
// 		fmt.Sprintf("%s:%s", rcloneConfig.RemoteName, rcloneConfig.BucketName),
// 		"--dry-run",
// 	)
// 	output, err := cmd.CombinedOutput()
// 	if err != nil {
// 		return fmt.Errorf("failed to run 'rclone config file': %v", err)
// 	}
// 	fmt.Println("Dry run output:" + string(output))
// 	// remoteName := config.RemoteName
// 	// localPath := config.LocalPath
// 	b, err := json.MarshalIndent(rcloneConfig, "", "  ")
// 	if err != nil {
// 		return fmt.Errorf("error:", err)
// 	}

// func (s *SyncService) Test(selectedProject string, targetFolder string, action RcloneAction) error {
// 	cmd := RcloneCommand(selectedProject, targetFolder, action)
// 	cmd
// 	return nil
// }
