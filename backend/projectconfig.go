package backend

type ProjectConfig struct {
	AllowGlobalSync bool                    `json:"allow_global_sync"`
	Folders         map[string]FolderConfig `json:"folders"`
	Groups          map[string]GroupConfig  `json:"groups"`
}

// GroupConfig defines a folder group for organizing folders in the UI
type GroupConfig struct {
	Name        string `json:"name"`         // Display name
	ParentGroup string `json:"parent_group"` // Empty = top-level, otherwise = nested under parent
	SortOrder   int    `json:"sort_order"`   // For manual ordering (future)
}

type FolderConfig struct {
	RemotePath  string `json:"remote_path"`
	LocalPath   string `json:"local_path"`
	Description string `json:"description"`
	Group       string `json:"group"` // Group key (required for new folders)
}

func (pc *ProjectConfig) ToJSON() (string, error) {
	return MarshalToJSON(pc)
}

// InitDefaults ensures Folders and Groups are initialized (never null).
// Returns true if any initialization was needed.
func (pc *ProjectConfig) InitDefaults() bool {
	changed := false
	if pc.Folders == nil {
		pc.Folders = make(map[string]FolderConfig)
		changed = true
	}
	if pc.Groups == nil {
		pc.Groups = make(map[string]GroupConfig)
		changed = true
	}
	return changed
}

// MigrateToGroups migrates a ProjectConfig from the old format (no groups) to the new format.
// If Groups is nil/empty but Folders exist, creates a "General" group and assigns all folders to it.
// Returns true if migration was performed.
func (pc *ProjectConfig) MigrateToGroups() bool {
	// Ensure maps are initialized
	pc.InitDefaults()

	// Check if migration is needed: folders exist but have no groups assigned
	needsMigration := false
	if len(pc.Folders) > 0 && len(pc.Groups) == 0 {
		needsMigration = true
	} else {
		// Also check if any folder has an empty group
		for _, folder := range pc.Folders {
			if folder.Group == "" {
				needsMigration = true
				break
			}
		}
	}

	if !needsMigration {
		return false
	}

	// Create the default "General" group if it doesn't exist
	const defaultGroupKey = "general"
	if _, exists := pc.Groups[defaultGroupKey]; !exists {
		pc.Groups[defaultGroupKey] = GroupConfig{
			Name:        "General",
			ParentGroup: "",
			SortOrder:   0,
		}
	}

	// Assign all folders without a group to the default group
	for key, folder := range pc.Folders {
		if folder.Group == "" {
			folder.Group = defaultGroupKey
			pc.Folders[key] = folder
		}
	}

	return true
}
