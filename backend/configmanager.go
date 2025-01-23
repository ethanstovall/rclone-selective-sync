package backend

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
)

type ConfigManager struct {
	globalConfig  *GlobalConfig
	projectConfig *ProjectConfig
	mu            sync.RWMutex // Protects against race conditions
}

func NewConfigManager(global *GlobalConfig, project *ProjectConfig) *ConfigManager {
	// Provide default values if the parameters are nil
	if global == nil {
		global = &GlobalConfig{}
	}
	if project == nil {
		project = &ProjectConfig{}
	}

	return &ConfigManager{
		globalConfig:  global,
		projectConfig: project,
	}
}

func (cm *ConfigManager) getDefaultConfigPath() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("failed to get user home directory: %v", err)
	}

	configDir := filepath.Join(homeDir, ".config", "rclone-selective-sync")
	configFile := filepath.Join(configDir, "config.json")

	if _, dirErr := os.Stat(configDir); os.IsNotExist(dirErr) {
		if mkdirErr := os.MkdirAll(configDir, 0644); mkdirErr != nil {
			return "", fmt.Errorf("failed to create config directory: %v", mkdirErr)
		}
	}

	if _, fileErr := os.Stat(configFile); os.IsNotExist(fileErr) {
		defaultConfig := &GlobalConfig{}
		if saveErr := saveConfig(configFile, defaultConfig); saveErr != nil {
			return "", fmt.Errorf("failed to create default config file: %v", saveErr)
		}
		fmt.Println("Created new default configuration file at", configFile)
	}

	return configFile, nil
}

// WriteGlobalConfigToDisk writes the global configuration to its file on disk.
func (cm *ConfigManager) WriteGlobalConfigToDisk() error {
	configFilePath, err := cm.getDefaultConfigPath()
	if err != nil {
		return fmt.Errorf("failed to get config file path: %v", err)
	}

	globalConfig := cm.GetGlobalConfig()
	if err := saveConfig(configFilePath, globalConfig); err != nil {
		return fmt.Errorf("failed to save global config to disk: %v", err)
	}

	return nil
}

// GetGlobalConfig provides a thread-safe way to access the global config
func (cm *ConfigManager) GetGlobalConfig() *GlobalConfig {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.globalConfig
}

// Set the selected project
func (cm *ConfigManager) SetGlobalConfigSelectedProject(selectedProject string) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	cm.globalConfig.SelectedProject = selectedProject
}

// Get the selected project
func (cm *ConfigManager) GetSelectedProject() string {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.globalConfig.SelectedProject
}

// Get the selected project's remote config
func (cm *ConfigManager) GetSelectedProjectRemoteConfig() *RemoteConfig {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	if remoteConfig, exists := cm.globalConfig.Remotes[cm.globalConfig.SelectedProject]; exists {
		return &remoteConfig
	}
	return nil // Handle the case where the SelectedProject does not exist
}

// SetGlobalConfig updates the global config
func (cm *ConfigManager) SetGlobalConfig(global *GlobalConfig) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.globalConfig = global
}

// GetProjectConfig provides a thread-safe way to access the project config
func (cm *ConfigManager) GetProjectConfig() *ProjectConfig {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.projectConfig
}

// SetProjectConfig updates the project config
func (cm *ConfigManager) SetProjectConfig(project *ProjectConfig) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.projectConfig = project
}

// Utility method to marshal a config object to JSON, ostensibly before sending to the front end.
func MarshalToJSON(object any) (string, error) {
	jsonConfig, err := json.Marshal(object)
	if err != nil {
		return "", fmt.Errorf("failed to marshal config: %v", err)
	}
	return string(jsonConfig), nil
}

func (cs *ConfigManager) syncConfigToRemote() error {
	projectRemoteConfig := cs.GetSelectedProjectRemoteConfig()
	projectPath := projectRemoteConfig.LocalPath
	configFile := filepath.Join(projectPath, "sync.json")
	remotePath := fmt.Sprintf("%s:%s/sync.json", projectRemoteConfig.RemoteName, projectRemoteConfig.BucketName)
	cmd := exec.Command("rclone", "copy", configFile, remotePath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("rclone copy failed: %s, output: %s", err, string(output))
	}
	return nil
}
