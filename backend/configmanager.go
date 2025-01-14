package backend

import (
	"encoding/json"
	"fmt"
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

// GetGlobalConfig provides a thread-safe way to access the global config
func (cm *ConfigManager) GetGlobalConfig() *GlobalConfig {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.globalConfig
}

// Set the selected project
func (cm *ConfigManager) SetSelectedProject(selectedProject string) {
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
