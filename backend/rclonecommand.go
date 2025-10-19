package backend

import (
	"fmt"
	"os/exec"
)

type RcloneCommand struct {
	command *exec.Cmd
}

func NewRcloneCommand(fullRemotePath string, fullLocalPath string, action RcloneAction, dry bool) (*RcloneCommand, error) {
	var cmd *exec.Cmd

	// Build the arguments list depending on the given input
	args := []string{}

	switch action {
	case SYNC_PUSH:
		args = append(args, "sync", fullLocalPath, fullRemotePath)
	case SYNC_PULL:
		args = append(args, "sync", fullRemotePath, fullLocalPath)
	case COPY_PULL:
		args = append(args, "copy", fullRemotePath, fullLocalPath)
	default:
		return nil, fmt.Errorf("unsupported action: %s", action)
	}

	// Add the "--dry-run" flag if specified
	if dry {
		args = append(args, "--dry-run")
	}

	// Construct the command with the appropriate arguments
	cmd = createCommand("rclone", args...)

	return &RcloneCommand{command: cmd}, nil
}

func (c *RcloneCommand) Exec() (string, error) {
	output, err := c.command.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("command execution failed: %w. Output: %s", err, string(output))
	}
	stringOutput := string(output)
	return stringOutput, nil
}
