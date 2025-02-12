package main

import (
	"embed"
	"log"
	"time"

	"github.com/ethanstovall/rclone-selective-sync/backend" // Import the backend package.
	"github.com/wailsapp/wails/v3/pkg/application"
)

// Wails uses Go's `embed` package to embed the frontend files into the binary.
// Any files in the frontend/dist folder will be embedded into the binary and
// made available to the frontend.
// See https://pkg.go.dev/embed for more information.

//go:embed all:frontend/dist
var assets embed.FS

// main function serves as the application's entry point. It initializes the application, creates a window,
// and starts a goroutine that emits a time-based event every second. It subsequently runs the application and
// logs any error that might occur.
func main() {
	// Instantiate the ConfigManager instance that will be passed to all services. Just start with nil config.
	configManager := backend.NewConfigManager(nil, nil)

	// // Load the user's app configuration.
	// globalConfigLoadErr := backend.LoadGlobalConfig()
	// if globalConfigLoadErr != nil {
	// 	log.Fatalf("Failed to initialize Rclone remote configuration: %v", globalConfigLoadErr)
	// }
	// // Load the initial selected project's configuration.
	// _, projectConfigLoadErr := backend.LoadProjectConfig(backend.ConfigInstance.SelectedProject)
	// if projectConfigLoadErr != nil {
	// 	log.Fatalf("Failed to initialize project configuration for selected project: %v", projectConfigLoadErr)
	// }

	// Create a new Wails application by providing the necessary options.
	// Variables 'Name' and 'Description' are for application metadata.
	// 'Assets' configures the asset server with the 'FS' variable pointing to the frontend files.
	// 'Bind' is a list of Go struct instances. The frontend has access to the methods of these instances.
	// 'Mac' options tailor the application when running an macOS.
	app := application.New(application.Options{
		Name:        "rclone-selective-sync",
		Description: "An application allowing selective syncing of subfolders in a remote storage bucket using Rclone.",
		Services: []application.Service{
			application.NewService(backend.NewConfigService(configManager)),
			application.NewService(backend.NewSyncService(configManager)),
			application.NewService(backend.NewFolderService(configManager)),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	// Create a new window with the necessary options.
	// 'Title' is the title of the window.
	// 'Mac' options tailor the window when running on macOS.
	// 'BackgroundColour' is the background colour of the window.
	// 'URL' is the URL that will be loaded into the webview.
	app.NewWebviewWindowWithOptions(application.WebviewWindowOptions{
		Title:  "Rclone Selective Sync",
		Width:  1440, // Default width
		Height: 810,  // Default height
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              "/",
	})

	// Create a goroutine that emits an event containing the current time every second.
	// The frontend can listen to this event and update the UI accordingly.
	go func() {
		for {
			now := time.Now().Format(time.RFC1123)
			app.EmitEvent("time", now)
			time.Sleep(time.Second)
		}
	}()

	// Run the application. This blocks until the application has been exited.
	err := app.Run()

	// If an error occurred while running the application, log it and exit.
	if err != nil {
		log.Fatal(err)
	}
}
