package backend

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

type LoadProjectConfigService struct{}

// LoadGlobalConfig ensures the configuration is loaded.
func (load *LoadProjectConfigService) LoadProjectConfig(selectedProject string) (ProjectConfig, error) {
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
		b, err := json.MarshalIndent(loadedConfig, "", "  ")
		if err != nil {
			fmt.Errorf("error:", err)
		}
		fmt.Println(string(b))
	}
	return *CurrentProjectConfig, err
}
