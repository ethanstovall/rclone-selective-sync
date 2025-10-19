//go:build windows

package backend

import (
	"fmt"
	"os/exec"
	"strings"
	"syscall"
)

// createCommand creates an exec.Cmd configured to hide the console window on Windows.
// Use this instead of exec.Command() to prevent console window flashing in production builds.
func createCommand(name string, args ...string) *exec.Cmd {
	// Debug logging to see what commands are being executed
	fmt.Printf("[DEBUG] Executing: %s %s\n", name, strings.Join(args, " "))

	cmd := exec.Command(name, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}
	return cmd
}
