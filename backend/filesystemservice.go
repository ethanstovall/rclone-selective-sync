package backend

import (
	"errors"
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

// GetLocalFolders checks if the local paths for all folders in the ProjectConfig exist.
// Returns a list of folder keys where the paths exist, or an error if something goes wrong.
func (fss *FileSystemService) GetLocalFolders() ([]string, error) {
	selectedProject := fss.configManager.GetSelectedProject()
	if selectedProject == "" {
		return nil, errors.New("no project selected; cannot verify folder paths")
	}

	projectConfig := fss.configManager.GetProjectConfig()
	if projectConfig == nil {
		return nil, errors.New("project configuration is not loaded")
	}

	basePath := fss.configManager.globalConfig.Remotes[selectedProject].LocalPath
	existingFolders := []string{}

	for folderKey, folderConfig := range projectConfig.Folders {
		fullPath := filepath.Join(basePath, folderConfig.LocalPath)
		if _, err := os.Stat(fullPath); err == nil {
			existingFolders = append(existingFolders, folderKey)
		} else if os.IsNotExist(err) {
			fmt.Printf("folder path does not exist locally: %s\n", fullPath)
		} else {
			return nil, fmt.Errorf("error checking path %s: %v", fullPath, err)
		}
	}

	return existingFolders, nil
}

func (fss *FileSystemService) processLocalFolders(targetFolders []string, action string) error {
	// Ensure a project is selected
	selectedProject := fss.configManager.GetSelectedProject()
	if selectedProject == "" {
		return errors.New("no project selected; cannot verify folder paths")
	}

	// Ensure the project configuration is loaded
	projectConfig := fss.configManager.GetProjectConfig()
	if projectConfig == nil {
		return errors.New("project configuration is not loaded")
	}

	// Iterate through the list of target folders
	for _, targetFolder := range targetFolders {
		// Get the folder configuration
		folderConfig, exists := projectConfig.Folders[targetFolder]
		if !exists {
			return fmt.Errorf("target folder '%s' not found in project configuration", targetFolder)
		}

		// Build the full path
		basePath := fss.configManager.globalConfig.Remotes[selectedProject].LocalPath
		fullPath := filepath.Join(basePath, folderConfig.LocalPath)

		// Perform the action based on the method (create or delete)
		switch action {
		case "CREATE":
			// Check if the directory already exists
			if _, dirErr := os.Stat(fullPath); !os.IsNotExist(dirErr) {
				return fmt.Errorf("local path '%s' already exists", fullPath)
			}
			// Attempt to create the directory
			if mkdirErr := os.MkdirAll(fullPath, 0755); mkdirErr != nil {
				return fmt.Errorf("folder creation failed for '%s': %v", fullPath, mkdirErr)
			}
		case "DELETE":
			// Attempt to remove the directory and its contents
			if removeErr := os.RemoveAll(fullPath); removeErr != nil {
				return fmt.Errorf("failed to delete folder '%s': %v", fullPath, removeErr)
			}

		default:
			return fmt.Errorf("invalid action '%s' specified", action)
		}
	}

	return nil
}

// Wrapper function for creating folders
func (ss *FileSystemService) CreateLocalFolders(targetFolders []string) error {
	return ss.processLocalFolders(targetFolders, "CREATE")
}

// Wrapper function for deleting folders
func (fss *FileSystemService) DeleteLocalFolders(targetFolders []string) error {
	return fss.processLocalFolders(targetFolders, "DELETE")
}
