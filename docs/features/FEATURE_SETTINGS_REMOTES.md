# Feature: Settings & Remotes Page Enhancement

## Status: Proposed

## Summary

Flesh out the currently stub Preferences and Manage Remotes pages to allow users to configure application settings and manage rclone remotes directly within the app, including adding new remotes without manually editing config files.

---

## Current State

### Preferences Page (`frontend/src/pages/Preferences.tsx`)
- Stub implementation displaying only "This is the preferences page"
- No actual settings or controls

### Manage Remotes Page (`frontend/src/pages/ManageRemotes.tsx`)
- Stub implementation displaying only "This is the Manage Remotes page"
- Wrapped in `GlobalConfigContextProvider` but unused
- No backend CRUD operations for remotes exist

---

## Requirements

### Preferences Page

#### App Settings
- [ ] Dark/light mode toggle (theme infrastructure exists in App.tsx)
- [ ] Default view preference (show local vs remote folders first)
- [ ] Confirmation dialog preferences (skip dry-run review, auto-confirm, etc.)

#### Sync Settings
- [ ] Default rclone flags (bandwidth limit, transfers, etc.)
- [ ] Auto-detect changes on folder selection
- [ ] Sync.json auto-refresh interval (pull from remote periodically)

#### Path Settings
- [ ] Custom config directory location
- [ ] Rclone binary path override (if not in PATH)

### Manage Remotes Page

#### Remote List View
- [ ] Display all configured remotes with summary info
- [ ] Show connection status / last sync time
- [ ] Edit / Delete actions per remote

#### Add New Remote Wizard
- [ ] Remote type selection (B2, S3, Google Drive, Dropbox, etc.)
- [ ] Dynamic form fields based on remote type (rclone has different fields per provider)
- [ ] Bucket/container selection (list from provider after auth)
- [ ] Local path picker for project root
- [ ] Backup path configuration
- [ ] Connection test before saving

#### Edit Existing Remote
- [ ] Pre-populated form with current values
- [ ] Credential update (re-authenticate)
- [ ] Path changes with migration warning

#### Delete Remote
- [ ] Confirmation dialog with impact summary
- [ ] Option to keep or delete local config files

---

## Technical Implementation

### Backend Changes

#### New ConfigService Methods
```go
// Remote CRUD operations
func (cs *ConfigService) AddRemote(projectKey string, config RemoteConfig) error
func (cs *ConfigService) UpdateRemote(projectKey string, config RemoteConfig) error
func (cs *ConfigService) DeleteRemote(projectKey string) error
func (cs *ConfigService) TestRemoteConnection(config RemoteConfig) (bool, error)

// Settings operations
func (cs *ConfigService) GetAppSettings() (AppSettings, error)
func (cs *ConfigService) UpdateAppSettings(settings AppSettings) error
```

#### New Data Models
```go
type AppSettings struct {
    Theme              string            `json:"theme"`               // "light", "dark", "system"
    DefaultView        string            `json:"default_view"`        // "local", "remote"
    SkipDryRunReview   bool              `json:"skip_dry_run_review"`
    RcloneFlags        map[string]string `json:"rclone_flags"`
    AutoDetectChanges  bool              `json:"auto_detect_changes"`
    SyncRefreshMinutes int               `json:"sync_refresh_minutes"`
    RclonePath         string            `json:"rclone_path"`
}
```

#### Remote Type Registry
Create a registry of supported remote types with their required fields:
```go
type RemoteTypeSpec struct {
    Type        string
    DisplayName string
    Fields      []RemoteField
}

type RemoteField struct {
    Name        string
    Label       string
    Type        string // "text", "password", "select"
    Required    bool
    Options     []string // for select type
}

// Example: B2 requires account, key
// S3 requires access_key_id, secret_access_key, region, endpoint
```

#### Connection Testing
```go
func (cs *ConfigService) TestRemoteConnection(config RemoteConfig) (bool, error) {
    // Write temporary rclone config
    // Run: rclone lsd <remote>:<bucket> --max-depth 0
    // Return success/failure
}
```

### Frontend Changes

#### Preferences Page Components
- `PreferencesForm` - Main settings form with sections
- `ThemeToggle` - Dark/light/system selector
- `RcloneFlagsEditor` - Key-value editor for rclone flags
- `PathPicker` - Directory selection with browse button

#### Manage Remotes Page Components
- `RemoteList` - Card/list view of all remotes
- `RemoteCard` - Individual remote summary with actions
- `AddRemoteWizard` - Multi-step form for new remotes
- `EditRemoteDialog` - Modal for editing existing remote
- `DeleteRemoteConfirm` - Confirmation dialog with impact info
- `ConnectionTestButton` - Test connection with loading state

#### New Hooks
```typescript
// hooks/AppSettingsContext.tsx
interface AppSettingsContextProps {
    settings: AppSettings | undefined;
    isLoading: boolean;
    updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
}
```

### Rclone Integration

To support multiple remote types, need to:
1. Query rclone for supported backends: `rclone listremotes --long`
2. Get required fields per backend: `rclone config providers` (outputs JSON)
3. Generate dynamic forms based on provider spec

---

## UI Mockups

### Preferences Page Layout
```
┌─────────────────────────────────────────────────────────┐
│ Preferences                                              │
├─────────────────────────────────────────────────────────┤
│ Appearance                                               │
│ ├─ Theme: [Light ▼]                                     │
│ └─ Default folder view: [Local folders ▼]              │
│                                                          │
│ Sync Behavior                                            │
│ ├─ ☐ Skip dry-run review                                │
│ ├─ ☑ Auto-detect changes on selection                   │
│ └─ Refresh sync.json every [15] minutes                 │
│                                                          │
│ Rclone Settings                                          │
│ ├─ Binary path: [/usr/local/bin/rclone] [Browse]        │
│ └─ Default flags:                                        │
│    ├─ --transfers: [4]                                   │
│    └─ --bwlimit: [0]                                     │
│                                                          │
│                              [Cancel] [Save]             │
└─────────────────────────────────────────────────────────┘
```

### Manage Remotes Page Layout
```
┌─────────────────────────────────────────────────────────┐
│ Manage Remotes                        [+ Add Remote]     │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🪣 MyVFXProject                                      │ │
│ │ Type: Backblaze B2 | Bucket: vfx-project-bucket     │ │
│ │ Local: /Users/me/Projects/VFX                       │ │
│ │ Last sync: 2 hours ago | Status: ● Connected        │ │
│ │                                    [Edit] [Delete]  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🪣 ArchiveProject                                    │ │
│ │ Type: Amazon S3 | Bucket: archive-2024              │ │
│ │ Local: /Users/me/Projects/Archive                   │ │
│ │ Last sync: 3 days ago | Status: ● Connected         │ │
│ │                                    [Edit] [Delete]  │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Add Remote Wizard
```
Step 1: Select Provider
┌─────────────────────────────────────────────────────────┐
│ Choose your cloud storage provider:                      │
│                                                          │
│ [Backblaze B2]  [Amazon S3]  [Google Drive]             │
│ [Dropbox]       [OneDrive]   [Other...]                 │
│                                                          │
│                                           [Next →]       │
└─────────────────────────────────────────────────────────┘

Step 2: Credentials
┌─────────────────────────────────────────────────────────┐
│ Backblaze B2 Configuration                               │
│                                                          │
│ Project Name:     [________________]                    │
│ Account ID:       [________________]                    │
│ Application Key:  [________________]                    │
│                                                          │
│                          [Test Connection]               │
│                                                          │
│                              [← Back] [Next →]          │
└─────────────────────────────────────────────────────────┘

Step 3: Paths
┌─────────────────────────────────────────────────────────┐
│ Configure Paths                                          │
│                                                          │
│ Bucket:           [my-bucket ▼] (fetched from provider) │
│ Local Project:    [/path/to/project______] [Browse]     │
│ Backup Location:  [/path/to/backup_______] [Browse]     │
│                                                          │
│                              [← Back] [Finish]          │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Tasks

### Phase 1: Preferences Page (Basic)
1. [ ] Create `AppSettings` model and persistence in backend
2. [ ] Add `GetAppSettings` / `UpdateAppSettings` to ConfigService
3. [ ] Create `AppSettingsContext` hook
4. [ ] Build `PreferencesForm` component with theme toggle
5. [ ] Wire up theme switching in App.tsx

### Phase 2: Manage Remotes - Read/List
1. [ ] Create `RemoteList` component
2. [ ] Create `RemoteCard` component with status display
3. [ ] Wire up to existing GlobalConfig remotes data

### Phase 3: Manage Remotes - Add
1. [ ] Create remote type registry (B2, S3 initially)
2. [ ] Add `AddRemote` method to ConfigService
3. [ ] Add `TestRemoteConnection` method
4. [ ] Create `AddRemoteWizard` component
5. [ ] Implement dynamic form generation based on provider

### Phase 4: Manage Remotes - Edit/Delete
1. [ ] Add `UpdateRemote` / `DeleteRemote` to ConfigService
2. [ ] Create `EditRemoteDialog` component
3. [ ] Create `DeleteRemoteConfirm` dialog
4. [ ] Handle rclone.conf updates on remote changes

### Phase 5: Advanced Preferences
1. [ ] Add rclone flags editor
2. [ ] Add sync behavior settings
3. [ ] Add path configuration options

---

## Testing Considerations

- Test remote connection with invalid credentials
- Test adding duplicate remote names
- Test deleting remote that is currently selected
- Test theme persistence across app restarts
- Test rclone.conf regeneration after remote changes

---

## Dependencies

- Native file/folder picker dialog (Wails provides this)
- Rclone provider metadata (`rclone config providers`)
- Potential: keyring/keychain integration for secure credential storage (see FEATURE_SECURE_CREDENTIALS.md)
