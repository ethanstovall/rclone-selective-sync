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

// createVisibleCommand creates an exec.Cmd that allows the process window to be visible.
// Use this for UI applications like explorer, notepad, etc. that need to show their windows.
func createVisibleCommand(name string, args ...string) *exec.Cmd {
	// Debug logging to see what commands are being executed
	fmt.Printf("[DEBUG] Executing (visible): %s %s\n", name, strings.Join(args, " "))

	return exec.Command(name, args...)
}
