# Improvement: Native Folder Picker for Registration

## Status: ✅ IMPLEMENTED (v0.2.0)

## Summary

Add a native OS folder picker dialog to the "Register New Folder" workflow, replacing the current manual text input for folder paths. This uses Wails' built-in dialog API to provide a familiar, native file selection experience.

**Implementation completed in v0.2.0** - See commit `098ae0a` and `d57384e`.

---

## ~~Current~~ Previous State

### ~~Problem~~ Previous Issue

In [NewFolderDialog.tsx](../../frontend/src/components/SyncFolders/NewFolderDialog.tsx), users ~~must~~ had to manually type the folder path:

```typescript
<TextField
    label="Local Path"
    id="local-folder-path"
    value={newFolderConfig.local_path ?? localRoot}
    onChange={(event) => handleInputChange("local_path", event.target.value)}
    slotProps={{
        input: {
            startAdornment:
                <InputAdornment position="start">
                    <ActionIconButton
                        onClick={() => { handleOpenFolder("") }}  // Opens explorer, doesn't pick
                    />{`${localRoot}/`}
                </InputAdornment>,
        },
    }}
/>
```

**Issues**:
- User must manually type or copy/paste paths
- Error-prone (typos, incorrect separators)
- "Open" button opens Explorer but doesn't return selection
- No path validation until save attempt

---

## Solution: Wails Native Dialog

Wails v3 provides native dialog APIs that can open OS-level folder selection dialogs.

### Wails v3 Dialog API

Based on Wails documentation, the dialog API is available through the application package:

```go
import "github.com/wailsapp/wails/v3/pkg/application"

// OpenDirectoryDialog opens a native folder picker
func (app *application.App) OpenDirectoryDialog(options application.OpenDialogOptions) (string, error)

type OpenDialogOptions struct {
    DefaultDirectory           string
    DefaultFilename            string
    Title                      string
    Filters                    []FileFilter  // Not used for directory dialog
    ShowHiddenFiles            bool
    CanCreateDirectories       bool
    ResolvesAliases            bool
    TreatPackagesAsDirectories bool
}
```

---

## Implementation

### Backend: Add Dialog Method to FolderService

```go
// backend/folderservice.go

import (
    "github.com/wailsapp/wails/v3/pkg/application"
)

type FolderService struct {
    configManager *ConfigManager
    app           *application.App  // Need reference to app for dialogs
}

// NewFolderService now takes app reference
func NewFolderService(configManager *ConfigManager, app *application.App) *FolderService {
    return &FolderService{
        configManager: configManager,
        app:           app,
    }
}

// OpenFolderPicker opens a native folder selection dialog
// Returns the selected folder path (relative to project root) or empty string if cancelled
func (fs *FolderService) OpenFolderPicker() (string, error) {
    projectConfig := fs.configManager.GetGlobalConfig()
    if projectConfig == nil {
        return "", fmt.Errorf("no project selected")
    }

    selectedProject := projectConfig.SelectedProject
    if selectedProject == "" {
        return "", fmt.Errorf("no project selected")
    }

    remoteConfig := projectConfig.Remotes[selectedProject]
    projectRoot := remoteConfig.LocalPath

    // Open native directory picker
    selectedPath, err := fs.app.OpenDirectoryDialog(application.OpenDialogOptions{
        DefaultDirectory:     projectRoot,
        Title:                "Select Folder to Register",
        CanCreateDirectories: false,
        ShowHiddenFiles:      false,
    })

    if err != nil {
        return "", err
    }

    // User cancelled
    if selectedPath == "" {
        return "", nil
    }

    // Validate: must be within project root
    if !strings.HasPrefix(selectedPath, projectRoot) {
        return "", fmt.Errorf("selected folder must be within project root: %s", projectRoot)
    }

    // Convert to relative path
    relativePath := strings.TrimPrefix(selectedPath, projectRoot)
    relativePath = strings.TrimPrefix(relativePath, string(os.PathSeparator))
    relativePath = normalizePath(relativePath)

    return relativePath, nil
}
```

### Update main.go to Pass App Reference

```go
// main.go
func main() {
    configManager := backend.NewConfigManager(nil, nil)

    app := application.New(application.Options{
        Name:        "rclone-selective-sync",
        Description: "...",
        // Services will be added after app creation
        Assets: application.AssetOptions{
            Handler: application.AssetFileServerFS(assets),
        },
        Mac: application.MacOptions{
            ApplicationShouldTerminateAfterLastWindowClosed: true,
        },
    })

    // Create services with app reference for dialog access
    configService := backend.NewConfigService(configManager)
    syncService := backend.NewSyncService(configManager)
    folderService := backend.NewFolderService(configManager, app)

    // Register services
    app.RegisterService(application.NewService(configService))
    app.RegisterService(application.NewService(syncService))
    app.RegisterService(application.NewService(folderService))

    // ... rest of main.go
}
```

### Alternative: Standalone Dialog Service

If modifying FolderService is complex, create a dedicated dialog service:

```go
// backend/dialogservice.go
package backend

import "github.com/wailsapp/wails/v3/pkg/application"

type DialogService struct {
    app *application.App
}

func NewDialogService(app *application.App) *DialogService {
    return &DialogService{app: app}
}

func (ds *DialogService) SelectDirectory(defaultPath, title string) (string, error) {
    return ds.app.OpenDirectoryDialog(application.OpenDialogOptions{
        DefaultDirectory:     defaultPath,
        Title:                title,
        CanCreateDirectories: false,
        ShowHiddenFiles:      false,
    })
}

func (ds *DialogService) SelectFile(defaultPath, title string, filters []application.FileFilter) (string, error) {
    return ds.app.OpenFileDialog(application.OpenDialogOptions{
        DefaultDirectory: defaultPath,
        Title:            title,
        Filters:          filters,
    })
}
```

### Frontend: Update NewFolderDialog

```typescript
// frontend/src/components/SyncFolders/NewFolderDialog.tsx

import { FolderService } from "../../../bindings/...";
// Or if using DialogService:
// import { DialogService } from "../../../bindings/...";

const NewFolderDialog: React.FC<NewFolderDialogProps> = ({ isOpen, setIsOpen }) => {
    const { globalConfig, selectedProject } = useGlobalConfig();
    const localRoot = useMemo(() => {
        if (!globalConfig || !selectedProject) return undefined;
        return globalConfig.remotes[selectedProject].local_path;
    }, [globalConfig, selectedProject]);

    const { setProjectConfig } = useProjectConfig();

    const [isSaving, setIsSaving] = useState(false);
    const [isPicking, setIsPicking] = useState(false);  // New loading state
    const [newFolderConfig, setNewFolderConfig] = useState<FolderConfig>(new FolderConfig());
    const [newFolderName, setNewFolderName] = useState("");
    const [pickError, setPickError] = useState<string | null>(null);  // New error state

    // Handle native folder picker
    const handleBrowseFolder = async () => {
        setIsPicking(true);
        setPickError(null);
        try {
            const selectedPath = await FolderService.OpenFolderPicker();

            if (selectedPath) {
                // Update the local_path with selected folder
                handleInputChange("local_path", selectedPath);

                // Auto-fill folder name if empty (use last path segment)
                if (!newFolderName.trim()) {
                    const folderName = selectedPath.split('/').pop() || '';
                    setNewFolderName(folderName);
                }
            }
            // If empty, user cancelled - do nothing
        } catch (e: any) {
            console.error("Error selecting folder:", e);
            setPickError(e.message || "Failed to select folder");
        } finally {
            setIsPicking(false);
        }
    };

    // ... existing handlers ...

    return (
        <StandardDialog
            title="Register New Folder"
            isOpen={isOpen}
            isLoading={isSaving}
            handleClose={handleClose}
            handleConfirm={handleConfirm}
            isDisabled={!canSaveEdit}
        >
            <Box>
                <TextField
                    label="Folder Name"
                    id="folder-name"
                    value={newFolderName}
                    onChange={(event) => setNewFolderName(event.target.value)}
                    helperText={!newFolderName.trim() ? "Please enter a folder name." : ""}
                    fullWidth
                    margin="normal"
                    autoComplete="off"
                />

                <TextField
                    label="Local Path"
                    id="local-folder-path"
                    value={newFolderConfig.local_path || ""}
                    onChange={(event) => handleInputChange("local_path", event.target.value)}
                    error={!!pickError}
                    helperText={pickError || `Relative to: ${localRoot}/`}
                    fullWidth
                    margin="normal"
                    autoComplete="off"
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    {`${localRoot}/`}
                                </InputAdornment>
                            ),
                            endAdornment: (
                                <InputAdornment position="end">
                                    <ActionButton
                                        label="Browse..."
                                        onClick={handleBrowseFolder}
                                        isLoading={isPicking}
                                        disabled={isPicking}
                                    />
                                </InputAdornment>
                            ),
                        },
                    }}
                />

                <TextField
                    label="Description"
                    id="description"
                    value={newFolderConfig.description}
                    onChange={(event) => handleInputChange("description", event.target.value)}
                    fullWidth
                    multiline
                    rows={3}
                    margin="normal"
                    autoComplete="off"
                />
            </Box>
        </StandardDialog>
    );
};
```

---

## UI/UX Improvements

### Before
```
┌─────────────────────────────────────────────────────────────┐
│ Register New Folder                                          │
├─────────────────────────────────────────────────────────────┤
│ Folder Name:     [________________]                         │
│                                                              │
│ Local Path:      [🔗] /Users/me/project/ [________]        │
│                   ↑ Opens explorer but doesn't select       │
│                                                              │
│ Description:     [________________]                         │
│                  [________________]                         │
│                                                              │
│                              [Cancel] [Save]                │
└─────────────────────────────────────────────────────────────┘
```

### After
```
┌─────────────────────────────────────────────────────────────┐
│ Register New Folder                                          │
├─────────────────────────────────────────────────────────────┤
│ Folder Name:     [scene_042____________]                    │
│                                                              │
│ Local Path:      /Users/me/project/ [scenes/scene_042]      │
│                                          [Browse...]        │
│                   ↑ Native folder picker dialog              │
│                                                              │
│ Description:     [________________]                         │
│                  [________________]                         │
│                                                              │
│                              [Cancel] [Save]                │
└─────────────────────────────────────────────────────────────┘
```

---

## Platform Behavior

### macOS
- Uses NSOpenPanel
- Shows native Finder-like interface
- Respects system preferences (sidebar favorites, etc.)

### Windows
- Uses IFileDialog (Vista+)
- Shows native Windows Explorer interface
- Includes "New Folder" button if `CanCreateDirectories: true`

### Linux
- Uses GTK/Qt dialog (depends on desktop environment)
- Falls back to Zenity/kdialog if needed

---

## Implementation Tasks

1. [x] ~~Add `OpenFolderPicker` method to FolderService~~ **COMPLETED**
   - Implemented in [backend/folderservice.go:342-395](../../backend/folderservice.go#L342-L395)
   - Uses Wails v3 `app.Dialog.OpenFile()` API with directory selection
   - Returns relative path to project root
   - Validates selection is within project boundaries

2. [x] ~~Update main.go to pass app reference to service~~ **NOT REQUIRED**
   - Wails v3 provides `application.Get()` for global app access
   - No constructor changes needed

3. [x] ~~Regenerate TypeScript bindings~~ **COMPLETED**
   - Bindings automatically generated for `OpenFolderPicker()`
   - Available in frontend as `FolderService.OpenFolderPicker()`

4. [x] ~~Update NewFolderDialog component with Browse button~~ **COMPLETED**
   - Implemented in [frontend/src/components/SyncFolders/NewFolderDialog.tsx:160-175](../../frontend/src/components/SyncFolders/NewFolderDialog.tsx#L160-L175)
   - "Browse..." button integrated into text field

5. [x] ~~Add loading state during folder selection~~ **COMPLETED**
   - `isPickingFolder` state variable tracks picker status
   - Button shows loading state during selection

6. [x] ~~Add error handling for invalid selections~~ **COMPLETED**
   - Backend validates folder is within project root
   - Frontend displays error messages via helper text
   - User cancellation handled gracefully (no error shown)

7. [x] ~~Auto-fill folder name from selected path~~ **COMPLETED**
   - Last path segment used as folder name suggestion
   - Only auto-fills if folder name field is empty

8. [ ] Test on all platforms (macOS, Windows, Linux) **PARTIAL**
   - Tested on Windows ✅
   - macOS/Linux testing pending

---

## Alternative: Embedded File Explorer

If native dialogs prove problematic (Wails v3 alpha stability), the in-app file explorer feature (FEATURE_FILE_EXPLORER.md) provides a fallback:

```typescript
// Fallback to embedded explorer
const [showExplorer, setShowExplorer] = useState(false);

// Try native first, fall back to embedded
const handleBrowse = async () => {
    try {
        const path = await FolderService.OpenFolderPicker();
        if (path) handleInputChange("local_path", path);
    } catch (e) {
        // Native dialog failed, show embedded explorer
        setShowExplorer(true);
    }
};
```

---

## Testing Considerations

- Test dialog cancellation (should not change anything)
- Test selecting folder outside project root (should error)
- Test with spaces in path names
- Test with unicode characters in path names
- Test with deeply nested folders
- Test on all three platforms
- Test when no project is selected (should error gracefully)

---

---

## Actual Implementation (v0.2.0)

The feature was successfully implemented using a simpler approach than originally proposed:

### Backend Implementation

**File:** [backend/folderservice.go](../../backend/folderservice.go#L342-L395)

```go
func (fs *FolderService) OpenFolderPicker() (string, error) {
    // Get project root
    projectRemoteConfig := fs.configManager.GetSelectedProjectRemoteConfig()
    projectRoot := projectRemoteConfig.LocalPath

    // Use Wails v3 Dialog API (no app reference needed in constructor)
    app := application.Get()
    selectedPath, err := app.Dialog.OpenFile().
        SetTitle("Select Folder to Register").
        SetDirectory(projectRoot).
        CanChooseDirectories(true).
        CanChooseFiles(false).
        CanCreateDirectories(true).
        PromptForSingleSelection()

    // Validate and return relative path
    if !strings.HasPrefix(normalizedSelected, normalizedRoot) {
        return "", fmt.Errorf("selected folder must be within project root")
    }

    relativePath := strings.TrimPrefix(normalizedSelected, normalizedRoot)
    return normalizePath(relativePath), nil
}
```

### Frontend Implementation

**File:** [frontend/src/components/SyncFolders/NewFolderDialog.tsx](../../frontend/src/components/SyncFolders/NewFolderDialog.tsx#L160-L175)

```typescript
const handleBrowse = async () => {
    setIsPickingFolder(true);
    setFolderPickError("");
    try {
        const selectedPath = await FolderService.OpenFolderPicker();
        if (selectedPath) {
            setNewFolderConfig({ ...newFolderConfig, local_path: selectedPath });
            // Auto-fill folder name if empty
            if (!newFolderName.trim()) {
                const folderName = selectedPath.split("/").pop() || "";
                setNewFolderName(folderName);
            }
        }
    } catch (e: any) {
        setFolderPickError(e || "Failed to select folder");
    } finally {
        setIsPickingFolder(false);
    }
};
```

### Key Differences from Proposal

1. **No app reference in constructor** - Used `application.Get()` instead of passing app to service
2. **Simpler Dialog API** - Wails v3 provides cleaner chaining API than proposed
3. **Integrated into existing dialog** - Didn't create separate DialogService
4. **Single-purpose implementation** - Focused only on folder registration workflow

### Outstanding Work

- **Platform testing**: Need to verify on macOS and Linux (currently only tested on Windows)
- **Documentation**: Update user-facing documentation with screenshots of native picker

---

## References

- [Wails v3 Dialog API](https://v3alpha.wails.io/learn/application/#dialog) - Official documentation
- [Wails v2 Dialog Docs](https://wails.io/docs/reference/runtime/dialog/) (v3 similar)
- [Wails GitHub Issue #2451](https://github.com/wailsapp/wails/issues/2451) - Directory dialog discussion
- [FEATURE_FILE_EXPLORER.md](../features/FEATURE_FILE_EXPLORER.md) - Alternative in-app explorer
