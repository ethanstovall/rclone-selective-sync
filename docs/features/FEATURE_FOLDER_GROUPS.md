# Feature: Folder Groups

## Overview

Organize folders into collapsible, hierarchical groups within each project. This replaces the current "Local" folder toggle with a unified view where all folders are always visible, organized by group, with sync status shown inline.

## Current State

- Folders displayed in a flat list
- "Local" toggle filters between all folders and locally-available folders
- No organizational hierarchy
- No visual distinction between synced/unsynced folders in the main view

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

### Phase 1: Data Model & Basic UI
- Add `groups` to ProjectConfig and `group` to FolderConfig
- Create GroupTreeView component with collapse/expand
- Show all folders with local/remote status inline
- Remove "Local" toggle (replaced by inline status indicators)
- Preserve "Select all changed" checkbox at top
- Preserve info box / detail panel on the side (no changes)
- Optionally add [Open] button inline in tree view

### Phase 2: Group Management
- Add group selector to New Folder dialog
- Implement CreateGroup functionality
- Add "Create new group" option in dropdown

### Phase 3: Polish
- Right-click context menu for group operations
- Keyboard navigation in tree view
- Persist collapse state in localStorage

### Phase 4: Future Enhancements
- Drag-and-drop reordering
- Custom group colors/icons
- Bulk operations on groups (sync all, download all)

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
