package backend

type GlobalConfig struct {
	SelectedProject string                  `json:"selected_project"`
	Remotes         map[string]RemoteConfig `json:"remotes"`
}

type RemoteConfig struct {
	RemoteName     string `json:"remote_name"`
	BucketName     string `json:"bucket_name"`
	Type           string `json:"type"`
	Account        string `json:"account"`
	Key            string `json:"key"`
	LocalPath      string `json:"local_path"`
	FullBackupPath string `json:"full_backup_path"`
}

func (gc *GlobalConfig) ToJSON() (string, error) {
	return MarshalToJSON(gc)
}
