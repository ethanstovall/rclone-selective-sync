package backend

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

type FileSystemService struct {
	configManager *ConfigManager
}

func NewFileSystemService(configManager *ConfigManager) *FileSystemService {
	return &FileSystemService{configManager: configManager}
}

// Open the requested folder in the user's file explorer
func (fss *FileSystemService) OpenFolder(targetFolder string) error {
	// Get the remote config for the selected project
	projectRemoteConfig := fss.configManager.GetSelectedProjectRemoteConfig()
	if projectRemoteConfig == nil {
		return fmt.Errorf("selected project's remote configuration is not available")
	}

	// Get the folder paths for the project
	projectFolderConfigs := fss.configManager.GetProjectConfig().Folders
	folderConfig, exists := projectFolderConfigs[targetFolder]
	if !exists {
		return fmt.Errorf("no folder with the name %s is configured for selected project %s", targetFolder, fss.configManager.GetSelectedProject())
	}

	// Construct the full local path
	fullLocalPath := filepath.Join(projectRemoteConfig.LocalPath, folderConfig.LocalPath)

	if _, err := os.Stat(fullLocalPath); os.IsNotExist(err) {
		return fmt.Errorf("folder path does not exist: %s", fullLocalPath)
	}

	// Open the folder based on the OS
	switch runtime.GOOS {
	case "windows":
		return exec.Command("explorer", fullLocalPath).Start()
	case "darwin":
		return exec.Command("open", fullLocalPath).Start()
	case "linux":
		return exec.Command("xdg-open", fullLocalPath).Start()
	default:
		return fmt.Errorf("unsupported platform")
	}
}
