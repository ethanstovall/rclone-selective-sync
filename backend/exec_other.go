//go:build !windows

package backend

import (
	"fmt"
	"os/exec"
	"strings"
)

// createCommand creates an exec.Cmd (no special handling needed on non-Windows platforms)
func createCommand(name string, args ...string) *exec.Cmd {
	// Debug logging to see what commands are being executed
	fmt.Printf("[DEBUG] Executing: %s %s\n", name, strings.Join(args, " "))
	return exec.Command(name, args...)
}

// createVisibleCommand creates an exec.Cmd (identical to createCommand on non-Windows platforms)
func createVisibleCommand(name string, args ...string) *exec.Cmd {
	// Debug logging to see what commands are being executed
	fmt.Printf("[DEBUG] Executing (visible): %s %s\n", name, strings.Join(args, " "))
	return exec.Command(name, args...)
}
