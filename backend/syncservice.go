package backend

import "fmt"

type SyncService struct{}

func (s *SyncService) ExecuteRcloneAction(selectedProject string, targetFolder string, action RcloneAction) error {
	project, exists := ConfigInstance.Remotes[selectedProject]
	if !exists {
		return fmt.Errorf("project not found: %s", selectedProject)
	}

	command, err := NewRcloneCommand(project, targetFolder, action)
	if err != nil {
		return err
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
