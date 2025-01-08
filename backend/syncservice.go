package backend

import (
	"fmt"
)

type SyncService struct {
	configManager *ConfigManager
}

func NewSyncService(configManager *ConfigManager) *SyncService {
	return &SyncService{configManager: configManager}
}

func (ss *SyncService) ExecuteRcloneAction(targetFolder string, action RcloneAction) (string, error) {
	remoteConfig := ss.configManager.GetGlobalConfig().Remotes[ss.configManager.GetGlobalConfig().SelectedProject]
	projectConfig, exists := ss.configManager.GetProjectConfig().Folders[targetFolder]
	if !exists {
		return "", fmt.Errorf("target folder not found: %s", targetFolder)
	}
	command, err := NewRcloneCommand(remoteConfig, projectConfig.RemotePath, projectConfig.LocalPath, action)
	if err != nil {
		return "", err
	}
	return command.Exec()
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
