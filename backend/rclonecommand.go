package backend

import (
	"fmt"
	"os/exec"
)

type RcloneCommand struct {
	command *exec.Cmd
}

func NewRcloneCommand(remoteConfig RemoteConfig, remoteFolderPath string, localFolderPath string, action RcloneAction) (*RcloneCommand, error) {
	var cmd *exec.Cmd

	fullRemotePath := fmt.Sprintf("%s:%s/%s", remoteConfig.RemoteName, remoteConfig.BucketName, remoteFolderPath)
	fullLocalPath := fmt.Sprintf("%s/%s", remoteConfig.LocalPath, localFolderPath)

	switch action {
	case PUSH:
		cmd = exec.Command("rclone", "sync", fullLocalPath, fullRemotePath, "--dry-run")
	case PULL:
		cmd = exec.Command("rclone", "sync", fullRemotePath, fullLocalPath, "--dry-run")
	// case COPY_TO:
	// 	cmd = exec.Command("rclone", "copy", fullLocalPath, fullRemotePath)
	// case COPY_FROM:
	// 	cmd = exec.Command("rclone", "copy", fullRemotePath, fullLocalPath)
	default:
		return nil, fmt.Errorf("unsupported action: %s", action)
	}

	return &RcloneCommand{command: cmd}, nil
}

func (c *RcloneCommand) Exec() (string, error) {
	output, err := c.command.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("command execution failed: %w. Output: %s", err, string(output))
	}
	stringOutput := string(output)
	fmt.Println("Command output:", stringOutput)
	return stringOutput, nil
}
