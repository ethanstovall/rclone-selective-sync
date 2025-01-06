package backend

type ProjectConfig struct {
	AllowGlobalSync bool                    `json:"allow_global_sync"`
	Folders         map[string]FolderConfig `json:"folders"`
}

type FolderConfig struct {
	RemotePath string `json:"remote_path"`
	LocalPath  string `json:"local_path"`
}

var (
	CurrentProjectConfig *ProjectConfig
)
