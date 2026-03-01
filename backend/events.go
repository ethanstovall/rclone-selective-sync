package backend

import "github.com/wailsapp/wails/v3/pkg/application"

// Event names as constants so they're defined in one place.
const (
	EventTaskFolderComplete   = "task-folder-complete"
	EventTaskComplete         = "task-complete"
	EventDetectFolderComplete = "detect-folder-complete"
	EventDetectComplete       = "detect-complete"
	EventSyncStatus           = "sync-status"
)

// TaskFolderCompletePayload is emitted once per folder when its rclone command finishes.
type TaskFolderCompletePayload struct {
	TaskID        string `json:"taskId"`
	TargetFolder  string `json:"targetFolder"`
	CommandOutput string `json:"commandOutput"`
	CommandError  string `json:"commandError"`
}

// TaskCompletePayload is emitted when all folders in a task have finished.
type TaskCompletePayload struct {
	TaskID string `json:"taskId"`
}

// DetectFolderCompletePayload is emitted per folder during async change detection.
type DetectFolderCompletePayload struct {
	TaskID       string `json:"taskId"`
	TargetFolder string `json:"targetFolder"`
	HasChanges   bool   `json:"hasChanges"`
	CommandError string `json:"commandError"`
}

// DetectCompletePayload is emitted when all change detection is done.
type DetectCompletePayload struct {
	TaskID string `json:"taskId"`
}

// SyncStatusPayload is emitted when a config sync status issue is detected.
type SyncStatusPayload struct {
	Status          string `json:"status"`
	Message         string `json:"message"`
	LocalModTime    string `json:"localModTime"`
	RemoteModTime   string `json:"remoteModTime"`
	SelectedProject string `json:"selectedProject"`
}

// emitEvent is a helper that safely emits a Wails event.
func emitEvent(name string, data interface{}) {
	if app := application.Get(); app != nil {
		app.Event.Emit(name, data)
	}
}
