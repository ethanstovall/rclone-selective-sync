package backend

type RcloneAction string

const (
	PUSH RcloneAction = "PUSH"
	PULL RcloneAction = "PULL"
	// COPY_TO   RcloneAction = "COPY_TO"
	// COPY_FROM RcloneAction = "COPY_FROM"
)
