package backend

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

type FolderService struct {
	configManager *ConfigManager
}

func NewFolderService(configManager *ConfigManager) *FolderService {
	return &FolderService{configManager: configManager}
}

// Open the requested folder in the user's file explorer
func (fs *FolderService) OpenFolder(targetFolder string) error {
	// Get the remote config for the selected project
	projectRemoteConfig := fs.configManager.GetSelectedProjectRemoteConfig()
	if projectRemoteConfig == nil {
		return fmt.Errorf("selected project's remote configuration is not available")
	}

	// Get the folder paths for the project
	var fullLocalPath = ""
	if targetFolder != "" {
		projectFolderConfigs := fs.configManager.GetProjectConfig().Folders
		folderConfig, exists := projectFolderConfigs[targetFolder]
		if !exists {
			return fmt.Errorf("no folder with the name %s is configured for selected project %s", targetFolder, fs.configManager.GetSelectedProject())
		}
		// Construct the full local path
		fullLocalPath = filepath.Join(projectRemoteConfig.LocalPath, folderConfig.LocalPath)
	} else {
		fullLocalPath = filepath.Join(projectRemoteConfig.LocalPath)
	}

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
func (fs *FolderService) GetLocalFolders() ([]string, error) {
	selectedProject := fs.configManager.GetSelectedProject()
	if selectedProject == "" {
		return nil, errors.New("no project selected; cannot verify folder paths")
	}

	projectConfig := fs.configManager.GetProjectConfig()
	if projectConfig == nil {
		return nil, errors.New("project configuration is not loaded")
	}

	basePath := fs.configManager.globalConfig.Remotes[selectedProject].LocalPath
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

func (fs *FolderService) processLocalFolders(targetFolders []string, action string) error {
	// Ensure a project is selected
	selectedProject := fs.configManager.GetSelectedProject()
	if selectedProject == "" {
		return errors.New("no project selected; cannot verify folder paths")
	}

	// Ensure the project configuration is loaded
	projectConfig := fs.configManager.GetProjectConfig()
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
		basePath := fs.configManager.globalConfig.Remotes[selectedProject].LocalPath
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
func (fs *FolderService) CreateLocalFolders(targetFolders []string) error {
	return fs.processLocalFolders(targetFolders, "CREATE")
}

// Wrapper function for deleting folders
func (fs *FolderService) DeleteLocalFolders(targetFolders []string) error {
	return fs.processLocalFolders(targetFolders, "DELETE")
}

func (fs *FolderService) RegisterNewFolder(newFolderName string, folderConfig FolderConfig) error {
	// Get the remote config for the selected project
	projectRemoteConfig := fs.configManager.GetSelectedProjectRemoteConfig()
	if projectRemoteConfig == nil {
		return fmt.Errorf("selected project's remote configuration is not available")
	}

	// Get the project config
	projectConfig := fs.configManager.GetProjectConfig()
	if projectConfig == nil {
		return fmt.Errorf("project configuration is not available")
	}

	// Step 1: Normalize the local path
	folderConfig.LocalPath = normalizePath(folderConfig.LocalPath)

	// Step 2: Set remotePath to be identical to LocalPath
	folderConfig.RemotePath = folderConfig.LocalPath

	// Step 3: Verify no other folder with the same key exists
	if _, exists := projectConfig.Folders[newFolderName]; exists {
		return fmt.Errorf("a folder with the name '%s' is already configured for the selected project", newFolderName)
	}

	// Step 4: Verify no other folder has the same LocalPath
	fullLocalPath := filepath.Join(projectRemoteConfig.LocalPath, folderConfig.LocalPath)
	for _, existingFolder := range projectConfig.Folders {
		existingFullPath := filepath.Join(projectRemoteConfig.LocalPath, normalizePath(existingFolder.LocalPath))
		if fullLocalPath == existingFullPath {
			return fmt.Errorf("a folder with the local path '%s' is already configured for the selected project", folderConfig.LocalPath)
		}
	}

	if _, err := os.Stat(fullLocalPath); os.IsNotExist(err) {
		return fmt.Errorf("folder path does not exist: %s", fullLocalPath)
	}

	// Step 5: Add the new key-value pair to the projectConfig
	projectConfig.Folders[newFolderName] = folderConfig

	// Step 6: Set the new project configuration
	fs.configManager.SetProjectConfig(projectConfig)

	// Step 7: Save the new project configuration to the sync.json file
	projectPath := projectRemoteConfig.LocalPath
	configFile := filepath.Join(projectPath, "sync.json")

	if err := saveConfig(configFile, projectConfig); err != nil {
		return fmt.Errorf("failed to save project configuration: %v", err)
	}

	// Step 8: Sync the updated sync.json file to the remote
	if err := fs.configManager.syncConfigToRemote(); err != nil {
		return fmt.Errorf("failed to sync the project configuration to the remote: %v", err)
	}

	return nil
}

func normalizePath(path string) string {
	// Replace backslashes with slashes and trim leading/trailing slashes
	normalized := strings.ReplaceAll(path, "\\", "/")
	return strings.Trim(normalized, "/")
}
