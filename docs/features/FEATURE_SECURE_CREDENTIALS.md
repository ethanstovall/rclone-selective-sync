# Feature: Secure Credential Configuration

## Summary

Devise a remote configuration setup that avoids storing plaintext API keys and credentials in config files. Implement secure credential storage using OS-level secret management, encryption, or external secret providers.

---

## Current State

### Security Issues

1. **Plaintext in config.json**: API keys stored directly in `~/.config/rclone-selective-sync/config.json`
   ```json
   {
     "remotes": {
       "project": {
         "account": "001234567890abcdef",
         "key": "K001XXXXXXXXXXXXXXXXXXXXXXXXXXX"  // ← Plaintext!
       }
     }
   }
   ```

2. **Frontend Exposure**: Full `GlobalConfig` (including keys) loaded into frontend JavaScript
   ```typescript
   // hooks/GlobalConfigContext.tsx
   const [globalConfig, setGlobalConfig] = useState<GlobalConfig | undefined>();
   // globalConfig.remotes["project"].key is accessible in browser devtools
   ```

3. **Rclone.conf Plaintext**: Credentials written to rclone.conf in plaintext
   ```ini
   [remote_name]
   type = b2
   account = 001234567890abcdef
   key = K001XXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

---

## Requirements

### Core Requirements
- [ ] API keys and secrets must not be stored in plaintext config files
- [ ] Credentials should not be exposed to the frontend/renderer process
- [ ] Support for multiple credential storage backends
- [ ] Graceful fallback if secure storage unavailable
- [ ] Migration path for existing plaintext configs

### Security Properties
- [ ] Credentials encrypted at rest
- [ ] Credentials only decrypted when needed for rclone operations
- [ ] No credential exposure in logs or error messages
- [ ] Audit trail for credential access (optional)

---

## Proposed Solution: Multi-Layer Approach

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Frontend (Renderer)                        │
│  • Never sees actual credentials                                  │
│  • Only sees credential references/placeholders                   │
│  • Displays masked values (●●●●●●●●)                             │
└─────────────────────────────┬────────────────────────────────────┘
                              │ IPC
┌─────────────────────────────▼────────────────────────────────────┐
│                        Backend (Go)                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  Credential Manager                         │  │
│  │  • Abstracts credential storage                            │  │
│  │  • Retrieves credentials only when executing rclone        │  │
│  │  • Never returns credentials to frontend                   │  │
│  └─────────────────────────┬──────────────────────────────────┘  │
│                            │                                      │
│  ┌─────────────────────────▼──────────────────────────────────┐  │
│  │              Credential Storage Backends                    │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │  │
│  │  │ Keychain │  │ Keyring  │  │Encrypted │  │ Env Vars   │ │  │
│  │  │ (macOS)  │  │ (Linux)  │  │  File    │  │ (fallback) │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Storage Backends

#### 1. OS Keychain/Keyring (Recommended)

**macOS**: Keychain Services via `keychain` package
```go
import "github.com/keybase/go-keychain"

func StoreCredential(service, account, secret string) error {
    item := keychain.NewItem()
    item.SetSecClass(keychain.SecClassGenericPassword)
    item.SetService(service)  // "rclone-selective-sync"
    item.SetAccount(account)  // "project:b2:key"
    item.SetData([]byte(secret))
    item.SetAccessible(keychain.AccessibleWhenUnlocked)
    return keychain.AddItem(item)
}
```

**Linux**: Secret Service API (GNOME Keyring, KDE Wallet)
```go
import "github.com/zalando/go-keyring"

func StoreCredential(service, account, secret string) error {
    return keyring.Set(service, account, secret)
}
```

**Windows**: Windows Credential Manager
```go
import "github.com/danieljoos/wincred"

func StoreCredential(service, account, secret string) error {
    cred := wincred.NewGenericCredential(service + ":" + account)
    cred.CredentialBlob = []byte(secret)
    return cred.Write()
}
```

#### 2. Encrypted File (Fallback)

For systems without keychain or headless operation:

```go
type EncryptedCredStore struct {
    FilePath   string
    MasterKey  []byte  // Derived from password or stored securely
}

// Store encrypted credentials in ~/.config/rclone-selective-sync/credentials.enc
// Use AES-256-GCM for encryption
// Master key derived via Argon2 from user password or stored in keychain
```

**Encryption Scheme**:
- Algorithm: AES-256-GCM (authenticated encryption)
- Key derivation: Argon2id from master password
- Format: `nonce || ciphertext || tag`

#### 3. Environment Variables (CI/Headless)

```bash
export RSS_CRED_PROJECT_ACCOUNT="001234567890"
export RSS_CRED_PROJECT_KEY="K001XXX..."
```

```go
func GetCredentialFromEnv(project, field string) (string, bool) {
    key := fmt.Sprintf("RSS_CRED_%s_%s", strings.ToUpper(project), strings.ToUpper(field))
    return os.LookupEnv(key)
}
```

#### 4. External Secret Providers (Enterprise)

Support for external secret managers:
- HashiCorp Vault
- AWS Secrets Manager
- Azure Key Vault
- 1Password CLI

```go
type ExternalSecretProvider interface {
    GetSecret(path string) (string, error)
    SetSecret(path string, value string) error
    DeleteSecret(path string) error
}
```

---

## Implementation Details

### New Data Models

#### Config File (credentials removed)
```go
type RemoteConfig struct {
    RemoteName     string `json:"remote_name"`
    BucketName     string `json:"bucket_name"`
    Type           string `json:"type"`
    LocalPath      string `json:"local_path"`
    FullBackupPath string `json:"full_backup_path"`
    // Credentials removed - stored in CredentialStore
}

// Credential reference for frontend display
type CredentialStatus struct {
    HasAccount bool      `json:"has_account"`
    HasKey     bool      `json:"has_key"`
    LastUsed   time.Time `json:"last_used,omitempty"`
}
```

#### Credential Manager Interface
```go
type CredentialManager interface {
    // Store credentials
    StoreCredentials(projectKey string, account, key string) error

    // Retrieve credentials (backend only, never exposed to frontend)
    GetCredentials(projectKey string) (account, key string, err error)

    // Check if credentials exist (safe to expose to frontend)
    HasCredentials(projectKey string) (bool, error)

    // Delete credentials
    DeleteCredentials(projectKey string) error

    // Get credential status for UI
    GetCredentialStatus(projectKey string) (CredentialStatus, error)
}
```

### Backend Changes

#### CredentialManager Implementation
```go
// backend/credentialmanager.go

type CredentialManager struct {
    backend CredentialBackend
}

type CredentialBackend interface {
    Store(key, value string) error
    Retrieve(key string) (string, error)
    Delete(key string) error
    Exists(key string) (bool, error)
}

func NewCredentialManager() *CredentialManager {
    // Auto-detect best available backend
    backend := detectBestBackend()
    return &CredentialManager{backend: backend}
}

func detectBestBackend() CredentialBackend {
    switch runtime.GOOS {
    case "darwin":
        return NewKeychainBackend()
    case "linux":
        if keyringAvailable() {
            return NewKeyringBackend()
        }
        return NewEncryptedFileBackend()
    case "windows":
        return NewWinCredBackend()
    default:
        return NewEncryptedFileBackend()
    }
}
```

#### Modified ConfigService
```go
// Credential operations - never return actual credentials to frontend
func (cs *ConfigService) SetRemoteCredentials(projectKey, account, key string) error {
    return cs.credManager.StoreCredentials(projectKey, account, key)
}

func (cs *ConfigService) GetCredentialStatus(projectKey string) (CredentialStatus, error) {
    return cs.credManager.GetCredentialStatus(projectKey)
}

// Internal use only - for rclone config generation
func (cs *ConfigService) generateRcloneConfig() error {
    for projectKey, remote := range cs.configManager.GetGlobalConfig().Remotes {
        account, key, err := cs.credManager.GetCredentials(projectKey)
        if err != nil {
            return fmt.Errorf("failed to get credentials for %s: %w", projectKey, err)
        }
        // Write to rclone.conf (still necessary for rclone to work)
        // Consider: rclone.conf with restricted permissions (0600)
        // or use rclone's --config flag with temp file
    }
    return nil
}
```

#### Temporary Rclone Config (Optional Enhancement)
```go
// Instead of persisting credentials to rclone.conf, generate a temporary config
// for each operation and delete it after

func (ss *SyncService) ExecuteWithTempConfig(action RcloneAction, folder string) error {
    // 1. Get credentials from secure storage
    creds, err := ss.credManager.GetCredentials(projectKey)

    // 2. Write temporary rclone.conf
    tempConfig := createTempRcloneConfig(creds)
    defer os.Remove(tempConfig)

    // 3. Execute rclone with --config flag
    cmd := exec.Command("rclone", "--config", tempConfig, "sync", ...)

    // 4. Temp config auto-deleted on function exit
}
```

### Frontend Changes

#### Modified Types
```typescript
// RemoteConfig no longer has account/key
interface RemoteConfig {
    remote_name: string;
    bucket_name: string;
    type: string;
    local_path: string;
    full_backup_path: string;
}

// New type for credential status
interface CredentialStatus {
    has_account: boolean;
    has_key: boolean;
    last_used?: string;
}
```

#### Credential Input Component
```typescript
// components/CredentialInput.tsx
interface CredentialInputProps {
    projectKey: string;
    onSaved: () => void;
}

const CredentialInput: React.FC<CredentialInputProps> = ({ projectKey, onSaved }) => {
    const [account, setAccount] = useState('');
    const [key, setKey] = useState('');

    const handleSave = async () => {
        await ConfigService.SetRemoteCredentials(projectKey, account, key);
        // Clear local state immediately
        setAccount('');
        setKey('');
        onSaved();
    };

    return (
        <form onSubmit={handleSave}>
            <TextField
                label="Account ID"
                type="password"  // Hide while typing
                value={account}
                onChange={(e) => setAccount(e.target.value)}
            />
            <TextField
                label="Application Key"
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
            />
            <Button type="submit">Save Credentials</Button>
        </form>
    );
};
```

#### Credential Status Display
```typescript
// Show masked status instead of actual values
const CredentialStatusDisplay: React.FC<{ status: CredentialStatus }> = ({ status }) => {
    return (
        <Box>
            <Typography>
                Account: {status.has_account ? '●●●●●●●●●●●● (configured)' : 'Not set'}
            </Typography>
            <Typography>
                Key: {status.has_key ? '●●●●●●●●●●●● (configured)' : 'Not set'}
            </Typography>
        </Box>
    );
};
```

---

## Migration Path

### Automatic Migration on First Launch

```go
func (cs *ConfigService) migrateCredentials() error {
    config := cs.configManager.GetGlobalConfig()

    for projectKey, remote := range config.Remotes {
        // Check if plaintext credentials exist
        if remote.Account != "" && remote.Key != "" {
            // Migrate to secure storage
            err := cs.credManager.StoreCredentials(projectKey, remote.Account, remote.Key)
            if err != nil {
                return fmt.Errorf("failed to migrate credentials for %s: %w", projectKey, err)
            }

            // Clear from config
            remote.Account = ""
            remote.Key = ""
            config.Remotes[projectKey] = remote
        }
    }

    // Save updated config (without credentials)
    return cs.configManager.WriteGlobalConfigToDisk()
}
```

### Backup Before Migration

```go
func (cs *ConfigService) backupConfigBeforeMigration() error {
    src := cs.getConfigPath()
    dst := src + ".backup-" + time.Now().Format("20060102-150405")
    return copyFile(src, dst)
}
```

---

## Security Considerations

### Threat Model

| Threat | Mitigation |
|--------|------------|
| Config file stolen | Credentials not in config file |
| Memory dump | Credentials zeroed after use |
| Frontend XSS | Credentials never sent to frontend |
| Rclone.conf theft | Use temp config or restricted permissions |
| Keychain unlocked | User must authenticate to unlock |
| Process inspection | Credentials passed via stdin, not args |

### Best Practices Implemented

1. **Credential Zeroing**: Clear credential variables after use
   ```go
   defer func() {
       for i := range key {
           key[i] = 0
       }
   }()
   ```

2. **No Logging**: Never log credentials
   ```go
   log.Printf("Connecting to %s (credentials: [REDACTED])", remoteName)
   ```

3. **Secure IPC**: Wails IPC is local-only, but credentials still not sent

4. **File Permissions**: Config files created with 0600 permissions

---

## Implementation Tasks

### Phase 1: Credential Manager Core
1. [ ] Define `CredentialManager` interface
2. [ ] Implement macOS Keychain backend
3. [ ] Implement Windows Credential Manager backend
4. [ ] Implement Linux keyring backend (libsecret/kwallet)
5. [ ] Implement encrypted file fallback backend

### Phase 2: Backend Integration
1. [ ] Add `CredentialManager` to ConfigService
2. [ ] Create credential-related API methods
3. [ ] Modify rclone config generation to use credential manager
4. [ ] Remove credential fields from GlobalConfig frontend exposure

### Phase 3: Frontend Updates
1. [ ] Create credential input components
2. [ ] Create credential status display components
3. [ ] Update remote management UI
4. [ ] Remove any credential display/handling

### Phase 4: Migration & Testing
1. [ ] Implement automatic migration from plaintext
2. [ ] Create backup mechanism
3. [ ] Test on all platforms (macOS, Windows, Linux)
4. [ ] Test fallback to encrypted file when keychain unavailable

### Phase 5: Documentation
1. [ ] Document credential storage locations per platform
2. [ ] Document manual credential management (CLI)
3. [ ] Document enterprise integration options

---

## Dependencies

### Go Packages
```go
// macOS Keychain
"github.com/keybase/go-keychain"

// Linux Secret Service
"github.com/zalando/go-keyring"

// Windows Credential Manager
"github.com/danieljoos/wincred"

// Encryption (fallback)
"golang.org/x/crypto/argon2"
"crypto/aes"
"crypto/cipher"
```

---

## Testing Considerations

- Test credential storage/retrieval on each platform
- Test migration from existing plaintext configs
- Test fallback when keychain unavailable
- Test credential update flow
- Test app behavior when credentials missing/invalid
- Verify credentials never appear in logs
- Verify credentials not in frontend state/devtools
