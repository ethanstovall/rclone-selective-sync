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

	// Get the folder paths for the project. TODO consider refactoring this so that common functionality
	//	 is pulled out and called from separate OpenFolder, OpenProject, and OpenBackup methods.
	var fullLocalPath = ""
	if targetFolder == "" {
		// No target folder was given. Just open the root project folder.
		fullLocalPath = filepath.Join(projectRemoteConfig.LocalPath)
	} else if targetFolder == "BACKUP" {
		// The special "BACKUP" string was passed. Open the backup location.
		fullLocalPath = filepath.Join(projectRemoteConfig.FullBackupPath)
	} else {
		// A target folder was given. Open it.
		projectFolderConfigs := fs.configManager.GetProjectConfig().Folders
		folderConfig, exists := projectFolderConfigs[targetFolder]
		if !exists {
			return fmt.Errorf("no folder with the name %s is configured for selected project %s", targetFolder, fs.configManager.GetSelectedProject())
		}
		// Construct the full local path
		fullLocalPath = filepath.Join(projectRemoteConfig.LocalPath, folderConfig.LocalPath)
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

// Given a new folder name and a new FolderConfig, create a new FolderConfig for it in the ProjectConfig.
// Return the entire ProjectConfig after, which will contain the fully updated map of Folders.
func (fs *FolderService) RegisterNewFolder(newFolderName string, folderConfig FolderConfig) (ProjectConfig, error) {
	// Get the remote config for the selected project
	projectRemoteConfig, err := fs.getProjectRemoteConfig()
	if err != nil {
		return ProjectConfig{}, err
	}

	// Get the project config
	projectConfig, err := fs.getProjectConfig()
	if err != nil {
		return ProjectConfig{}, err
	}

	// Normalize the local path
	folderConfig.LocalPath = normalizePath(folderConfig.LocalPath)
	// Set remotePath to be identical to LocalPath
	folderConfig.RemotePath = folderConfig.LocalPath
	// Verify no other folder with the same key exists
	if _, exists := projectConfig.Folders[newFolderName]; exists {
		return *projectConfig, fmt.Errorf("a folder with the name '%s' is already configured for the selected project", newFolderName)
	}

	// Verify no other folder has the same LocalPath
	fullLocalPath := filepath.Join(projectRemoteConfig.LocalPath, folderConfig.LocalPath)
	for _, existingFolder := range projectConfig.Folders {
		existingFullPath := filepath.Join(projectRemoteConfig.LocalPath, normalizePath(existingFolder.LocalPath))
		if fullLocalPath == existingFullPath {
			return *projectConfig, fmt.Errorf("a folder with the local path '%s' is already configured for the selected project", folderConfig.LocalPath)
		}
	}

	// Verify the local folder exists
	if _, err := os.Stat(fullLocalPath); os.IsNotExist(err) {
		return *projectConfig, fmt.Errorf("folder path does not exist: %s", fullLocalPath)
	}

	// Add the new key-value pair to the projectConfig
	projectConfig.Folders[newFolderName] = folderConfig

	// Set the new project configuration
	if err := fs.saveAndSyncConfig(projectConfig); err != nil {
		return *projectConfig, err
	}

	return *projectConfig, nil
}

// Given an existing folder, a new folder name, and a new FolderConfig, update the existing folder to match the new items.
// Return the entire ProjectConfig after, which will contain the fully updated map of Folders.
func (fs *FolderService) EditFolder(currentFolderName string, newFolderName string, newFolderConfig FolderConfig) (ProjectConfig, error) {
	// Get the project config.
	projectConfig, err := fs.getProjectConfig()
	if err != nil {
		return ProjectConfig{}, err
	}

	// Verify that the given folder to update exists in the configuration.
	if _, exists := projectConfig.Folders[currentFolderName]; !exists {
		return *projectConfig, fmt.Errorf("folder '%s' does not exist in the project configuration", currentFolderName)
	}

	if currentFolderName == newFolderName {
		// If the user has not changed the name of the folder in configuration, just replace the existing FolderConfig object.
		projectConfig.Folders[currentFolderName] = newFolderConfig
	} else {
		// Else, remove the existing key-value pair and replace it with the new one.
		delete(projectConfig.Folders, currentFolderName)
		projectConfig.Folders[newFolderName] = newFolderConfig
	}

	// Save the config and push it to the remote.
	if err := fs.saveAndSyncConfig(projectConfig); err != nil {
		return *projectConfig, err
	}

	return *projectConfig, nil
}

// Given a target folder, scrub it out of the project configuration's folders. This does NOT delete the folder
// locally nor remotely. It only untracks it. Full deletions should be carefully handled manually with Rclone
// for now.
func (fs *FolderService) DeregisterFolder(targetFolder string) (ProjectConfig, error) {
	// Get the project config.
	projectConfig, err := fs.getProjectConfig()
	if err != nil {
		return ProjectConfig{}, err
	}

	// Verify the targeted folder exists in the project config.
	if _, exists := projectConfig.Folders[targetFolder]; !exists {
		return *projectConfig, fmt.Errorf("folder '%s' does not exist in the project configuration", targetFolder)
	}

	// Remove the targeted folder's key-value pair from the project configuration's folder map.
	delete(projectConfig.Folders, targetFolder)

	// Save, set, and push the project configuration.
	if err := fs.saveAndSyncConfig(projectConfig); err != nil {
		return *projectConfig, err
	}

	return *projectConfig, nil
}

// Wrapper method to get the project config from the config manager
func (fs *FolderService) getProjectConfig() (*ProjectConfig, error) {
	projectConfig := fs.configManager.GetProjectConfig()
	if projectConfig == nil {
		return nil, fmt.Errorf("no project config is defined for project '%s'", fs.configManager.GetSelectedProject())
	}

	return projectConfig, nil
}

// Wrapper method to get the project's remote config from the config manager
func (fs *FolderService) getProjectRemoteConfig() (*RemoteConfig, error) {
	projectRemoteConfig := fs.configManager.GetSelectedProjectRemoteConfig()
	if projectRemoteConfig == nil {
		return nil, fmt.Errorf("selected project's remote configuration is not available")
	}
	return projectRemoteConfig, nil
}

// Common method to save the project sync.json file to disk, then push it up to the remote
func (fs *FolderService) saveAndSyncConfig(projectConfig *ProjectConfig) error {
	projectRemoteConfig, err := fs.getProjectRemoteConfig()
	if err != nil {
		return err
	}

	projectPath := projectRemoteConfig.LocalPath
	configFile := filepath.Join(projectPath, "sync.json")

	if err := saveConfig(configFile, projectConfig); err != nil {
		return fmt.Errorf("failed to save updated project configuration: %w", err)
	}

	fs.configManager.SetProjectConfig(projectConfig)

	if err := fs.configManager.syncConfigToRemote(); err != nil {
		return fmt.Errorf("failed to sync the project configuration to the remote: %v", err)
	}

	return nil
}

// Util method to clean a given path string
func normalizePath(path string) string {
	// Replace backslashes with slashes and trim leading/trailing slashes
	normalized := strings.ReplaceAll(path, "\\", "/")
	return strings.Trim(normalized, "/")
}
