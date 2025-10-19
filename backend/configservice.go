package backend

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
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

// Navigate to the specified project directory and find the sync.json config file. If the project
// path doesn't exist, create it. If sync.json is not found locally, attempt to pull it from the
// remote. If it doesn't exist remotely either, create a blank one locally.
func (cs *ConfigService) LoadSelectedProjectConfig() (ProjectConfig, error) {
	var err error
	// Create a new default config file
	defaultConfig := &ProjectConfig{}
	selectedProject := cs.configManager.GetSelectedProject()
	if selectedProject == "" {
		return *defaultConfig, errors.New("no project was selected; cannot load config")
	}

	remoteConfig := cs.configManager.globalConfig.Remotes[selectedProject]
	projectPath := remoteConfig.LocalPath
	configFile := filepath.Join(projectPath, "sync.json")

	// Step 1: Ensure the project directory exists
	if _, dirErr := os.Stat(projectPath); os.IsNotExist(dirErr) {
		fmt.Printf("Project directory does not exist, creating: %s\n", projectPath)
		if mkdirErr := os.MkdirAll(projectPath, 0755); mkdirErr != nil {
			return *defaultConfig, fmt.Errorf("failed to create project directory: %v", mkdirErr)
		}
	}

	// Step 2: Check if sync.json exists locally
	if _, fileErr := os.Stat(configFile); os.IsNotExist(fileErr) {
		fmt.Println("sync.json not found locally, attempting to pull from remote...")

		// Try to pull sync.json from remote
		pullErr := cs.pullSyncFileFromRemote()
		if pullErr != nil {
			// Remote doesn't have sync.json either, create a blank one locally
			fmt.Printf("Could not pull sync.json from remote (%v), creating blank config locally\n", pullErr)
			if saveErr := saveConfig(configFile, defaultConfig); saveErr != nil {
				err = fmt.Errorf("failed to create default config file: %v", saveErr)
			}
			cs.configManager.SetProjectConfig(defaultConfig)
			fmt.Println("Created new default configuration file at", configFile)
		} else {
			// Successfully pulled from remote, now load it
			fmt.Println("Successfully pulled sync.json from remote")
			loadedConfig, loadErr := loadConfig[ProjectConfig](configFile)
			if loadErr != nil {
				return *defaultConfig, fmt.Errorf("failed to load pulled config: %v", loadErr)
			}
			cs.configManager.SetProjectConfig(loadedConfig)
		}
	} else {
		// sync.json exists locally, load it
		loadedConfig, loadErr := loadConfig[ProjectConfig](configFile)
		fmt.Println("Loaded existing sync.json from:", configFile)
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
	cmd := createCommand("rclone", "config", "file")
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

// pullSyncFileFromRemote pulls the sync.json file from the remote to the local project path.
// Returns an error if the remote file doesn't exist or the pull fails.
func (cs *ConfigService) pullSyncFileFromRemote() error {
	selectedProject := cs.configManager.GetSelectedProject()
	if selectedProject == "" {
		return errors.New("no project selected")
	}

	remoteConfig := cs.configManager.globalConfig.Remotes[selectedProject]
	projectPath := remoteConfig.LocalPath
	configFile := filepath.Join(projectPath, "sync.json")
	remotePath := fmt.Sprintf("%s:%s/sync.json", remoteConfig.RemoteName, remoteConfig.BucketName)

	// Use rclone copyto to pull the single file
	cmd := createCommand("rclone", "copyto", remotePath, configFile)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("rclone copyto failed: %s, output: %s", err, string(output))
	}

	fmt.Printf("Successfully pulled sync.json from %s to %s\n", remotePath, configFile)
	return nil
}

// RefreshSyncFile manually refreshes the sync.json from the remote, overwriting the local copy.
// This is intended to be called by the user via a "Refresh" button in the UI.
// Returns the updated ProjectConfig and any error encountered.
func (cs *ConfigService) RefreshSyncFile() (ProjectConfig, error) {
	defaultConfig := &ProjectConfig{}
	selectedProject := cs.configManager.GetSelectedProject()
	if selectedProject == "" {
		return *defaultConfig, errors.New("no project selected")
	}

	// Pull the latest sync.json from remote
	fmt.Println("Refreshing sync.json from remote...")
	if err := cs.pullSyncFileFromRemote(); err != nil {
		return *defaultConfig, fmt.Errorf("failed to refresh sync.json: %v", err)
	}

	// Reload the config from disk
	remoteConfig := cs.configManager.globalConfig.Remotes[selectedProject]
	projectPath := remoteConfig.LocalPath
	configFile := filepath.Join(projectPath, "sync.json")

	loadedConfig, loadErr := loadConfig[ProjectConfig](configFile)
	if loadErr != nil {
		return *defaultConfig, fmt.Errorf("failed to load refreshed config: %v", loadErr)
	}

	// Update the config manager with the new config
	cs.configManager.SetProjectConfig(loadedConfig)
	fmt.Println("sync.json refreshed successfully")

	return *loadedConfig, nil
}
