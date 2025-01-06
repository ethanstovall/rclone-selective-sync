package backend

import (
	"fmt"
	"os/exec"
)

type RcloneCommand struct {
	command *exec.Cmd
}

func NewRcloneCommand(selectedProject RemoteConfig, targetFolder string, action RcloneAction) (*RcloneCommand, error) {
	var cmd *exec.Cmd

	remotePath := fmt.Sprintf("%s:%s/%s", selectedProject.RemoteName, selectedProject.BucketName, targetFolder)

	switch action {
	case PUSH:
		cmd = exec.Command("rclone", "sync", selectedProject.LocalPath, remotePath)
	case PULL:
		cmd = exec.Command("rclone", "sync", remotePath, selectedProject.LocalPath)
	case COPY_TO:
		cmd = exec.Command("rclone", "copy", selectedProject.LocalPath, remotePath)
	case COPY_FROM:
		cmd = exec.Command("rclone", "copy", remotePath, selectedProject.LocalPath)
	default:
		return nil, fmt.Errorf("unsupported action: %s", action)
	}

	return &RcloneCommand{command: cmd}, nil
}

func (c *RcloneCommand) Exec() error {
	output, err := c.command.CombinedOutput()
	if err != nil {
		return fmt.Errorf("command execution failed: %w. Output: %s", err, string(output))
	}
	fmt.Println("Command output:", string(output))
	return nil
}
