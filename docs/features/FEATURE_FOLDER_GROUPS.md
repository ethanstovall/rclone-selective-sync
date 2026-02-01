# Feature: Folder Groups

## Status: ✅ IMPLEMENTED (v0.2.0)

## Overview

Organize folders into collapsible, hierarchical groups within each project. This replaces the previous "Local" folder toggle with a unified view where all folders are always visible, organized by group, with sync status shown inline.

**Implementation completed in v0.2.0** - See commits `d57384e`, `cff9e55`, `55f4fdb`.

## ~~Current~~ Previous State

- Folders ~~displayed~~ were displayed in a flat list
- "Local" toggle ~~filters~~ filtered between all folders and locally-available folders
- ~~No~~ Previously no organizational hierarchy
- ~~No~~ Previously no visual distinction between synced/unsynced folders in the main view

## Proposed Changes

### Data Model

Add a `groups` map to `ProjectConfig` and a `group` field to `FolderConfig`:

```go
// ProjectConfig (sync.json)
type ProjectConfig struct {
    Folders map[string]FolderConfig `json:"folders"`
    Groups  map[string]GroupConfig  `json:"groups"`  // NEW
}

// GroupConfig defines a folder group
type GroupConfig struct {
    Name        string `json:"name"`         // Display name
    ParentGroup string `json:"parent_group"` // Empty = top-level, otherwise = nested under parent
    SortOrder   int    `json:"sort_order"`   // For manual ordering (future)
}

// FolderConfig (updated)
type FolderConfig struct {
    LocalPath   string `json:"local_path"`
    RemotePath  string `json:"remote_path"`
    Description string `json:"description"`
    Group       string `json:"group"`        // NEW - group key (required, cannot be empty)
}
```

Example `sync.json`:
```json
{
  "groups": {
    "vfx": {
      "name": "VFX",
      "parent_group": "",
      "sort_order": 0
    },
    "vfx-comp": {
      "name": "Compositing",
      "parent_group": "vfx",
      "sort_order": 0
    },
    "audio": {
      "name": "Audio",
      "parent_group": "",
      "sort_order": 1
    }
  },
  "folders": {
    "hero-shots": {
      "local_path": "vfx/comp/hero",
      "remote_path": "vfx/comp/hero",
      "description": "Hero compositing shots",
      "group": "vfx-comp"
    },
    "sfx": {
      "local_path": "audio/sfx",
      "remote_path": "audio/sfx",
      "description": "Sound effects",
      "group": "audio"
    }
  }
}
```

### UI Changes

#### Main Folder List View

Replace the current flat list + "Local" toggle with a grouped tree view:

```
☑ Select all changed                     [Sync Selected]
─────────────────────────────────────────────────────────
▼ VFX
  ▼ Compositing
    ☑ Hero Shots          ● Changed      [Open]
    ☐ Background Plates   ○ Not local    [Download]
  ► 3D Renders (2 folders)

▼ Audio
    ☑ Sound Effects       ● Changed      [Open]
    ☐ Music Stems         ✓ Synced       [Open]

▼ General
    ☐ Project Notes       ✓ Synced       [Open]
```

**Preserved UI elements:**
- **"Select all changed" checkbox** - Global toggle at top, selects all folders with pending changes
- **Info box / detail panel** - Remains on the side, shows details for selected folder (no changes)
- **[Open] button** - Can be shown inline in tree view for quick access (optional UX improvement)

**Note:** All folders must belong to a group. No "Ungrouped" category.

Visual states:
- **● Changed** - Folder has pending changes (eligible for "select all changed")
- **✓ Synced** - Folder is up-to-date
- **○ Not local** - Folder not downloaded (greyed out, with download button)
- **► Collapsed** - Shows folder count
- **▼ Expanded** - Shows all folders

#### New Folder Dialog

Update to include group selection:

```
┌─ Register New Folder ────────────────────────┐
│                                              │
│  Folder Name: [___________________________]  │
│                                              │
│  Local Path:  [_______________] [Browse...]  │
│                                              │
│  Group:       [▼ Select or create group   ]  │
│               ┌─────────────────────────┐    │
│               │ VFX                     │    │
│               │   └─ Compositing        │    │
│               │   └─ 3D Renders         │    │
│               │ Audio                   │    │
│               │ ─────────────────────── │    │
│               │ + Create new group...   │    │
│               └─────────────────────────┘    │
│                                              │
│  Description: [___________________________]  │
│               [___________________________]  │
│                                              │
│                      [Cancel]  [Register]    │
└──────────────────────────────────────────────┘
```

#### Group Management

Options for managing groups:
1. **Inline in folder dialog** - Create new group via dropdown
2. **Right-click context menu** - Rename group, Delete group (moves folders to ungrouped)
3. **Drag-and-drop** (future) - Move folders between groups

### Backend Changes

#### New GroupService (or extend FolderService)

```go
// Create a new group
func (gs *GroupService) CreateGroup(groupKey string, config GroupConfig) (ProjectConfig, error)

// Update group properties
func (gs *GroupService) UpdateGroup(groupKey string, config GroupConfig) (ProjectConfig, error)

// Delete a group (moves all folders to ungrouped)
func (gs *GroupService) DeleteGroup(groupKey string) (ProjectConfig, error)

// Get hierarchical group structure for UI
func (gs *GroupService) GetGroupTree() ([]GroupTreeNode, error)
```

#### Update FolderService

```go
// RegisterNewFolder - add group parameter
func (fs *FolderService) RegisterNewFolder(name string, config FolderConfig) (ProjectConfig, error)
// FolderConfig now includes Group field

// MoveToGroup - change folder's group
func (fs *FolderService) MoveToGroup(folderName string, groupKey string) (ProjectConfig, error)
```

### Frontend Changes

#### New Components

1. **GroupTreeView** - Recursive tree component for displaying groups/folders
2. **GroupSelector** - Dropdown with hierarchical group display + create option
3. **CreateGroupDialog** - Simple dialog for creating a new group

#### State Management

Update `ProjectConfigContext` to provide:
- Grouped folder structure for rendering
- Helper to check if folder is local
- Group CRUD operations

### Migration

Existing `sync.json` files without groups:
- On first load, auto-create a "General" group (or similar default name)
- All existing folders assigned to this default group
- User can rename/reorganize afterward

**Important:** All folders must belong to a group. The New Folder dialog requires group selection (no "None" option).

## Implementation Phases

### Phase 1: Data Model & Basic UI ✅ COMPLETED
- [x] Add `groups` to ProjectConfig and `group` to FolderConfig
- [x] Create GroupedFolderTree component with collapse/expand
- [x] Show all folders with local/remote status inline
- [x] Remove "Local" toggle (replaced by inline status indicators)
- [x] Preserve "Select all changed" checkbox at top
- [x] Preserve info box / detail panel on the side (no changes)
- [x] Optionally add [Open] button inline in tree view

### Phase 2: Group Management ✅ COMPLETED
- [x] Add group selector to New Folder dialog
- [x] Implement CreateGroup functionality
- [x] Add "Create new group" option in dropdown
- [x] Implement UpdateGroup functionality
- [x] Implement DeleteGroup functionality
- [x] Implement RenameGroup functionality
- [x] Create ManageGroupsDialog for group CRUD operations

### Phase 3: Polish 🚧 IN PROGRESS
- [ ] Right-click context menu for group operations
- [ ] Keyboard navigation in tree view
- [ ] Persist collapse state in localStorage
- [x] Migration for existing sync.json files without groups

### Phase 4: Future Enhancements 📋 PLANNED
- [ ] Drag-and-drop reordering
- [ ] Custom group colors/icons
- [ ] Bulk operations on groups (sync all, download all)

## Edge Cases

1. **Deleting a group with folders** - Block deletion until folders are moved to another group (or prompt user to select destination group)
2. **Deleting a parent group with subgroups** - Move subgroups to top-level, then apply rule #1 for folders
3. **Circular parent references** - Validate on save, reject if circular
4. **Empty groups** - Show in UI (user may want placeholder groups)
5. **Very deep nesting** - UI should handle gracefully (indent limit?)
6. **New folder without groups existing** - Prompt to create first group before folder can be registered
7. **Last group deletion** - Block if it's the only group and contains folders

## Testing Considerations

- Migration of existing sync.json without groups
- Deep nesting performance
- Group tree rendering with many folders
- Concurrent group edits (multi-user scenario)

---

## Actual Implementation (v0.2.0)

### Backend Implementation

#### Data Models

**File:** [backend/projectconfig.go](../../backend/projectconfig.go)

```go
type ProjectConfig struct {
    AllowGlobalSync bool                    `json:"allow_global_sync"`
    Folders         map[string]FolderConfig `json:"folders"`
    Groups          map[string]GroupConfig  `json:"groups"` // NEW
}

type GroupConfig struct {
    Name        string `json:"name"`
    ParentGroup string `json:"parent_group"`
    SortOrder   int    `json:"sort_order"`
}

type FolderConfig struct {
    RemotePath  string `json:"remote_path"`
    LocalPath   string `json:"local_path"`
    Description string `json:"description"`
    Group       string `json:"group"` // NEW - Required for new folders
}
```

#### Migration Support

Automatic migration implemented in `ProjectConfig.MigrateToGroups()`:
- Detects old sync.json files without groups
- Creates default "General" group
- Assigns all ungrouped folders to "General"
- Called automatically on project config load

#### FolderService Group Operations

**File:** [backend/folderservice.go](../../backend/folderservice.go)

Implemented methods:
- `CreateGroup(groupKey, config)` - Create new group
- `UpdateGroup(groupKey, config)` - Update group properties
- `DeleteGroup(groupKey)` - Delete group (fails if contains folders or has children)
- `RenameGroup(oldKey, newKey, newName)` - Rename group while preserving folder assignments
- `GetGroups()` - Retrieve all groups

All operations automatically sync to remote via `syncConfigToRemote()`.

### Frontend Implementation

#### Components Created

1. **GroupedFolderTree.tsx** ([frontend/src/components/SyncFolders/GroupedFolderTree.tsx](../../frontend/src/components/SyncFolders/GroupedFolderTree.tsx))
   - Recursive tree rendering with collapse/expand
   - Groups folders by parent-child hierarchy
   - Separates "Local Folders" and "Non-Local Folders" sections
   - Shows sync status inline (synced ✓, changed ●, not local ○)
   - Integrated checkbox selection for sync operations

2. **ManageGroupsDialog.tsx** ([frontend/src/components/SyncFolders/ManageGroupsDialog.tsx](../../frontend/src/components/SyncFolders/ManageGroupsDialog.tsx))
   - Full CRUD interface for group management
   - Create, rename, and delete groups
   - Prevents deletion of groups with folders
   - Hierarchical group display

3. **NewFolderDialog.tsx** (Updated)
   - Added group selector dropdown
   - Required field - cannot register folder without group
   - Shows hierarchical group structure

#### UI Changes

**ProjectDashboard Changes:**
- Removed "Local" toggle switch
- Added "Manage Groups" button
- Integrated GroupedFolderTree component
- Preserved "Select all changed" functionality
- Maintained folder detail panel

**Visual Hierarchy:**
```
▼ Local Folders
  ▼ Group Name
    ☑ Folder 1  ✓ Synced
    ☑ Folder 2  ● Changed

▼ Non-Local Folders
  ► Group Name (3 folders)
```

### Key Implementation Decisions

1. **Group Requirement**: All folders must belong to a group (no "ungrouped" state for new folders)
2. **Automatic Migration**: Legacy configs auto-migrate to "General" group
3. **Location-Based Grouping**: Primary division by local/non-local, then by user-defined groups
4. **Remote Sync**: All group operations immediately sync to remote
5. **Deletion Safety**: Groups with folders or children cannot be deleted

### What's Still Pending

From Phase 3 (Polish):
- [ ] Right-click context menu for quick group operations
- [ ] Keyboard navigation within tree (arrow keys, expand/collapse)
- [ ] Persist collapse state in localStorage (currently resets on page load)

From Phase 4 (Future Enhancements):
- [ ] Drag-and-drop folder/group reordering
- [ ] Custom group colors or icons
- [ ] Bulk operations on entire groups (sync all in group, download all, etc.)

### Migration Notes

Existing users with sync.json files from v0.1.x:
- Files are automatically migrated on first load in v0.2.0
- All existing folders assigned to "General" group
- No manual intervention required
- Migration status logged in backend

### Related Commits

- `d57384e` - Add feature to group folders (initial data model)
- `cff9e55` - Implementation for folder groups (backend services + frontend components)
- `55f4fdb` - Group local and nonlocal together (UI refinement)
- `8ce3d59` - Remove open folder button; make text selectable and formatted
- `4515c5b` - Fix formatting, pre-create folders for download if necessary
- `db55d55` - Tweaks and improvements
