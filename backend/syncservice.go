package backend

import (
	"encoding/json"
	"fmt"
	"os/exec"
)

type SyncService struct{}

func (s *SyncService) Test() error {
	selectedProject := ConfigInstance.SelectedProject
	rcloneConfig := ConfigInstance.Projects[selectedProject]
	cmd := exec.Command(
		"rclone",
		"sync",
		rcloneConfig.LocalPath,
		fmt.Sprintf("%s:%s", rcloneConfig.RemoteName, rcloneConfig.BucketName),
		"--dry-run",
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to run 'rclone config file': %v", err)
	}
	fmt.Println("Dry run output:" + string(output))
	// remoteName := config.RemoteName
	// localPath := config.LocalPath
	b, err := json.MarshalIndent(rcloneConfig, "", "  ")
	if err != nil {
		return fmt.Errorf("error:", err)
	}
	fmt.Print(string(b))
	return nil
}
