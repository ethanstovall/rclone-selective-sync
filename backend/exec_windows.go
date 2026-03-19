//go:build windows

package backend

import (
	"fmt"
	"os/exec"
	"strings"
)

// createVisibleCommand creates an exec.Cmd that allows the process window to be visible.
// Use this for UI applications like explorer, notepad, etc. that need to show their windows.
func createVisibleCommand(name string, args ...string) *exec.Cmd {
	// Debug logging to see what commands are being executed
	fmt.Printf("[DEBUG] Executing (visible): %s %s\n", name, strings.Join(args, " "))

	return exec.Command(name, args...)
}
