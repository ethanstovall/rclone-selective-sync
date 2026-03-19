//go:build !windows

package backend

import (
	"fmt"
	"os/exec"
	"strings"
)

// createVisibleCommand creates an exec.Cmd (identical to exec.Command on non-Windows platforms)
func createVisibleCommand(name string, args ...string) *exec.Cmd {
	// Debug logging to see what commands are being executed
	fmt.Printf("[DEBUG] Executing (visible): %s %s\n", name, strings.Join(args, " "))
	return exec.Command(name, args...)
}
