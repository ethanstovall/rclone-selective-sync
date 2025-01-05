package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

type GlobalConfig map[string]ProjectConfig

type ProjectConfig struct {
	RcloneRemote string `json:"rclone_remote"`
	LocalPath    string `json:"local_path"`
	// TODO Introduce functionality to create rclone connections through the app.
	// B2AppKey      string `json:"b2_app_key"`
	// B2AppKeyID    string `json:"b2_app_key_id"`
	// BucketName string `json:"BucketName"`
}

type InitializerService struct {
	ConfigPath string
	Config     *GlobalConfig
}

// Initialize loads the configuration file or creates a new one if not present
func (i *InitializerService) Initialize() (*InitializerService, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get user home directory: %v", err)
	}

	configDir := filepath.Join(homeDir, ".config", "rclone-selective-sync")
	configFile := filepath.Join(configDir, "config.json")
	i.ConfigPath = configFile

	// Ensure the config directory exists
	if _, err := os.Stat(configDir); os.IsNotExist(err) {
		if mkdirErr := os.MkdirAll(configDir, 0755); mkdirErr != nil {
			return nil, fmt.Errorf("failed to create config directory: %v", mkdirErr)
		}
	}

	// Load or create the config file
	if _, err := os.Stat(configFile); os.IsNotExist(err) {
		// Create a new default config file
		defaultConfig := &GlobalConfig{}
		if saveErr := saveConfig(configFile, defaultConfig); saveErr != nil {
			return nil, fmt.Errorf("failed to create default config file: %v", saveErr)
		}
		i.Config = defaultConfig
		fmt.Println("Created new default configuration file at", configFile)
	} else {
		// Load the existing config file
		config, loadErr := loadConfig(configFile)
		if loadErr != nil {
			return nil, fmt.Errorf("failed to load config file: %v", loadErr)
		}
		i.Config = config
	}

	return i, nil
}

// saveConfig writes the Config struct to a file in JSON format
func saveConfig(path string, config *GlobalConfig) error {
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	f, err := os.Create(path)
	if err != nil {
		f.Close()
		return err
	}
	_, err = f.Write(data)
	if err != nil {
		f.Close()
		return err
	}
	err = f.Close()
	if err != nil {
		return err
	}
	return nil
}

// loadConfig reads the JSON config file into a Config struct
func loadConfig(path string) (*GlobalConfig, error) {
	data, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %v", err)
	}

	defer data.Close()

	byteResult, _ := io.ReadAll(data)

	var config GlobalConfig
	if err := json.Unmarshal(byteResult, &config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config file: %v", err)
	}

	return &config, nil
}
