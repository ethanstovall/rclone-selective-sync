# Feature: Persistent Project State Across Pages

## Status: Implemented (folded into Async Task Queue)

This feature was implemented as Phase 1 of [FEATURE_ASYNC_TASK_QUEUE.md](FEATURE_ASYNC_TASK_QUEUE.md). `GlobalConfigContextProvider`, `ProjectConfigContextProvider`, and `TaskQueueContextProvider` are all mounted at the app root in `App.tsx`, persisting across page navigation.

## Original Summary

Lift the selected project and its associated state (project config, local folders, changed folders) out of the Sync Folders page so that it persists when the user navigates to Settings or Remotes. This is a prerequisite for background tasks to continue running while the user is on another page.

---

## Current State

### How Context Providers Are Mounted

```
main.tsx
└── App (navigation shell)
    └── RootLayout (DashboardLayout + padded container)
        ├── SyncFolders ← GlobalConfigContextProvider
        │                    └── ProjectConfigContextProvider
        │                         └── ProjectSelector
        │                              └── ProjectDashboard
        ├── Preferences  ← (no providers)
        └── ManageRemotes ← GlobalConfigContextProvider (separate instance)
```

**Key observations:**
- `GlobalConfigContextProvider` is instantiated **separately** in SyncFolders and ManageRemotes. Each page gets its own copy of global config state.
- `ProjectConfigContextProvider` only exists inside SyncFolders. Navigating away destroys it and all project-level state.
- `selectedProject` lives inside GlobalConfigContext, which is re-created on each page mount.

### What Gets Lost on Navigation

When the user navigates from "Sync Folders" to "Preferences" or "Remotes":
- Project config is destroyed and must be reloaded on return
- Local folder list is lost
- Changed folder detection results are lost
- Target folder selections are cleared
- Any in-progress rclone operations would be orphaned (currently not possible because the UI blocks)

### Files Involved

| File | What it manages |
|------|-----------------|
| [GlobalConfigContext.tsx](../../frontend/src/hooks/GlobalConfigContext.tsx) | `globalConfig`, `selectedProject` |
| [ProjectConfigContext.tsx](../../frontend/src/hooks/ProjectConfigContext.tsx) | `projectConfig`, sync status warnings |
| [SyncFolders.tsx](../../frontend/src/pages/SyncFolders.tsx) | Mounts both providers |
| [ManageRemotes.tsx](../../frontend/src/pages/ManageRemotes.tsx) | Mounts its own GlobalConfigContextProvider |
| [main.tsx](../../frontend/src/main.tsx) | Router configuration, no providers at root |

---

## Proposed Design

### Lift Providers to App Root

Move `GlobalConfigContextProvider` to the app root so all pages share the same instance. Then either lift `ProjectConfigContextProvider` as well, or create a slimmer global version.

```
main.tsx
└── GlobalConfigContextProvider   ← shared by all pages
    └── ProjectConfigContextProvider  ← optional: lift here too
        └── TaskQueueProvider     ← for async tasks (see FEATURE_ASYNC_TASK_QUEUE.md)
            └── App (navigation shell)
                └── RootLayout
                    ├── SyncFolders  ← uses context, doesn't create it
                    ├── Preferences  ← can now read selectedProject
                    └── ManageRemotes ← shares same globalConfig
```

### What Changes

#### GlobalConfigContext

**Currently:** Instantiated per-page. Each instance calls `ConfigService.LoadGlobalConfig()` on mount.

**After:** Single instance at root. Loads once on app startup. All pages share the same `globalConfig` and `selectedProject`.

**Migration:**
- Remove `GlobalConfigContextProvider` from [SyncFolders.tsx](../../frontend/src/pages/SyncFolders.tsx) and [ManageRemotes.tsx](../../frontend/src/pages/ManageRemotes.tsx)
- Add `GlobalConfigContextProvider` to [main.tsx](../../frontend/src/main.tsx) wrapping the router

#### ProjectConfigContext

Two options:

**Option A: Lift to Root (Recommended)**

Move `ProjectConfigContextProvider` next to `GlobalConfigContextProvider` at the root. Project config loads when `selectedProject` changes and stays loaded across navigation.

Pros:
- Project config is always available
- No flash of loading state when returning to Sync Folders
- Background tasks can reference project config

Cons:
- Project config stays in memory even when viewing Settings
- Need to handle stale config if remote changes happen while on another page

**Option B: Keep in SyncFolders, Add Warning**

Keep `ProjectConfigContextProvider` inside the Sync Folders page. Show a warning dialog when the user tries to navigate away while tasks are active.

Pros:
- Minimal code changes
- No risk of stale state on other pages

Cons:
- User is effectively locked to Sync Folders during operations
- Doesn't solve the actual problem, just mitigates it

---

## Implementation Plan (Option A)

### Phase 1: Lift GlobalConfigContext

**Files to modify:**
- [frontend/src/main.tsx](../../frontend/src/main.tsx)
- [frontend/src/pages/SyncFolders.tsx](../../frontend/src/pages/SyncFolders.tsx)
- [frontend/src/pages/ManageRemotes.tsx](../../frontend/src/pages/ManageRemotes.tsx)

**Tasks:**
- [ ] Wrap `RouterProvider` in `main.tsx` with `GlobalConfigContextProvider`
- [ ] Remove `GlobalConfigContextProvider` from SyncFolders page
- [ ] Remove `GlobalConfigContextProvider` from ManageRemotes page
- [ ] Verify ManageRemotes still works with shared context
- [ ] Verify project selection persists across navigation

### Phase 2: Lift ProjectConfigContext

**Files to modify:**
- [frontend/src/main.tsx](../../frontend/src/main.tsx)
- [frontend/src/pages/SyncFolders.tsx](../../frontend/src/pages/SyncFolders.tsx)
- [frontend/src/hooks/ProjectConfigContext.tsx](../../frontend/src/hooks/ProjectConfigContext.tsx)

**Tasks:**
- [ ] Move `ProjectConfigContextProvider` to root in `main.tsx` (nested inside GlobalConfigContextProvider)
- [ ] Remove `ProjectConfigContextProvider` from SyncFolders page
- [ ] Verify project config loads correctly when selectedProject changes
- [ ] Move the sync-status Snackbar to a global location (or keep it in the context provider since it's at root now)

### Phase 3: Add TaskQueueProvider

**Depends on:** [FEATURE_ASYNC_TASK_QUEUE.md](FEATURE_ASYNC_TASK_QUEUE.md)

**Tasks:**
- [ ] Add `TaskQueueProvider` at root level (after ProjectConfigContextProvider)
- [ ] Mount `TaskPanel` component in RootLayout (outside `<Outlet />`)
- [ ] Tasks now persist across page navigation

### Phase 4: Handle Edge Cases

- [ ] If user switches projects while tasks are running, warn or cancel active tasks
- [ ] If remote config changes while on Preferences page, refresh on return
- [ ] Consider adding a `refreshProjectConfig()` method to the context for manual refresh

---

## Alternative: Navigation Warning (Option B / Interim Solution)

If lifting providers is too invasive initially, implement a navigation guard:

```typescript
// In ProjectDashboard or SyncFolders
useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (activeTasks.length > 0) {
            e.preventDefault();
            e.returnValue = "";
        }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [activeTasks]);
```

And use React Router's `useBlocker` or `<Prompt>` to intercept in-app navigation:

```typescript
const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
        activeTasks.length > 0 &&
        currentLocation.pathname !== nextLocation.pathname
);

// Show confirmation dialog when blocker is active
```

This could serve as an interim solution while Option A is implemented.

---

## Benefits

1. **Seamless navigation** - Check settings or remotes without losing sync state
2. **Background task support** - Tasks continue running on any page
3. **Faster page transitions** - No re-fetching of global/project config on every navigation
4. **Shared state** - ManageRemotes and SyncFolders share the same config instance
5. **Foundation for future features** - Global state enables notification system, status bar, etc.

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Stale project config after remote changes | Add manual refresh button; auto-refresh on return to Sync Folders |
| Memory usage with config always loaded | ProjectConfig is small (JSON); negligible impact |
| Provider ordering complexity | Document the provider hierarchy clearly |
| Breaking existing pages | ManageRemotes already uses GlobalConfigContext the same way; minimal risk |

---

## Relationship to Other Features

- **[FEATURE_ASYNC_TASK_QUEUE.md](FEATURE_ASYNC_TASK_QUEUE.md)** - Direct dependency. The task queue context needs to be at the app root, which requires this feature to be implemented first (or simultaneously).
- **[IMPROVEMENT_BACKGROUND_SYNC.md](../improvements/IMPROVEMENT_BACKGROUND_SYNC.md)** - Earlier brainstorming that assumed a backend-managed task queue. This feature takes a different approach (frontend-managed with events) but the goals are the same.
