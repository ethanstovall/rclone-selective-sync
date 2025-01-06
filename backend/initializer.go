package backend

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
)

type GlobalConfig struct {
	SelectedProject string                   `json:"selected_project"`
	Projects        map[string]ProjectConfig `json:"projects"`
}

type ProjectConfig struct {
	RemoteName string `json:"remote_name"`
	BucketName string `json:"bucket_name"`
	Type       string `json:"type"`
	Account    string `json:"account"`
	Key        string `json:"key"`
	LocalPath  string `json:"local_path"`
}

var (
	ConfigInstance *GlobalConfig
	configOnce     sync.Once
)

// InitializeConfig ensures the configuration is loaded or created once
func InitializeConfig() error {
	var err error
	configOnce.Do(func() {
		homeDir, homeErr := os.UserHomeDir()
		if homeErr != nil {
			err = fmt.Errorf("failed to get user home directory: %v", homeErr)
			return
		}

		configDir := filepath.Join(homeDir, ".config", "rclone-selective-sync")
		configFile := filepath.Join(configDir, "config.json")

		// Ensure the config directory exists
		if _, dirErr := os.Stat(configDir); os.IsNotExist(dirErr) {
			if mkdirErr := os.MkdirAll(configDir, 0644); mkdirErr != nil {
				err = fmt.Errorf("failed to create config directory: %v", mkdirErr)
				return
			}
		}

		// Load or create the config file
		if _, fileErr := os.Stat(configFile); os.IsNotExist(fileErr) {
			// Create a new default config file
			defaultConfig := &GlobalConfig{}
			if saveErr := saveConfig(configFile, defaultConfig); saveErr != nil {
				err = fmt.Errorf("failed to create default config file: %v", saveErr)
				return
			}
			ConfigInstance = defaultConfig
			fmt.Println("Created new default configuration file at", configFile)
		} else {
			// Load the existing config file
			loadedConfig, loadErr := loadConfig(configFile)
			if loadErr != nil {
				err = fmt.Errorf("failed to load config file: %v", loadErr)
				return
			}
			ConfigInstance = loadedConfig
		}
	})
	return err
}

// saveConfig writes the Config struct to a file in JSON format
func saveConfig(path string, config *GlobalConfig) error {
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

// loadConfig reads the global configuration file, extracts the Rclone config, and writes it to the default Rclone config directory.
func loadConfig(path string) (*GlobalConfig, error) {
	// Step 1: Open the JSON config file.
	data, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %v", err)
	}
	defer data.Close()

	// Step 2: Read the contents of the file.
	byteResult, err := io.ReadAll(data)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file content: %v", err)
	}

	// Step 3: Unmarshal the JSON content into the GlobalConfig structure.
	var config GlobalConfig
	if err := json.Unmarshal(byteResult, &config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config file: %v", err)
	}

	// Step 4: Build the Rclone configuration for all projects.
	var rcloneConfig string
	for _, project := range config.Projects {
		rcloneConfig += fmt.Sprintf(
			"[%s]\ntype = %s\naccount = %s\nkey = %s\n\n",
			project.RemoteName, project.Type, project.Account, project.Key,
		)
	}

	// Step 5: Get the default Rclone config directory.
	rcloneConfigPath, err := getDefaultRcloneConfigPath()
	if err != nil {
		return nil, fmt.Errorf("failed to get default rclone config path: %v", err)
	}

	// Step 6: Write the Rclone config to the file.
	if err := os.WriteFile(rcloneConfigPath, []byte(rcloneConfig), 0600); err != nil {
		return nil, fmt.Errorf("ailed to write rclone config: %v", err)
	}

	fmt.Printf("Rclone config written to: %s\n", rcloneConfigPath)
	return &config, nil
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
