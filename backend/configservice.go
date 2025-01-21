package backend

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// Service structure for project-related operations.
type ConfigService struct {
	configManager *ConfigManager
}

// Constructor for ConfigService. Must pass in a ConfigManager.
func NewConfigService(configManager *ConfigManager) *ConfigService {
	return &ConfigService{configManager: configManager}
}

// Write the given selected project to the global configuration file.
func (cs *ConfigService) SetSelectedProject(selectedProject string) error {
	var err error
	cs.configManager.SetGlobalConfigSelectedProject(selectedProject)
	cs.configManager.WriteGlobalConfigToDisk()
	return err
}

// Navigate to the specified project directory and find the sync.json config file. If it is not found,
// create a blank one.
func (cs *ConfigService) LoadSelectedProjectConfig() (ProjectConfig, error) {
	var err error
	// Create a new default config file
	defaultConfig := &ProjectConfig{}
	selectedProject := cs.configManager.GetSelectedProject()
	if selectedProject == "" {
		return *defaultConfig, errors.New("no project was selected; cannot load config")
	}
	projectPath := cs.configManager.globalConfig.Remotes[selectedProject].LocalPath
	configFile := filepath.Join(projectPath, "sync.json")

	// Load or create the config file
	if _, fileErr := os.Stat(configFile); os.IsNotExist(fileErr) {
		if saveErr := saveConfig(configFile, defaultConfig); saveErr != nil {
			err = fmt.Errorf("failed to create default config file: %v", saveErr)
		}
		cs.configManager.SetProjectConfig(defaultConfig)
		fmt.Println("Created new default configuration file at", configFile)
	} else {
		// Load the existing config file
		loadedConfig, loadErr := loadConfig[ProjectConfig](configFile)
		fmt.Println(configFile)
		if loadErr != nil {
			err = loadErr
		}
		cs.configManager.SetProjectConfig(loadedConfig)
	}
	return *cs.configManager.GetProjectConfig(), err
}

// Load the global configuration. This configuration determines what the Rclone remotes
// are, and where their corresponding local project folders are found. Note that we return
// the entire configuration object, in addition to the selected project string. The frontend
// doesn't need the entire global configuration, so the selected project name should be
// enough to allow user selection.
// TODO Don't expose the application keys in the frontend; send only the remote names.
func (cs *ConfigService) LoadGlobalConfig() (GlobalConfig, string, error) {
	// Retrieve the default config file path and ensure it exists.
	configFilePath, err := cs.configManager.getDefaultConfigPath()
	if err != nil {
		return GlobalConfig{}, "", fmt.Errorf("failed to get or create default config path: %v", err)
	}

	// Load the existing configuration file.
	loadedConfig, loadErr := loadConfig[GlobalConfig](configFilePath)
	if loadErr != nil {
		return GlobalConfig{}, "", fmt.Errorf("failed to load global configuration: %v", loadErr)
	}

	// Perform Rclone-specific actions on the configuration.
	if rcloneConfigErr := handleRcloneConfig(loadedConfig); rcloneConfigErr != nil {
		return GlobalConfig{}, "", fmt.Errorf("failed to handle Rclone-specific configuration: %v", rcloneConfigErr)
	}

	// Update the configuration manager with the loaded configuration.
	cs.configManager.SetGlobalConfig(loadedConfig)

	// Return the loaded configuration and the selected project.
	return *loadedConfig, loadedConfig.SelectedProject, nil
}

// saveConfig writes the Config struct to a file in JSON format
func saveConfig(path string, config any) error {
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	if _, err = f.Write(data); err != nil {
		return err
	}

	return nil
}

// Generic loadConfig function
func loadConfig[T any](path string) (*T, error) {
	// Step 1: Open the JSON config file
	data, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %v", err)
	}
	defer data.Close()

	// Step 2: Read the contents of the file
	byteResult, err := io.ReadAll(data)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file content: %v", err)
	}

	// Step 3: Unmarshal the JSON content into the specified config type
	var config T
	if err := json.Unmarshal(byteResult, &config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config file: %v", err)
	}

	return &config, nil
}

// handleRcloneConfig handles the Rclone configuration logic for GlobalConfig
func handleRcloneConfig(globalConfig *GlobalConfig) error {
	var rcloneConfig string
	for _, remote := range globalConfig.Remotes {
		rcloneConfig += fmt.Sprintf(
			"[%s]\ntype = %s\naccount = %s\nkey = %s\n\n",
			remote.RemoteName, remote.Type, remote.Account, remote.Key,
		)
	}

	// Get the default Rclone config directory
	rcloneConfigPath, err := getDefaultRcloneConfigPath()
	if err != nil {
		return fmt.Errorf("failed to get default rclone config path: %v", err)
	}

	// Write the Rclone config to the file
	if err := os.WriteFile(rcloneConfigPath, []byte(rcloneConfig), 0600); err != nil {
		return fmt.Errorf("failed to write rclone config: %v", err)
	}

	fmt.Printf("Rclone config written to: %s\n", rcloneConfigPath)
	return nil
}

// getDefaultRcloneConfigPath gets the default Rclone config file path by executing "rclone config file".
func getDefaultRcloneConfigPath() (string, error) {
	cmd := exec.Command("rclone", "config", "file")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to run 'rclone config file': %v", err)
	}

	// Parse the output to extract the config path.
	outputString := string(output)
	// The output looks like: "Configuration file is stored at:\nC:\\path\\to\\rclone.conf"
	lines := strings.Split(outputString, "\n")
	if len(lines) < 2 {
		return "", fmt.Errorf("unexpected output format: %s", output)
	}

	// The second line contains the path.
	configPath := strings.TrimSpace(lines[1])
	configPath = filepath.Clean(configPath)
	return configPath, nil
}
