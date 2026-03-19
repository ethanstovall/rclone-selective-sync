# Feature: Nested Folder Tree Diff View

## Status: Proposed

## Summary

Replace the flat folder-grouped diff output in the task panel with a collapsible nested folder tree. For deeply nested projects, this would let users expand/collapse directories to drill into specific areas of change rather than scrolling through a flat list of folder groups.

### Current Behavior

Files are grouped by their immediate parent directory with a folder header. All groups are expanded and displayed vertically. For projects with many directories, this produces a long scrollable list.

### Proposed Behavior

Render the diff as a tree where directories are collapsible nodes. Each directory shows a summary count (e.g. `+2 ~1 -0`) so users can see impact at a glance without expanding. Leaf nodes are the individual files, color-coded by operation type as they are today.

### Scope

Frontend-only change — the backend already returns full file paths in the structured diff JSON. The tree would be built from those paths in `DiffOutput.tsx`.

### Considerations

- Collapsibility is not a requirement — a static nested tree with indentation may be sufficient and simpler to implement
- May be over-engineered for projects with shallow directory structures
- Should only pursue if users find the current flat grouping insufficient for real-world project sizes
