package backend

type RcloneAction string

const (
	SYNC_PUSH RcloneAction = "SYNC_PUSH"
	SYNC_PULL RcloneAction = "SYNC_PULL"
	COPY_PULL RcloneAction = "COPY_PULL"
)

// List of actions for which its optional that the root folder exists.
var OPTIONAL_FOLDER_EXISTENCE = []RcloneAction{
	COPY_PULL,
}

// IsFolderOptional checks if the given RcloneAction is in the OPTIONAL_FOLDER_EXISTENCE list.
func IsFolderOptional(action RcloneAction) bool {
	for _, validAction := range OPTIONAL_FOLDER_EXISTENCE {
		if action == validAction {
			return true
		}
	}
	return false
}
