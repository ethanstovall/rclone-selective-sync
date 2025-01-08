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

// Navigate to the specified project directory and find the sync.json config file. If it is not found,
// create a blank one.
func (cs *ConfigService) LoadProjectConfig(selectedProject string) (string, error) {
	var err error
	if selectedProject == "" {
		return "{}", errors.New("no project was selected; cannot load config")
	}
	projectPath := cs.configManager.globalConfig.Remotes[cs.configManager.globalConfig.SelectedProject].LocalPath
	configFile := filepath.Join(projectPath, "sync.json")

	// Load or create the config file
	if _, fileErr := os.Stat(configFile); os.IsNotExist(fileErr) {
		// Create a new default config file
		defaultConfig := &ProjectConfig{}
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
	if err != nil {
		return "", err
	}
	jsonPayload, err := cs.configManager.GetProjectConfig().ToJSON()
	return jsonPayload, err
}

// Load the global configuration. This configuration determines what the Rclone remotes
// are, and where their corresponding local project folders are found.
func (cs *ConfigService) LoadGlobalConfig() (GlobalConfig, error) {
	var err error
	homeDir, homeErr := os.UserHomeDir()
	if homeErr != nil {
		err = fmt.Errorf("failed to get user home directory: %v", homeErr)
	}

	configDir := filepath.Join(homeDir, ".config", "rclone-selective-sync")
	configFile := filepath.Join(configDir, "config.json")

	// Ensure the config directory exists
	if _, dirErr := os.Stat(configDir); os.IsNotExist(dirErr) {
		if mkdirErr := os.MkdirAll(configDir, 0644); mkdirErr != nil {
			err = fmt.Errorf("failed to create config directory: %v", mkdirErr)
		}
	}

	// Load or create the config file
	if _, fileErr := os.Stat(configFile); os.IsNotExist(fileErr) {
		// Create a new default config file
		defaultConfig := &GlobalConfig{}
		if saveErr := saveConfig(configFile, defaultConfig); saveErr != nil {
			err = fmt.Errorf("failed to create default config file: %v", saveErr)
		}
		cs.configManager.SetGlobalConfig(defaultConfig)
		fmt.Println("Created new default configuration file at", configFile)
	} else {
		// Load the existing config file
		loadedConfig, loadErr := loadConfig[GlobalConfig](configFile)
		if loadErr != nil {
			err = loadErr
		}
		// Perform Rclone-specific actions only for GlobalConfig
		if rcloneConfigErr := handleRcloneConfig(loadedConfig); err != nil {
			err = rcloneConfigErr
		}
		cs.configManager.SetGlobalConfig(loadedConfig)
	}
	// jsonPayload, err := cs.configManager.GetGlobalConfig().ToJSON()
	return *cs.configManager.GetGlobalConfig(), err
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
