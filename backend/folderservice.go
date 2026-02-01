package backend

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
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
		return createVisibleCommand("explorer", fullLocalPath).Start()
	case "darwin":
		return createVisibleCommand("open", fullLocalPath).Start()
	case "linux":
		return createVisibleCommand("xdg-open", fullLocalPath).Start()
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
	// Remove projectRemoteConfig.LocalPath prefix from folderConfig.LocalPath
	folderConfig.LocalPath = strings.TrimPrefix(folderConfig.LocalPath, projectRemoteConfig.LocalPath)
	// Remove any leading slashes (Unix or Windows style)
	folderConfig.LocalPath = strings.TrimLeft(folderConfig.LocalPath, `/\`)
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

	// Validate that a group is specified
	if folderConfig.Group == "" {
		return *projectConfig, fmt.Errorf("a group must be specified for the folder")
	}

	// Validate that the specified group exists
	if projectConfig.Groups == nil {
		return *projectConfig, fmt.Errorf("no groups exist; create a group first before registering folders")
	}
	if _, groupExists := projectConfig.Groups[folderConfig.Group]; !groupExists {
		return *projectConfig, fmt.Errorf("group '%s' does not exist", folderConfig.Group)
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

	// Validate that a group is specified
	if newFolderConfig.Group == "" {
		return *projectConfig, fmt.Errorf("a group must be specified for the folder")
	}

	// Validate that the specified group exists
	if projectConfig.Groups == nil {
		return *projectConfig, fmt.Errorf("no groups exist; create a group first")
	}
	if _, groupExists := projectConfig.Groups[newFolderConfig.Group]; !groupExists {
		return *projectConfig, fmt.Errorf("group '%s' does not exist", newFolderConfig.Group)
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

// OpenFolderPicker opens a native OS folder selection dialog and returns the selected path.
// The returned path is relative to the project root. Returns an empty string if cancelled.
func (fs *FolderService) OpenFolderPicker() (string, error) {
	// Get the project remote config to determine the project root
	projectRemoteConfig := fs.configManager.GetSelectedProjectRemoteConfig()
	if projectRemoteConfig == nil {
		return "", fmt.Errorf("no project selected")
	}

	projectRoot := projectRemoteConfig.LocalPath

	// Get the app instance to access dialogs
	app := application.Get()
	if app == nil {
		return "", fmt.Errorf("application instance not available")
	}

	// Open native directory picker dialog using Dialog.OpenFile with CanChooseDirectories
	selectedPath, err := app.Dialog.OpenFile().
		SetTitle("Select Folder to Register").
		SetDirectory(projectRoot).
		CanChooseDirectories(true).
		CanChooseFiles(false).
		CanCreateDirectories(true).
		PromptForSingleSelection()

	if err != nil {
		return "", fmt.Errorf("failed to open folder picker: %w", err)
	}

	// User cancelled - return empty string (not an error)
	if selectedPath == "" {
		return "", nil
	}

	// Normalize the selected path for comparison
	normalizedSelected := normalizePath(selectedPath)
	normalizedRoot := normalizePath(projectRoot)

	// Validate: selected folder must be within project root
	if !strings.HasPrefix(normalizedSelected, normalizedRoot) {
		return "", fmt.Errorf("selected folder must be within the project root: %s", projectRoot)
	}

	// Convert to relative path
	relativePath := strings.TrimPrefix(normalizedSelected, normalizedRoot)
	relativePath = strings.TrimPrefix(relativePath, "/")

	return relativePath, nil
}

// ==================== Group Management Methods ====================

// CreateGroup creates a new group in the project configuration.
// Returns the updated ProjectConfig or an error if the group already exists.
func (fs *FolderService) CreateGroup(groupKey string, groupConfig GroupConfig) (ProjectConfig, error) {
	projectConfig, err := fs.getProjectConfig()
	if err != nil {
		return ProjectConfig{}, err
	}

	// Ensure groups map is initialized
	if projectConfig.Groups == nil {
		projectConfig.Groups = make(map[string]GroupConfig)
	}

	// Check if group already exists
	if _, exists := projectConfig.Groups[groupKey]; exists {
		return *projectConfig, fmt.Errorf("a group with the key '%s' already exists", groupKey)
	}

	// Validate parent group if specified
	if groupConfig.ParentGroup != "" {
		if _, parentExists := projectConfig.Groups[groupConfig.ParentGroup]; !parentExists {
			return *projectConfig, fmt.Errorf("parent group '%s' does not exist", groupConfig.ParentGroup)
		}
		// Check for circular reference (parent can't be self)
		if groupConfig.ParentGroup == groupKey {
			return *projectConfig, fmt.Errorf("group cannot be its own parent")
		}
	}

	// Add the new group
	projectConfig.Groups[groupKey] = groupConfig

	// Save and sync
	if err := fs.saveAndSyncConfig(projectConfig); err != nil {
		return *projectConfig, err
	}

	return *projectConfig, nil
}

// UpdateGroup updates an existing group's properties.
// Returns the updated ProjectConfig or an error if the group doesn't exist.
func (fs *FolderService) UpdateGroup(groupKey string, groupConfig GroupConfig) (ProjectConfig, error) {
	projectConfig, err := fs.getProjectConfig()
	if err != nil {
		return ProjectConfig{}, err
	}

	// Check if group exists
	if _, exists := projectConfig.Groups[groupKey]; !exists {
		return *projectConfig, fmt.Errorf("group '%s' does not exist", groupKey)
	}

	// Validate parent group if specified
	if groupConfig.ParentGroup != "" {
		if _, parentExists := projectConfig.Groups[groupConfig.ParentGroup]; !parentExists {
			return *projectConfig, fmt.Errorf("parent group '%s' does not exist", groupConfig.ParentGroup)
		}
		// Check for circular reference
		if groupConfig.ParentGroup == groupKey {
			return *projectConfig, fmt.Errorf("group cannot be its own parent")
		}
		// Check for deeper circular references
		if fs.wouldCreateCircularReference(projectConfig, groupKey, groupConfig.ParentGroup) {
			return *projectConfig, fmt.Errorf("this would create a circular group reference")
		}
	}

	// Update the group
	projectConfig.Groups[groupKey] = groupConfig

	// Save and sync
	if err := fs.saveAndSyncConfig(projectConfig); err != nil {
		return *projectConfig, err
	}

	return *projectConfig, nil
}

// DeleteGroup removes a group from the project configuration.
// Fails if the group contains folders or has child groups.
func (fs *FolderService) DeleteGroup(groupKey string) (ProjectConfig, error) {
	projectConfig, err := fs.getProjectConfig()
	if err != nil {
		return ProjectConfig{}, err
	}

	// Check if group exists
	if _, exists := projectConfig.Groups[groupKey]; !exists {
		return *projectConfig, fmt.Errorf("group '%s' does not exist", groupKey)
	}

	// Check if any folders are in this group
	for folderName, folder := range projectConfig.Folders {
		if folder.Group == groupKey {
			return *projectConfig, fmt.Errorf("cannot delete group '%s': folder '%s' is assigned to it. Move the folder to another group first", groupKey, folderName)
		}
	}

	// Check if any groups have this as parent
	for childKey, childGroup := range projectConfig.Groups {
		if childGroup.ParentGroup == groupKey {
			return *projectConfig, fmt.Errorf("cannot delete group '%s': group '%s' is a child of it. Delete or move child groups first", groupKey, childKey)
		}
	}

	// Delete the group
	delete(projectConfig.Groups, groupKey)

	// Save and sync
	if err := fs.saveAndSyncConfig(projectConfig); err != nil {
		return *projectConfig, err
	}

	return *projectConfig, nil
}

// RenameGroup changes a group's key while preserving all folder assignments.
func (fs *FolderService) RenameGroup(oldKey string, newKey string, newName string) (ProjectConfig, error) {
	projectConfig, err := fs.getProjectConfig()
	if err != nil {
		return ProjectConfig{}, err
	}

	// Check if old group exists
	oldGroup, exists := projectConfig.Groups[oldKey]
	if !exists {
		return *projectConfig, fmt.Errorf("group '%s' does not exist", oldKey)
	}

	// Check if new key already exists (and isn't the same as old)
	if oldKey != newKey {
		if _, exists := projectConfig.Groups[newKey]; exists {
			return *projectConfig, fmt.Errorf("a group with the key '%s' already exists", newKey)
		}
	}

	// Update all folders that reference the old group key
	for folderName, folder := range projectConfig.Folders {
		if folder.Group == oldKey {
			folder.Group = newKey
			projectConfig.Folders[folderName] = folder
		}
	}

	// Update all child groups that have this as parent
	for childKey, childGroup := range projectConfig.Groups {
		if childGroup.ParentGroup == oldKey {
			childGroup.ParentGroup = newKey
			projectConfig.Groups[childKey] = childGroup
		}
	}

	// Create new group entry with updated name
	newGroup := oldGroup
	newGroup.Name = newName

	// Delete old and add new
	delete(projectConfig.Groups, oldKey)
	projectConfig.Groups[newKey] = newGroup

	// Save and sync
	if err := fs.saveAndSyncConfig(projectConfig); err != nil {
		return *projectConfig, err
	}

	return *projectConfig, nil
}

// GetGroups returns all groups in the project configuration.
func (fs *FolderService) GetGroups() (map[string]GroupConfig, error) {
	projectConfig, err := fs.getProjectConfig()
	if err != nil {
		return nil, err
	}

	if projectConfig.Groups == nil {
		return make(map[string]GroupConfig), nil
	}

	return projectConfig.Groups, nil
}

// wouldCreateCircularReference checks if setting parentKey as the parent of groupKey
// would create a circular reference in the group hierarchy.
func (fs *FolderService) wouldCreateCircularReference(config *ProjectConfig, groupKey, parentKey string) bool {
	visited := make(map[string]bool)
	current := parentKey

	for current != "" {
		if current == groupKey {
			return true
		}
		if visited[current] {
			// Already in a cycle (shouldn't happen with valid data)
			return true
		}
		visited[current] = true

		if group, exists := config.Groups[current]; exists {
			current = group.ParentGroup
		} else {
			break
		}
	}

	return false
}
