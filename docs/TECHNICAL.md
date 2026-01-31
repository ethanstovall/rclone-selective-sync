# Rclone Selective Sync - Technical Documentation

## Overview

Rclone Selective Sync is a **Wails v3 desktop application** that provides a GUI wrapper around rclone for managing selective folder synchronization with cloud storage. It enables users to maintain local copies of only the folders they need while preserving complete backups in the cloud.

---

## Architecture

### Technology Stack

| Layer | Technology |
|-------|------------|
| Desktop Framework | Wails v3 (Go + WebView) |
| Backend | Go 1.21+ |
| Frontend | React 18 + TypeScript |
| UI Framework | Material-UI (MUI) v5 + Toolpad Core |
| Routing | React Router v7 |
| Build | Vite (frontend), Go compiler (backend) |
| External Dependency | rclone CLI |

### Project Structure

```
rclone-selective-sync/
├── main.go                    # Application entry point
├── backend/                   # Go backend services
│   ├── configmanager.go       # Thread-safe config state holder
│   ├── globalconfig.go        # GlobalConfig data models
│   ├── projectconfig.go       # ProjectConfig data models
│   ├── configservice.go       # Config loading/saving operations
│   ├── folderservice.go       # Folder CRUD operations
│   ├── syncservice.go         # Rclone command execution
│   ├── rclonecommand.go       # Rclone command builder
│   ├── rcloneaction.go        # Rclone action enum
│   ├── exec_windows.go        # Windows command execution
│   └── exec_other.go          # macOS/Linux command execution
├── frontend/
│   ├── src/
│   │   ├── pages/             # Route pages
│   │   ├── components/        # React components
│   │   ├── hooks/             # Context providers & hooks
│   │   ├── App.tsx            # Root component with routing
│   │   └── routes.ts          # Route constants
│   └── bindings/              # Auto-generated Wails TypeScript bindings
├── Taskfile.yml               # Build tasks
└── version.txt                # Application version
```

---

## Backend Services

### ConfigManager (`configmanager.go`)

**Purpose**: Thread-safe central state holder for global and project configurations.

**Thread Safety**: Uses `sync.RWMutex` to prevent race conditions on concurrent config access.

**Key Methods**:
- `GetGlobalConfig()` / `SetGlobalConfig()` - RWMutex-protected config access
- `GetProjectConfig()` / `SetProjectConfig()` - Project config access
- `WriteGlobalConfigToDisk()` - Persists global config as JSON
- `syncConfigToRemote()` - Pushes sync.json to remote via rclone

### ConfigService (`configservice.go`)

**Exposed API Methods** (accessible from frontend):

| Method | Signature | Description |
|--------|-----------|-------------|
| `LoadGlobalConfig` | `() → (GlobalConfig, string, error)` | Loads config, writes rclone.conf, returns config + selected project |
| `SetSelectedProject` | `(string) → error` | Updates selected project and persists |
| `LoadSelectedProjectConfig` | `() → (ProjectConfig, error)` | Loads sync.json (local or pulled from remote) |
| `RefreshSyncFile` | `() → (ProjectConfig, error)` | Force-pulls sync.json from remote |

**Rclone Config Generation**:
- Extracts credentials from `RemoteConfig` entries
- Runs `rclone config file` to locate rclone.conf path
- Writes remote credentials in rclone.conf format

### SyncService (`syncservice.go`)

**Exposed API Methods**:

| Method | Signature | Description |
|--------|-----------|-------------|
| `ExecuteRcloneAction` | `([]string, RcloneAction, bool) → []RcloneActionOutput` | Execute rclone on multiple folders (parallel) |
| `ExecuteFullBackup` | `(bool) → []RcloneActionOutput` | Backup entire project to backup location |
| `DetectChangedFolders` | `([]string) → []string` | Dry-run sync to detect changed folders |

**Rclone Actions**:
```go
SYNC_PUSH  // rclone sync <local> <remote> - Push local changes
SYNC_PULL  // rclone sync <remote> <local> - Pull remote changes
COPY_PULL  // rclone copy <remote> <local> - Download without deleting
```

### FolderService (`folderservice.go`)

**Exposed API Methods**:

| Method | Signature | Description |
|--------|-----------|-------------|
| `GetLocalFolders` | `() → ([]string, error)` | Get folders that exist locally |
| `OpenFolder` | `(string) → error` | Open folder in system file explorer |
| `CreateLocalFolders` | `([]string) → error` | Create local directories |
| `DeleteLocalFolders` | `([]string) → error` | Delete local directories |
| `RegisterNewFolder` | `(string, FolderConfig) → (ProjectConfig, error)` | Add folder to config |
| `EditFolder` | `(string, string, FolderConfig) → (ProjectConfig, error)` | Update folder config |
| `DeregisterFolder` | `(string) → (ProjectConfig, error)` | Remove folder from config |

---

## Data Models

### GlobalConfig

**Storage Location**: `~/.config/rclone-selective-sync/config.json`

```go
type GlobalConfig struct {
    SelectedProject string                  `json:"selected_project"`
    Remotes         map[string]RemoteConfig `json:"remotes"`
}

type RemoteConfig struct {
    RemoteName     string `json:"remote_name"`     // Rclone remote name
    BucketName     string `json:"bucket_name"`     // Cloud bucket name
    Type           string `json:"type"`            // Remote type (e.g., "b2")
    Account        string `json:"account"`         // Account/key ID
    Key            string `json:"key"`             // Application key (PLAINTEXT)
    LocalPath      string `json:"local_path"`      // Project root on local filesystem
    FullBackupPath string `json:"full_backup_path"` // Full backup destination
}
```

### ProjectConfig

**Storage Location**: `<project_root>/sync.json`

```go
type ProjectConfig struct {
    AllowGlobalSync bool                    `json:"allow_global_sync"`
    Folders         map[string]FolderConfig `json:"folders"`
}

type FolderConfig struct {
    RemotePath  string `json:"remote_path"`  // Relative path on remote
    LocalPath   string `json:"local_path"`   // Relative path locally
    Description string `json:"description"`  // User-provided description
}
```

### RcloneActionOutput

```go
type RcloneActionOutput struct {
    TargetFolder  string // Folder name/key
    CommandOutput string // Rclone stdout
    CommandError  string // Rclone stderr or internal error
}
```

---

## Frontend Architecture

### State Management

Uses React Context API with two main contexts:

**GlobalConfigContext** (`hooks/GlobalConfigContext.tsx`):
- Stores `GlobalConfig` and `selectedProject`
- Provides `setSelectedProject()` to switch projects
- Loads on app mount via `ConfigService.LoadGlobalConfig()`

**ProjectConfigContext** (`hooks/ProjectConfigContext.tsx`):
- Stores `ProjectConfig` for current project
- Reloads when `selectedProject` changes
- Provides setter for optimistic UI updates

### Page Structure

| Route | Page | Description |
|-------|------|-------------|
| `/sync-folders` | `SyncFolders.tsx` | Main folder sync interface |
| `/preferences` | `Preferences.tsx` | App preferences (stub) |
| `/manage-remotes` | `ManageRemotes.tsx` | Remote management (stub) |

### Key Components (SyncFolders)

| Component | Purpose |
|-----------|---------|
| `ProjectSelector` | Loading gate + project selection dropdown |
| `ProjectDashboard` | Main content area with folder operations |
| `FolderTree` | Folder list with checkboxes and search |
| `FocusedFolderControls` | Folder details panel (edit/deregister/open) |
| `NewFolderDialog` | Dialog for registering new folders |
| `RcloneActionDialog` | Two-phase dialog for rclone operations |

---

## Sync Operations Flow

### Standard Sync Pattern

All sync operations follow a **dry-run → review → confirm** pattern:

```
1. User selects folders
2. User clicks action button
3. Backend runs rclone with --dry-run
4. Dialog shows preview of changes
5. User reviews and clicks Confirm or Cancel
6. If confirmed, backend runs actual rclone command
```

### Rclone Commands Generated

| Action | Command Pattern |
|--------|-----------------|
| SYNC_PUSH | `rclone sync <local_path> <remote>:<bucket>/<path> [--dry-run]` |
| SYNC_PULL | `rclone sync <remote>:<bucket>/<path> <local_path> [--dry-run]` |
| COPY_PULL | `rclone copy <remote>:<bucket>/<path> <local_path> [--dry-run]` |

### Path Construction

```
Local Path:  <RemoteConfig.LocalPath>/<FolderConfig.LocalPath>
Remote Path: <RemoteConfig.RemoteName>:<RemoteConfig.BucketName>/<FolderConfig.RemotePath>
```

---

## Configuration Flow

### Application Startup

```
1. main.go initializes ConfigManager
2. Creates Wails app with services bound to ConfigManager
3. Frontend mounts, GlobalConfigContextProvider initializes
4. ConfigService.LoadGlobalConfig() called:
   a. Load/create ~/.config/rclone-selective-sync/config.json
   b. Extract credentials from RemoteConfigs
   c. Run "rclone config file" to get rclone.conf path
   d. Write credentials to rclone.conf
   e. Return GlobalConfig to frontend
5. User selects project (or uses last selected)
6. ConfigService.LoadSelectedProjectConfig() called:
   a. Check for <project_root>/sync.json locally
   b. If missing, attempt rclone copyto from remote
   c. If remote missing, create blank config
   d. Return ProjectConfig to frontend
```

### Config Synchronization

When project config changes (register/edit/deregister):
1. Write sync.json to local disk
2. Push to remote: `rclone copyto <local>/sync.json <remote>:<bucket>/sync.json`

---

## Platform-Specific Behavior

### Command Execution

**Windows** (`exec_windows.go`):
- Hides console windows using `CREATE_NO_WINDOW` flag
- Prevents black cmd windows from flashing

**macOS/Linux** (`exec_other.go`):
- Standard command execution
- No special handling needed

### File Explorer

| Platform | Command |
|----------|---------|
| Windows | `explorer.exe <path>` |
| macOS | `open <path>` |
| Linux | `xdg-open <path>` |

---

## Build System

**Task Runner**: Taskfile.yml

```bash
task dev      # Development with hot reload
task build    # Build production binary
task package  # Create installer/app bundle
```

**Version Management**:
- Version stored in `version.txt`
- Substituted into builds (NSIS for Windows, DMG for macOS)

---

## Known Limitations & Security Notes

### Current Security Concerns

1. **Plaintext Credentials**: API keys stored in plaintext in config.json
2. **Frontend Exposure**: Full GlobalConfig (including keys) loaded into frontend
3. **No Encryption**: Config files not encrypted at rest
4. **Rclone.conf**: Standard rclone permissions, readable by local user

### Functional Limitations

1. **Single User**: No multi-user or locking support
2. **Manual Rclone Setup**: Rclone must be installed separately
3. **B2 Focus**: Currently optimized for Backblaze B2 (other remotes untested)
4. **No Full-Project Sync**: Only individual folder sync supported
5. **Settings/Remotes Pages**: Currently stub implementations

---

## Wails Integration

### Service Binding

Services are bound to the Wails app in `main.go`:
```go
application.NewService(backend.NewConfigService(configManager))
application.NewService(backend.NewSyncService(configManager))
application.NewService(backend.NewFolderService(configManager))
```

### Frontend Bindings

Wails auto-generates TypeScript bindings in `frontend/bindings/`:
- Service methods become async functions
- Go structs become TypeScript interfaces
- Enables type-safe frontend-backend communication
