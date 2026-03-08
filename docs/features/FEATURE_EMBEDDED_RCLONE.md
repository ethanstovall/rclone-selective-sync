# Feature: Embedded Rclone via librclone

## Status: Proposed

## Summary

Replace the current `exec.Command("rclone", ...)` approach with rclone's official Go library (`librclone`). This embeds rclone directly into the application binary, eliminating the requirement for users to install rclone separately and giving us full control over the rclone version.

### Problem

The current approach has several pain points:

1. **Installation friction**: Users must install rclone separately before the app works. This is the biggest onboarding barrier.
2. **Version mismatches**: The app is tested against a specific rclone version, but users may have any version installed. Behavioral differences cause hard-to-debug issues.
3. **Output parsing**: `exec.Command` returns raw stdout/stderr strings that must be parsed. This is fragile and breaks when rclone changes output formatting.
4. **Platform quirks**: Windows requires `CREATE_NO_WINDOW` flags to prevent console flashing (`exec_windows.go`). Cross-platform exec behavior adds complexity.
5. **Error handling**: Command failures return error strings that must be string-matched rather than typed errors.

### Solution

Import `github.com/rclone/rclone/librclone/librclone` and call rclone operations via its in-process JSON RPC API. The rclone engine compiles directly into the app binary.

---

## Architecture

### librclone API

librclone exposes three functions:

```go
import "github.com/rclone/rclone/librclone/librclone"

librclone.Initialize()                          // Call once at startup
output, status := librclone.RPC(method, input)  // JSON in, JSON out
librclone.Finalize()                            // Call on shutdown
```

All rclone RC operations are available via `RPC()`. The `method` parameter maps to rclone's RC API endpoints. The `input` and `output` are JSON strings.

### RC API Mapping

Current exec commands map to RC endpoints:

| Current (exec) | RC Endpoint | Notes |
|----------------|-------------|-------|
| `rclone sync local remote` | `sync/sync` | `{"srcFs": "local", "dstFs": "remote"}` |
| `rclone sync remote local` | `sync/sync` | `{"srcFs": "remote", "dstFs": "local"}` |
| `rclone copy remote local` | `sync/copy` | `{"srcFs": "remote", "dstFs": "local"}` |
| `rclone bisync local remote` | `sync/bisync` | `{"path1": "local", "path2": "remote"}` |
| `rclone config file` | `config/paths` | Returns config file location |
| `rclone copyto remote local` | `operations/copyfile` | For single file operations |
| `rclone lsjson remote` | `operations/list` | Returns JSON natively (no parsing) |
| `--dry-run` flag | `"dryRun": true` | JSON parameter on any operation |

### Key Advantages of RC API

- **Structured responses**: JSON output with typed fields — no string parsing
- **Dry-run as parameter**: `"dryRun": true` in the JSON input, not a CLI flag
- **Progress callbacks**: RC API supports async operations with job IDs and progress polling
- **Native error types**: Status codes and structured error messages instead of stderr parsing
- **No platform exec quirks**: No `CREATE_NO_WINDOW`, no `CombinedOutput()` string handling

---

## Implementation Plan

### Phase 1: Add librclone dependency

```bash
go get github.com/rclone/rclone@v1.73.2
```

Add initialization to the app startup (in Wails lifecycle):

```go
// In main.go or app initialization
import "github.com/rclone/rclone/librclone/librclone"

librclone.Initialize()
defer librclone.Finalize()
```

### Phase 2: Create rclone RPC wrapper

Replace `rclonecommand.go` with a new `rclone_rpc.go`:

```go
package backend

import (
    "encoding/json"
    "fmt"
    "github.com/rclone/rclone/librclone/librclone"
)

type RcloneRPC struct{}

type RPCResult struct {
    Output string
    Error  string
}

func (r *RcloneRPC) Sync(srcFs, dstFs string, dryRun bool) RPCResult {
    input, _ := json.Marshal(map[string]interface{}{
        "srcFs":  srcFs,
        "dstFs":  dstFs,
        "dryRun": dryRun,
    })
    output, status := librclone.RPC("sync/sync", string(input))
    if status != 200 {
        return RPCResult{Error: output}
    }
    return RPCResult{Output: output}
}

func (r *RcloneRPC) Copy(srcFs, dstFs string, dryRun bool) RPCResult {
    input, _ := json.Marshal(map[string]interface{}{
        "srcFs":  srcFs,
        "dstFs":  dstFs,
        "dryRun": dryRun,
    })
    output, status := librclone.RPC("sync/copy", string(input))
    if status != 200 {
        return RPCResult{Error: output}
    }
    return RPCResult{Output: output}
}

func (r *RcloneRPC) Bisync(path1, path2 string, dryRun bool) RPCResult {
    input, _ := json.Marshal(map[string]interface{}{
        "path1":  path1,
        "path2":  path2,
        "dryRun": dryRun,
    })
    output, status := librclone.RPC("sync/bisync", string(input))
    if status != 200 {
        return RPCResult{Error: output}
    }
    return RPCResult{Output: output}
}

func (r *RcloneRPC) ListJSON(fs string) (string, error) {
    input, _ := json.Marshal(map[string]interface{}{
        "fs":     fs,
        "remote": "",
    })
    output, status := librclone.RPC("operations/list", string(input))
    if status != 200 {
        return "", fmt.Errorf("list failed: %s", output)
    }
    return output, nil
}
```

### Phase 3: Refactor syncservice.go

Replace `executeSingleFolder` to use `RcloneRPC` instead of `RcloneCommand`:

```go
func (ss *SyncService) executeSingleFolder(targetFolder string, action RcloneAction, dry bool) RcloneActionOutput {
    // ... existing path resolution logic stays the same ...

    rpc := &RcloneRPC{}
    var result RPCResult

    switch action {
    case SYNC_PUSH:
        result = rpc.Sync(fullLocalPath, fullRemotePath, dry)
    case SYNC_PULL:
        result = rpc.Sync(fullRemotePath, fullLocalPath, dry)
    case COPY_PULL:
        result = rpc.Copy(fullRemotePath, fullLocalPath, dry)
    case BISYNC:
        result = rpc.Bisync(fullLocalPath, fullRemotePath, dry)
    }

    return RcloneActionOutput{
        TargetFolder:  targetFolder,
        CommandOutput: result.Output,
        CommandError:  result.Error,
    }
}
```

### Phase 4: Refactor configservice.go

Replace the three exec calls in configservice.go:

| Current | Replacement |
|---------|-------------|
| `createCommand("rclone", "config", "file")` | `librclone.RPC("config/paths", "{}")` |
| `createCommand("rclone", "copyto", remotePath, configFile)` | `librclone.RPC("operations/copyfile", ...)` |
| `createCommand("rclone", "lsjson", remotePath)` | `librclone.RPC("operations/list", ...)` — returns JSON natively |

### Phase 5: Remove exec infrastructure

Delete files that are no longer needed:

| File | Reason |
|------|--------|
| `backend/rclonecommand.go` | Replaced by `rclone_rpc.go` |
| `backend/exec_windows.go` | No more exec calls for rclone |
| `backend/exec_other.go` | No more exec calls for rclone |

Note: Check if `createCommand` / `createVisibleCommand` are used for anything other than rclone (e.g., opening file explorer). If so, keep the exec files but remove the rclone-specific usage.

### Phase 6: Rclone config handling

Currently the app writes an `rclone.conf` file that the rclone CLI reads. With librclone, config is loaded in-process. Options:

1. **Keep writing rclone.conf**: librclone reads the standard config path by default. Simplest migration — no config changes needed.
2. **Programmatic config**: Use `config/create` and `config/update` RC calls to configure remotes in-memory. Eliminates file I/O but requires rethinking the config flow.

Recommend option 1 for initial migration — keep the existing config file approach. Migrate to programmatic config later if desired.

---

## Binary Size Impact

| Component | Approximate Size |
|-----------|-----------------|
| Current app binary | ~15 MB |
| Rclone (all backends) | ~65-70 MB |
| **Combined estimate** | **~80-85 MB** |

### Size reduction options

Rclone supports build tags to exclude unused backends:

```go
// Only include B2 backend (your primary use case)
// Exclude: Google Drive, S3, Azure, Dropbox, 35+ others
```

This could potentially reduce the rclone contribution to ~20-30 MB, bringing the total to ~35-45 MB. However, this limits future flexibility if you want to support additional providers.

**Recommendation**: Ship with all backends initially. Users may want to configure different providers. Optimize later if binary size becomes a real concern. 80 MB is normal for desktop apps (Electron apps are 150+ MB).

---

## Migration Path

This is a **backend-only change**. No frontend modifications needed:

- The `RcloneActionOutput` struct stays the same
- Event payloads (`TaskFolderCompletePayload`, etc.) stay the same
- The `executeSingleFolder` → event emission flow stays the same
- All existing task queue, FIFO, and preview logic is untouched

The refactor is isolated to:
1. How rclone operations are invoked (exec → RPC)
2. How rclone config is discovered (exec → RPC)
3. App initialization (add `librclone.Initialize()`)

---

## Risks and Considerations

### Go module compatibility
Rclone has a large dependency tree. Adding `github.com/rclone/rclone` to `go.mod` will pull in many transitive dependencies. Potential conflicts with Wails v3 dependencies should be tested early.

### Rclone version pinning
With librclone embedded, updating rclone requires updating the Go module and rebuilding. This is a feature (stability) but means rclone security patches require an app release.

### Config encryption
If users have an encrypted `rclone.conf`, librclone will need the password. The current exec approach inherits this from the environment; librclone may need explicit configuration. Test this scenario.

### Concurrent operations
librclone is safe for concurrent use (rclone's RC server handles this). The existing goroutine-per-folder pattern in `ExecuteRcloneActionAsync` will work as-is.

---

## Files

### Created
| File | Purpose |
|------|---------|
| `backend/rclone_rpc.go` | RPC wrapper around librclone |

### Modified
| File | Change |
|------|--------|
| `go.mod` | Add `github.com/rclone/rclone` dependency |
| `main.go` (or app init) | Add `librclone.Initialize()` / `Finalize()` |
| `backend/syncservice.go` | Use `RcloneRPC` instead of `RcloneCommand` |
| `backend/configservice.go` | Replace exec calls with RPC calls |
| `backend/rcloneaction.go` | Add `BISYNC` action (if implementing with FEATURE_BISYNC) |

### Removed
| File | Reason |
|------|--------|
| `backend/rclonecommand.go` | Replaced by `rclone_rpc.go` |
| `backend/exec_windows.go` | No longer needed for rclone (keep if used elsewhere) |
| `backend/exec_other.go` | No longer needed for rclone (keep if used elsewhere) |
