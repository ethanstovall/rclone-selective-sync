package backend

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type GlobalConfig struct {
	SelectedProject string                  `json:"selected_project"`
	Remotes         map[string]RemoteConfig `json:"remotes"`
}

type RemoteConfig struct {
	RemoteName string `json:"remote_name"`
	BucketName string `json:"bucket_name"`
	Type       string `json:"type"`
	Account    string `json:"account"`
	Key        string `json:"key"`
	LocalPath  string `json:"local_path"`
}

var (
	ConfigInstance *GlobalConfig
	// configOnce     sync.Once
)

// Load the global configuration. This configuration determines what the Rclone remotes
// are, and where their corresponding local project folders are found.
func LoadGlobalConfig() error {
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
		if saveErr := SaveConfig(configFile, defaultConfig); saveErr != nil {
			err = fmt.Errorf("failed to create default config file: %v", saveErr)
		}
		ConfigInstance = defaultConfig
		fmt.Println("Created new default configuration file at", configFile)
	} else {
		// Load the existing config file
		loadedConfig, loadErr := loadConfig[GlobalConfig](configFile)
		if loadErr != nil {
			err = fmt.Errorf("failed to load config file: %v", loadErr)
		}
		ConfigInstance = loadedConfig
	}
	return err
}

// SaveConfig writes the Config struct to a file in JSON format
func SaveConfig(path string, config interface{}) error {
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

	// Step 4: Use a type switch to check the type of the config
	switch cfg := any(&config).(type) {
	case *GlobalConfig:
		// Perform Rclone-specific actions only for GlobalConfig
		if err := handleRcloneConfig(cfg); err != nil {
			return nil, fmt.Errorf("failed to handle Rclone config: %v", err)
		}
	case *ProjectConfig:
		// No Rclone-specific action needed for ProjectConfig
		// Other project-specific logic can go here if required
	default:
		return nil, fmt.Errorf("unsupported config type")
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
