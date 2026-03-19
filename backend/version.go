package backend

// Version is the application version, set at build time via ldflags
var Version = "dev"

// RcloneVersion is the embedded rclone version, pinned in go.mod
const RcloneVersion = "v1.73.2"

// GetVersion returns the current application version
func GetVersion() string {
	return Version
}

// GetRcloneVersion returns the embedded rclone version
func GetRcloneVersion() string {
	return RcloneVersion
}
