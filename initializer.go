package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
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
			if mkdirErr := os.MkdirAll(configDir, 0755); mkdirErr != nil {
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

// loadConfig reads the JSON config file into a Config struct
func loadConfig(path string) (*GlobalConfig, error) {
	data, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %v", err)
	}
	defer data.Close()

	byteResult, err := io.ReadAll(data)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file content: %v", err)
	}

	var config GlobalConfig
	if err := json.Unmarshal(byteResult, &config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config file: %v", err)
	}

	return &config, nil
}
