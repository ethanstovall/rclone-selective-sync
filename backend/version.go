package backend

// Version is the application version, set at build time via ldflags
var Version = "dev"

// GetVersion returns the current application version
func GetVersion() string {
	return Version
}
