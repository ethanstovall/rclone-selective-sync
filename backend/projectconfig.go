package backend

// Service structure for project-related operations.
type ProjectConfigService struct {
	remoteConfig         *RemoteConfig
	currentProjectConfig *ProjectConfig
}

type ProjectConfig struct {
	AllowGlobalSync bool                    `json:"allow_global_sync"`
	Folders         map[string]FolderConfig `json:"folders"`
}

type FolderConfig struct {
	RemotePath string `json:"remote_path"`
	LocalPath  string `json:"local_path"`
}

func (pc *ProjectConfig) ToJSON() (string, error) {
	return MarshalToJSON(pc)
}
