package backend

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/rclone/rclone/backend/all" // register all storage backends
	_ "github.com/rclone/rclone/cmd/all"     // register all RC operations (sync, copy, etc.)
	"github.com/rclone/rclone/librclone/librclone"
)

// fileInfo represents a file returned by operations/list
type fileInfo struct {
	Path    string `json:"Path"`
	Name    string `json:"Name"`
	Size    int64  `json:"Size"`
	ModTime string `json:"ModTime"`
	IsDir   bool   `json:"IsDir"`
}

// InitRclone initializes the embedded rclone library. Call once at app startup.
func InitRclone() {
	librclone.Initialize()
}

// FinalizeRclone shuts down the embedded rclone library. Call on app shutdown.
func FinalizeRclone() {
	librclone.Finalize()
}

// rcloneRPC is a low-level helper that calls an rclone RC method with JSON params.
// Returns the output string and an error if the status is not 200.
func rcloneRPC(method string, params map[string]interface{}) (string, error) {
	input, err := json.Marshal(params)
	if err != nil {
		return "", fmt.Errorf("failed to marshal RPC params: %v", err)
	}
	output, status := librclone.RPC(method, string(input))
	if status != 200 {
		return "", fmt.Errorf("rclone %s failed (status %d): %s", method, status, output)
	}
	return output, nil
}

// rcloneListFiles lists all files (recursively) at the given fs path.
func rcloneListFiles(fsPath string) ([]fileInfo, error) {
	params := map[string]interface{}{
		"fs":     fsPath,
		"remote": "",
		"opt": map[string]interface{}{
			"recurse": true,
		},
	}
	output, err := rcloneRPC("operations/list", params)
	if err != nil {
		return nil, err
	}
	var result struct {
		List []fileInfo `json:"list"`
	}
	if err := json.Unmarshal([]byte(output), &result); err != nil {
		return nil, fmt.Errorf("failed to parse list output: %v", err)
	}
	return result.List, nil
}

// DiffEntry represents a single file change in a diff.
type DiffEntry struct {
	Type    string `json:"type"`    // "add", "update", "delete"
	Path    string `json:"path"`    // file path
	Size    string `json:"size"`    // human-readable size
	OldSize string `json:"oldSize"` // previous size (for updates with size change)
	Detail  string `json:"detail"`  // additional detail (e.g. "modified")
}

// DiffResult is the structured diff output returned as JSON in CommandOutput.
type DiffResult struct {
	IsDiff     bool        `json:"isDiff"`     // marker so frontend can detect this is a diff
	Additions  []DiffEntry `json:"additions"`
	Updates    []DiffEntry `json:"updates"`
	Deletions  []DiffEntry `json:"deletions"`
	TotalSize  string      `json:"totalSize"`  // total size of source
	ChangeSize string      `json:"changeSize"` // total size of additions + updates
}

// RcloneDiffFiles compares files between srcFs and dstFs and returns a structured diff.
// Also returns a boolean indicating whether any changes were detected.
func RcloneDiffFiles(srcFs, dstFs string) (string, bool, error) {
	startTime := time.Now()
	_ = startTime // reserved for future timing stats

	srcFiles, err := rcloneListFiles(srcFs)
	if err != nil {
		return "", false, fmt.Errorf("failed to list source: %v", err)
	}
	dstFiles, err := rcloneListFiles(dstFs)
	if err != nil {
		return "", false, fmt.Errorf("failed to list destination: %v", err)
	}

	// Build maps by path (excluding directories)
	srcMap := make(map[string]fileInfo)
	var totalSrcSize int64
	for _, f := range srcFiles {
		if !f.IsDir {
			srcMap[f.Path] = f
			totalSrcSize += f.Size
		}
	}
	dstMap := make(map[string]fileInfo)
	for _, f := range dstFiles {
		if !f.IsDir {
			dstMap[f.Path] = f
		}
	}

	var additions, updates, deletions []DiffEntry
	var changeSize int64

	// Files in src but not in dst → would be copied
	for path, sf := range srcMap {
		if _, exists := dstMap[path]; !exists {
			additions = append(additions, DiffEntry{
				Type: "add",
				Path: path,
				Size: formatSize(sf.Size),
			})
			changeSize += sf.Size
		}
	}

	// Files in both but different size/modtime → would be updated
	for path, sf := range srcMap {
		if df, exists := dstMap[path]; exists {
			if sf.Size != df.Size {
				updates = append(updates, DiffEntry{
					Type:    "update",
					Path:    path,
					Size:    formatSize(sf.Size),
					OldSize: formatSize(df.Size),
				})
				changeSize += sf.Size
			} else {
				srcTime, _ := time.Parse(time.RFC3339Nano, sf.ModTime)
				dstTime, _ := time.Parse(time.RFC3339Nano, df.ModTime)
				// Use a 1-second tolerance window — local and remote filesystems
				// store timestamps with different precision (e.g. B2 uses milliseconds)
				diff := srcTime.Sub(dstTime)
				if diff < -time.Second || diff > time.Second {
					updates = append(updates, DiffEntry{
						Type: "update",
						Path: path,
						Size: formatSize(sf.Size),
					})
					changeSize += sf.Size
				}
			}
		}
	}

	// Files in dst but not in src → would be deleted
	for path, df := range dstMap {
		if _, exists := srcMap[path]; !exists {
			deletions = append(deletions, DiffEntry{
				Type: "delete",
				Path: path,
				Size: formatSize(df.Size),
			})
		}
	}

	hasChanges := len(additions) > 0 || len(updates) > 0 || len(deletions) > 0

	result := DiffResult{
		IsDiff:     true,
		Additions:  additions,
		Updates:    updates,
		Deletions:  deletions,
		TotalSize:  formatSize(totalSrcSize),
		ChangeSize: formatSize(changeSize),
	}

	jsonBytes, err := json.Marshal(result)
	if err != nil {
		return "", false, fmt.Errorf("failed to marshal diff result: %v", err)
	}

	return string(jsonBytes), hasChanges, nil
}

// formatSize returns a human-readable file size.
func formatSize(bytes int64) string {
	const (
		KB = 1024
		MB = KB * 1024
		GB = MB * 1024
	)
	switch {
	case bytes >= GB:
		return fmt.Sprintf("%.1f GB", float64(bytes)/float64(GB))
	case bytes >= MB:
		return fmt.Sprintf("%.1f MB", float64(bytes)/float64(MB))
	case bytes >= KB:
		return fmt.Sprintf("%.1f KB", float64(bytes)/float64(KB))
	default:
		return fmt.Sprintf("%d B", bytes)
	}
}

// RcloneSync runs rclone sync from srcFs to dstFs.
func RcloneSync(srcFs, dstFs string, dryRun bool) (string, error) {
	if dryRun {
		// For dry-run, compare file listings instead of running sync
		diff, _, err := RcloneDiffFiles(srcFs, dstFs)
		return diff, err
	}
	params := map[string]interface{}{
		"srcFs":  srcFs,
		"dstFs":  dstFs,
		"_async": false,
	}
	_, err := rcloneRPC("sync/sync", params)
	if err != nil {
		return "", err
	}
	return "Sync completed successfully.", nil
}

// RcloneCopy runs rclone copy from srcFs to dstFs.
func RcloneCopy(srcFs, dstFs string, dryRun bool) (string, error) {
	if dryRun {
		// For dry-run, show what would be copied (only new/updated, no deletions)
		diffJSON, _, err := RcloneDiffFiles(srcFs, dstFs)
		if err != nil {
			return "", err
		}
		// Parse, strip deletions (copy doesn't delete), re-marshal
		var result DiffResult
		if jsonErr := json.Unmarshal([]byte(diffJSON), &result); jsonErr == nil {
			result.Deletions = nil
			if len(result.Additions) == 0 && len(result.Updates) == 0 {
				result.IsDiff = true
			}
			stripped, _ := json.Marshal(result)
			return string(stripped), nil
		}
		return diffJSON, nil
	}
	params := map[string]interface{}{
		"srcFs":  srcFs,
		"dstFs":  dstFs,
		"_async": false,
	}
	_, err := rcloneRPC("sync/copy", params)
	if err != nil {
		return "", err
	}
	return "Copy completed successfully.", nil
}

// RcloneHasChanges compares srcFs and dstFs and returns whether any files differ.
func RcloneHasChanges(srcFs, dstFs string) (bool, error) {
	_, hasChanges, err := RcloneDiffFiles(srcFs, dstFs)
	return hasChanges, err
}

// RcloneCopyFile copies a single file from srcFs:srcRemote to dstFs:dstRemote.
func RcloneCopyFile(srcFs, srcRemote, dstFs, dstRemote string) error {
	params := map[string]interface{}{
		"srcFs":     srcFs,
		"srcRemote": srcRemote,
		"dstFs":     dstFs,
		"dstRemote": dstRemote,
	}
	_, err := rcloneRPC("operations/copyfile", params)
	return err
}

// RcloneListJSON lists files at the given fs path, returning the raw JSON output.
func RcloneListJSON(fsPath string, remote string) (string, error) {
	params := map[string]interface{}{
		"fs":     fsPath,
		"remote": remote,
	}
	return rcloneRPC("operations/list", params)
}

// RcloneGetConfigPath returns the rclone config file path.
func RcloneGetConfigPath() (string, error) {
	output, err := rcloneRPC("config/paths", map[string]interface{}{})
	if err != nil {
		return "", err
	}
	var result struct {
		Config string `json:"config"`
	}
	if err := json.Unmarshal([]byte(output), &result); err != nil {
		return "", fmt.Errorf("failed to parse config/paths output: %v", err)
	}
	return filepath.Clean(result.Config), nil
}

// RcloneGetRemoteFileModTime gets the modification time of a remote file.
func RcloneGetRemoteFileModTime(remotePath string) (time.Time, error) {
	// Parse "remote:bucket/path/to/file.json" into fs="remote:bucket/path/to" and remote="file.json"
	lastSlash := strings.LastIndex(remotePath, "/")
	if lastSlash == -1 {
		return time.Time{}, fmt.Errorf("invalid remote path format: %s", remotePath)
	}
	fsPath := remotePath[:lastSlash]
	fileName := remotePath[lastSlash+1:]

	output, err := RcloneListJSON(fsPath, fileName)
	if err != nil {
		return time.Time{}, fmt.Errorf("rclone list failed: %v", err)
	}

	var result struct {
		List []struct {
			ModTime string `json:"ModTime"`
		} `json:"list"`
	}
	if err := json.Unmarshal([]byte(output), &result); err != nil {
		return time.Time{}, fmt.Errorf("failed to parse list output: %v", err)
	}

	if len(result.List) == 0 {
		return time.Time{}, fmt.Errorf("file not found on remote")
	}

	modTime, err := time.Parse(time.RFC3339Nano, result.List[0].ModTime)
	if err != nil {
		return time.Time{}, fmt.Errorf("failed to parse remote mod time: %v", err)
	}

	return modTime, nil
}
