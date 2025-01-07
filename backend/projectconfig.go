package backend

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

type ProjectConfig struct {
	AllowGlobalSync bool                    `json:"allow_global_sync"`
	Folders         map[string]FolderConfig `json:"folders"`
}

type FolderConfig struct {
	RemotePath string `json:"remote_path"`
	LocalPath  string `json:"local_path"`
}

var (
	CurrentProjectConfig *ProjectConfig
)

// Navigate to the specified project directory and find the sync.json config file. If it is not found,
// create a blank one.
func LoadProjectConfig(selectedProject string) (ProjectConfig, error) {
	var err error
	if selectedProject == "" {
		return ProjectConfig{}, errors.New("no project was selected; cannot load config")
	}
	projectPath := ConfigInstance.Remotes[selectedProject].LocalPath
	configFile := filepath.Join(projectPath, "sync.json")

	// Load or create the config file
	if _, fileErr := os.Stat(configFile); os.IsNotExist(fileErr) {
		// Create a new default config file
		defaultConfig := &ProjectConfig{}
		if saveErr := SaveConfig(configFile, defaultConfig); saveErr != nil {
			err = fmt.Errorf("failed to create default config file: %v", saveErr)
		}
		CurrentProjectConfig = defaultConfig
		fmt.Println("Created new default configuration file at", configFile)
	} else {
		// Load the existing config file
		loadedConfig, loadErr := loadConfig[ProjectConfig](configFile)
		fmt.Println(configFile)
		if loadErr != nil {
			err = fmt.Errorf("failed to load config file: %v", loadErr)
		}
		CurrentProjectConfig = loadedConfig
	}
	return *CurrentProjectConfig, err
}
