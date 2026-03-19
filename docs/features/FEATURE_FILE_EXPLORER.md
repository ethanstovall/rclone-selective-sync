# Feature: In-App File Explorer

## Status: Proposed

## Summary

Implement an integrated file explorer within the application that allows users to browse, select, and interact with project files directly. This serves as a foundation for future features like multi-user locking and provides a controlled interface for file operations.

---

## Motivation

### Current Limitations
- Users must manually type folder paths when registering folders
- No visibility into folder contents without leaving the app
- "Open in Explorer" opens external file manager, losing app context
- No way to control which files users can modify (needed for locking feature)

### Benefits
- **Better UX**: Visual folder selection instead of typing paths
- **Controlled Access**: Foundation for lock enforcement
- **File Operations**: Open files with correct applications
- **Context Preservation**: Browse files without leaving the app

---

## Requirements

### Core Requirements
- [ ] Tree-based folder navigation within project root
- [ ] File listing with metadata (name, size, modified date, type)
- [ ] Visual file type identification (icons by extension)
- [ ] Folder selection for registration workflow
- [ ] File opening with system-associated applications

### File Opening Requirements
- [ ] Open files with OS-default application
- [ ] Support custom application overrides per file type
- [ ] Inherit system file associations where possible
- [ ] Handle "no associated application" gracefully

### Navigation Requirements
- [ ] Breadcrumb navigation
- [ ] Back/forward history
- [ ] Keyboard navigation (arrows, enter, backspace)
- [ ] Search/filter within current directory

### Integration Requirements
- [ ] Use in "Register New Folder" dialog as folder picker
- [ ] Use in folder details panel for content preview
- [ ] Extensible for future lock status display

---

## Technical Implementation

### Backend: FileExplorerService

```go
// backend/fileexplorerservice.go

type FileExplorerService struct {
    configManager *ConfigManager
}

type FileEntry struct {
    Name         string    `json:"name"`
    Path         string    `json:"path"`          // Relative to project root
    FullPath     string    `json:"full_path"`     // Absolute path
    IsDirectory  bool      `json:"is_directory"`
    Size         int64     `json:"size"`          // Bytes, 0 for directories
    ModifiedAt   time.Time `json:"modified_at"`
    Extension    string    `json:"extension"`     // Lowercase, e.g., ".blend"
    IsHidden     bool      `json:"is_hidden"`     // Starts with . or hidden attribute
}

type DirectoryContents struct {
    Path        string      `json:"path"`         // Current directory path
    ParentPath  string      `json:"parent_path"`  // Parent directory, empty if at root
    Entries     []FileEntry `json:"entries"`
    TotalSize   int64       `json:"total_size"`   // Sum of all file sizes
    FileCount   int         `json:"file_count"`
    FolderCount int         `json:"folder_count"`
}

// List contents of a directory
func (fes *FileExplorerService) ListDirectory(relativePath string) (DirectoryContents, error) {
    projectRoot := fes.getProjectRoot()
    fullPath := filepath.Join(projectRoot, relativePath)

    // Security: Ensure path is within project root
    if !strings.HasPrefix(fullPath, projectRoot) {
        return DirectoryContents{}, fmt.Errorf("path outside project root")
    }

    entries, err := os.ReadDir(fullPath)
    if err != nil {
        return DirectoryContents{}, err
    }

    contents := DirectoryContents{
        Path:       relativePath,
        ParentPath: filepath.Dir(relativePath),
        Entries:    make([]FileEntry, 0, len(entries)),
    }

    if relativePath == "" || relativePath == "." {
        contents.ParentPath = ""
    }

    for _, entry := range entries {
        info, err := entry.Info()
        if err != nil {
            continue
        }

        fileEntry := FileEntry{
            Name:        entry.Name(),
            Path:        filepath.Join(relativePath, entry.Name()),
            FullPath:    filepath.Join(fullPath, entry.Name()),
            IsDirectory: entry.IsDir(),
            Size:        info.Size(),
            ModifiedAt:  info.ModTime(),
            Extension:   strings.ToLower(filepath.Ext(entry.Name())),
            IsHidden:    isHidden(entry.Name(), info),
        }

        contents.Entries = append(contents.Entries, fileEntry)

        if entry.IsDir() {
            contents.FolderCount++
        } else {
            contents.FileCount++
            contents.TotalSize += info.Size()
        }
    }

    // Sort: directories first, then by name
    sort.Slice(contents.Entries, func(i, j int) bool {
        if contents.Entries[i].IsDirectory != contents.Entries[j].IsDirectory {
            return contents.Entries[i].IsDirectory
        }
        return strings.ToLower(contents.Entries[i].Name) < strings.ToLower(contents.Entries[j].Name)
    })

    return contents, nil
}

// Open file with system default application
func (fes *FileExplorerService) OpenFile(relativePath string) error {
    projectRoot := fes.getProjectRoot()
    fullPath := filepath.Join(projectRoot, relativePath)

    // Security check
    if !strings.HasPrefix(fullPath, projectRoot) {
        return fmt.Errorf("path outside project root")
    }

    return fes.openWithSystemDefault(fullPath)
}

// Platform-specific file opening
func (fes *FileExplorerService) openWithSystemDefault(path string) error {
    var cmd *exec.Cmd
    switch runtime.GOOS {
    case "darwin":
        cmd = exec.Command("open", path)
    case "windows":
        cmd = exec.Command("cmd", "/c", "start", "", path)
    default: // Linux
        cmd = exec.Command("xdg-open", path)
    }
    return cmd.Start()
}

// Open file with specific application
func (fes *FileExplorerService) OpenFileWith(relativePath, appPath string) error {
    projectRoot := fes.getProjectRoot()
    fullPath := filepath.Join(projectRoot, relativePath)

    if !strings.HasPrefix(fullPath, projectRoot) {
        return fmt.Errorf("path outside project root")
    }

    var cmd *exec.Cmd
    switch runtime.GOOS {
    case "darwin":
        cmd = exec.Command("open", "-a", appPath, fullPath)
    case "windows":
        cmd = exec.Command(appPath, fullPath)
    default:
        cmd = exec.Command(appPath, fullPath)
    }
    return cmd.Start()
}

// Get file type associations from OS (best effort)
func (fes *FileExplorerService) GetSystemFileAssociation(extension string) (string, error) {
    switch runtime.GOOS {
    case "darwin":
        // Use duti or Launch Services
        return fes.getMacAssociation(extension)
    case "windows":
        // Use registry query
        return fes.getWindowsAssociation(extension)
    default:
        // Use xdg-mime
        return fes.getLinuxAssociation(extension)
    }
}

func (fes *FileExplorerService) getMacAssociation(extension string) (string, error) {
    // Query Launch Services for default app
    // This is complex - may need to use cgo or external tool
    // For now, return empty and rely on "open" command
    return "", nil
}

func (fes *FileExplorerService) getWindowsAssociation(extension string) (string, error) {
    // Query: HKEY_CLASSES_ROOT\.ext -> (Default) -> shell\open\command
    cmd := exec.Command("cmd", "/c", "assoc", extension)
    output, err := cmd.Output()
    if err != nil {
        return "", err
    }
    // Parse output to get file type
    // Then query ftype for the command
    return strings.TrimSpace(string(output)), nil
}

func (fes *FileExplorerService) getLinuxAssociation(extension string) (string, error) {
    mimeType := mime.TypeByExtension(extension)
    if mimeType == "" {
        return "", fmt.Errorf("unknown extension")
    }
    cmd := exec.Command("xdg-mime", "query", "default", mimeType)
    output, err := cmd.Output()
    if err != nil {
        return "", err
    }
    return strings.TrimSpace(string(output)), nil
}

// Platform-specific hidden file detection
func isHidden(name string, info os.FileInfo) bool {
    if strings.HasPrefix(name, ".") {
        return true
    }
    // Windows: check hidden attribute
    // (would need syscall for Windows-specific implementation)
    return false
}
```

### Frontend Components

#### FileExplorer Main Component

```typescript
// components/FileExplorer/FileExplorer.tsx
import { useState, useEffect, useCallback } from 'react';
import { Box, Breadcrumbs, Link, IconButton, TextField, InputAdornment } from '@mui/material';
import { ArrowBack, ArrowForward, Search, Refresh } from '@mui/icons-material';
import { FileExplorerService } from '../../../bindings/...';
import FileList from './FileList';
import { DirectoryContents, FileEntry } from './types';

interface FileExplorerProps {
    initialPath?: string;
    onFolderSelect?: (path: string) => void;  // For folder picker mode
    onFileOpen?: (entry: FileEntry) => void;  // Custom file open handler
    selectionMode?: 'none' | 'single' | 'multiple';
    showHidden?: boolean;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
    initialPath = '',
    onFolderSelect,
    onFileOpen,
    selectionMode = 'none',
    showHidden = false,
}) => {
    const [currentPath, setCurrentPath] = useState(initialPath);
    const [contents, setContents] = useState<DirectoryContents | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [history, setHistory] = useState<string[]>([initialPath]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());

    // Load directory contents
    const loadDirectory = useCallback(async (path: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await FileExplorerService.ListDirectory(path);
            setContents(result);
        } catch (e: any) {
            setError(e.message || 'Failed to load directory');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDirectory(currentPath);
    }, [currentPath, loadDirectory]);

    // Navigation
    const navigateTo = (path: string, addToHistory = true) => {
        if (addToHistory) {
            const newHistory = history.slice(0, historyIndex + 1);
            newHistory.push(path);
            setHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
        }
        setCurrentPath(path);
        setSelectedEntries(new Set());
    };

    const goBack = () => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            setCurrentPath(history[historyIndex - 1]);
        }
    };

    const goForward = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
            setCurrentPath(history[historyIndex + 1]);
        }
    };

    // Entry actions
    const handleEntryDoubleClick = async (entry: FileEntry) => {
        if (entry.is_directory) {
            navigateTo(entry.path);
        } else {
            if (onFileOpen) {
                onFileOpen(entry);
            } else {
                await FileExplorerService.OpenFile(entry.path);
            }
        }
    };

    const handleEntrySelect = (entry: FileEntry) => {
        if (selectionMode === 'none') return;

        const newSelected = new Set(selectedEntries);
        if (selectionMode === 'single') {
            newSelected.clear();
            newSelected.add(entry.path);
        } else {
            if (newSelected.has(entry.path)) {
                newSelected.delete(entry.path);
            } else {
                newSelected.add(entry.path);
            }
        }
        setSelectedEntries(newSelected);

        // For folder picker mode
        if (onFolderSelect && entry.is_directory) {
            onFolderSelect(entry.path);
        }
    };

    // Filter entries
    const filteredEntries = contents?.entries.filter(entry => {
        if (!showHidden && entry.is_hidden) return false;
        if (searchTerm && !entry.name.toLowerCase().includes(searchTerm.toLowerCase())) {
            return false;
        }
        return true;
    }) ?? [];

    // Build breadcrumbs
    const pathParts = currentPath.split('/').filter(Boolean);
    const breadcrumbs = [
        { label: 'Project Root', path: '' },
        ...pathParts.map((part, index) => ({
            label: part,
            path: pathParts.slice(0, index + 1).join('/'),
        })),
    ];

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Toolbar */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderBottom: 1, borderColor: 'divider' }}>
                <IconButton onClick={goBack} disabled={historyIndex === 0}>
                    <ArrowBack />
                </IconButton>
                <IconButton onClick={goForward} disabled={historyIndex >= history.length - 1}>
                    <ArrowForward />
                </IconButton>
                <IconButton onClick={() => loadDirectory(currentPath)}>
                    <Refresh />
                </IconButton>

                <Breadcrumbs sx={{ flex: 1 }}>
                    {breadcrumbs.map((crumb, index) => (
                        <Link
                            key={crumb.path}
                            component="button"
                            variant="body2"
                            onClick={() => navigateTo(crumb.path)}
                            underline={index === breadcrumbs.length - 1 ? 'none' : 'hover'}
                            color={index === breadcrumbs.length - 1 ? 'text.primary' : 'inherit'}
                        >
                            {crumb.label}
                        </Link>
                    ))}
                </Breadcrumbs>

                <TextField
                    size="small"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Search fontSize="small" />
                            </InputAdornment>
                        ),
                    }}
                />
            </Box>

            {/* File list */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
                <FileList
                    entries={filteredEntries}
                    selectedPaths={selectedEntries}
                    onEntryClick={handleEntrySelect}
                    onEntryDoubleClick={handleEntryDoubleClick}
                    isLoading={isLoading}
                    error={error}
                />
            </Box>

            {/* Status bar */}
            {contents && (
                <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider', typography: 'caption' }}>
                    {contents.folder_count} folders, {contents.file_count} files
                    {contents.total_size > 0 && ` (${formatBytes(contents.total_size)})`}
                    {selectedEntries.size > 0 && ` • ${selectedEntries.size} selected`}
                </Box>
            )}
        </Box>
    );
};
```

#### FileList Component

```typescript
// components/FileExplorer/FileList.tsx
import { Table, TableBody, TableCell, TableHead, TableRow, Skeleton, Alert } from '@mui/material';
import FileRow from './FileRow';
import { FileEntry } from './types';

interface FileListProps {
    entries: FileEntry[];
    selectedPaths: Set<string>;
    onEntryClick: (entry: FileEntry) => void;
    onEntryDoubleClick: (entry: FileEntry) => void;
    isLoading: boolean;
    error: string | null;
}

const FileList: React.FC<FileListProps> = ({
    entries,
    selectedPaths,
    onEntryClick,
    onEntryDoubleClick,
    isLoading,
    error,
}) => {
    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    if (isLoading) {
        return (
            <Table size="small">
                <TableBody>
                    {[...Array(10)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton /></TableCell>
                            <TableCell><Skeleton width={60} /></TableCell>
                            <TableCell><Skeleton width={120} /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        );
    }

    return (
        <Table size="small" stickyHeader>
            <TableHead>
                <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell align="right">Size</TableCell>
                    <TableCell>Modified</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {entries.map(entry => (
                    <FileRow
                        key={entry.path}
                        entry={entry}
                        isSelected={selectedPaths.has(entry.path)}
                        onClick={() => onEntryClick(entry)}
                        onDoubleClick={() => onEntryDoubleClick(entry)}
                    />
                ))}
            </TableBody>
        </Table>
    );
};
```

#### FileRow Component with Type Icons

```typescript
// components/FileExplorer/FileRow.tsx
import { TableRow, TableCell, Box, Typography } from '@mui/material';
import {
    Folder,
    InsertDriveFile,
    Image,
    VideoFile,
    AudioFile,
    Description,
    Code,
    Archive,
    ViewInAr, // 3D files
} from '@mui/icons-material';
import { FileEntry } from './types';

const getFileIcon = (entry: FileEntry) => {
    if (entry.is_directory) return <Folder color="primary" />;

    const ext = entry.extension.toLowerCase();

    // Images
    if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.tiff'].includes(ext)) {
        return <Image color="success" />;
    }

    // Video
    if (['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'].includes(ext)) {
        return <VideoFile color="error" />;
    }

    // Audio
    if (['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'].includes(ext)) {
        return <AudioFile color="warning" />;
    }

    // 3D files
    if (['.blend', '.fbx', '.obj', '.gltf', '.glb', '.usd', '.abc', '.ma', '.mb'].includes(ext)) {
        return <ViewInAr color="secondary" />;
    }

    // Documents
    if (['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt'].includes(ext)) {
        return <Description />;
    }

    // Code
    if (['.js', '.ts', '.py', '.go', '.rs', '.cpp', '.c', '.h', '.json', '.yaml', '.yml', '.xml'].includes(ext)) {
        return <Code color="info" />;
    }

    // Archives
    if (['.zip', '.tar', '.gz', '.rar', '.7z'].includes(ext)) {
        return <Archive />;
    }

    return <InsertDriveFile />;
};

interface FileRowProps {
    entry: FileEntry;
    isSelected: boolean;
    onClick: () => void;
    onDoubleClick: () => void;
}

const FileRow: React.FC<FileRowProps> = ({ entry, isSelected, onClick, onDoubleClick }) => {
    return (
        <TableRow
            hover
            selected={isSelected}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            sx={{ cursor: 'pointer' }}
        >
            <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getFileIcon(entry)}
                    <Typography
                        variant="body2"
                        sx={{
                            color: entry.is_hidden ? 'text.disabled' : 'text.primary',
                        }}
                    >
                        {entry.name}
                    </Typography>
                </Box>
            </TableCell>
            <TableCell align="right">
                {entry.is_directory ? '-' : formatBytes(entry.size)}
            </TableCell>
            <TableCell>
                {formatDate(entry.modified_at)}
            </TableCell>
        </TableRow>
    );
};

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDate = (date: string): string => {
    return new Date(date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};
```

---

## File Type Associations

### Inheriting from OS

The primary approach is to use OS commands that respect system file associations:

| Platform | Command | Behavior |
|----------|---------|----------|
| macOS | `open <file>` | Uses Launch Services to find default app |
| Windows | `start "" <file>` | Uses shell association |
| Linux | `xdg-open <file>` | Uses MIME type associations |

### Custom Application Overrides

For VFX workflows, users may want specific applications per file type:

```go
type FileTypeAssociation struct {
    Extension   string `json:"extension"`    // e.g., ".blend"
    AppPath     string `json:"app_path"`     // e.g., "/Applications/Blender.app"
    AppName     string `json:"app_name"`     // Display name
    UseDefault  bool   `json:"use_default"`  // Use OS default instead
}

type FileAssociationSettings struct {
    Associations map[string]FileTypeAssociation `json:"associations"`
}
```

### Settings UI

```typescript
// In Preferences page
const FileAssociationEditor: React.FC = () => {
    const [associations, setAssociations] = useState<FileTypeAssociation[]>([]);

    return (
        <Box>
            <Typography variant="h6">File Type Associations</Typography>
            <Typography variant="body2" color="text.secondary">
                Override which applications open specific file types.
                Leave empty to use system defaults.
            </Typography>

            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>Extension</TableCell>
                        <TableCell>Application</TableCell>
                        <TableCell>Actions</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {associations.map(assoc => (
                        <TableRow key={assoc.extension}>
                            <TableCell>{assoc.extension}</TableCell>
                            <TableCell>
                                {assoc.use_default ? 'System Default' : assoc.app_name}
                            </TableCell>
                            <TableCell>
                                <IconButton onClick={() => editAssociation(assoc)}>
                                    <Edit />
                                </IconButton>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <Button startIcon={<Add />} onClick={addAssociation}>
                Add Override
            </Button>
        </Box>
    );
};
```

---

## Integration Points

### Folder Picker for Registration

Replace the current text input with an embedded file explorer:

```typescript
// Modified NewFolderDialog.tsx
const NewFolderDialog: React.FC<NewFolderDialogProps> = ({ isOpen, setIsOpen }) => {
    const [selectedPath, setSelectedPath] = useState('');
    const [showExplorer, setShowExplorer] = useState(false);

    return (
        <StandardDialog ...>
            <TextField
                label="Folder Name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
            />

            <TextField
                label="Local Path"
                value={selectedPath || localRoot}
                InputProps={{
                    readOnly: true,
                    endAdornment: (
                        <InputAdornment position="end">
                            <Button onClick={() => setShowExplorer(true)}>
                                Browse...
                            </Button>
                        </InputAdornment>
                    ),
                }}
            />

            {showExplorer && (
                <Box sx={{ height: 300, border: 1, borderColor: 'divider', mt: 1 }}>
                    <FileExplorer
                        selectionMode="single"
                        onFolderSelect={(path) => {
                            setSelectedPath(path);
                            setShowExplorer(false);
                        }}
                    />
                </Box>
            )}

            <TextField
                label="Description"
                multiline
                rows={3}
            />
        </StandardDialog>
    );
};
```

### Folder Content Preview

Add a collapsible file explorer in the folder details panel:

```typescript
// In FocusedFolderControls.tsx
const FocusedFolderControls: React.FC = () => {
    const [showContents, setShowContents] = useState(false);

    return (
        <Box>
            {/* Existing folder details */}
            <FolderDescription ... />

            <Button
                onClick={() => setShowContents(!showContents)}
                endIcon={showContents ? <ExpandLess /> : <ExpandMore />}
            >
                {showContents ? 'Hide Contents' : 'Show Contents'}
            </Button>

            <Collapse in={showContents}>
                <Box sx={{ height: 300, mt: 1 }}>
                    <FileExplorer
                        initialPath={focusedFolder?.local_path}
                        selectionMode="none"
                    />
                </Box>
            </Collapse>

            {/* Existing action buttons */}
        </Box>
    );
};
```

---

## Future Extensions

### Lock Status Integration

When the locking feature is implemented, the file explorer will display lock status:

```typescript
// Extended FileRow with lock status
const FileRowWithLock: React.FC<FileRowProps & { lockStatus?: Lock }> = ({
    entry,
    lockStatus,
    ...props
}) => {
    return (
        <TableRow ...>
            <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getFileIcon(entry)}
                    <Typography>{entry.name}</Typography>
                    {lockStatus && <LockStatusBadge lock={lockStatus} />}
                </Box>
            </TableCell>
            ...
        </TableRow>
    );
};
```

### Drag-and-Drop Support

Future enhancement for moving files:

```typescript
// Drag handlers for file explorer
const handleDragStart = (e: DragEvent, entry: FileEntry) => {
    e.dataTransfer.setData('application/json', JSON.stringify(entry));
};

const handleDrop = async (e: DragEvent, targetPath: string) => {
    const entry = JSON.parse(e.dataTransfer.getData('application/json'));
    await FileExplorerService.MoveEntry(entry.path, targetPath);
};
```

---

## Implementation Tasks

### Phase 1: Core Explorer
1. [ ] Create `FileExplorerService` in Go backend
2. [ ] Implement `ListDirectory` method
3. [ ] Implement `OpenFile` with system default
4. [ ] Add service binding to main.go
5. [ ] Generate TypeScript bindings

### Phase 2: UI Components
1. [ ] Create `FileExplorer` main component
2. [ ] Create `FileList` component
3. [ ] Create `FileRow` component with icons
4. [ ] Implement breadcrumb navigation
5. [ ] Implement search/filter

### Phase 3: Integration
1. [ ] Update `NewFolderDialog` with folder picker
2. [ ] Add content preview to `FocusedFolderControls`
3. [ ] Test with various project structures

### Phase 4: File Associations
1. [ ] Research platform-specific association queries
2. [ ] Implement custom association settings
3. [ ] Add association editor to Preferences page
4. [ ] Implement `OpenFileWith` for custom apps

### Phase 5: Polish
1. [ ] Keyboard navigation support
2. [ ] Context menu (right-click)
3. [ ] Performance optimization for large directories
4. [ ] Thumbnail previews (optional)

---

## Testing Considerations

- Test with deeply nested folder structures
- Test with many files (1000+) in a single directory
- Test hidden file handling across platforms
- Test file opening with various file types
- Test breadcrumb navigation edge cases
- Test search with special characters
