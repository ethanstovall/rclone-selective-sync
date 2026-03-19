import React, { useMemo } from "react";
import { Box, Chip, Typography, useTheme } from "@mui/material";

interface DiffEntry {
    type: "add" | "update" | "delete";
    path: string;
    size: string;
    oldSize?: string;
    detail?: string;
}

interface DiffResult {
    isDiff: boolean;
    additions: DiffEntry[] | null;
    updates: DiffEntry[] | null;
    deletions: DiffEntry[] | null;
    totalSize: string;
    changeSize: string;
}

/** Try to parse a string as a DiffResult. Returns null if it's not a diff. */
export function parseDiffResult(output: string): DiffResult | null {
    try {
        const parsed = JSON.parse(output);
        if (parsed && parsed.isDiff === true) {
            return parsed as DiffResult;
        }
    } catch {
        // Not JSON — plain text output
    }
    return null;
}

interface DiffOutputProps {
    diff: DiffResult;
}

// --- Tree building ---

interface TreeNode {
    name: string;
    children: Map<string, TreeNode>;
    files: DiffEntry[];
}

function newTreeNode(name: string): TreeNode {
    return { name, children: new Map(), files: [] };
}

/** Build a nested tree from flat file paths. */
function buildTree(diff: DiffResult): TreeNode {
    const root = newTreeNode("");
    const all: DiffEntry[] = [
        ...(diff.additions || []),
        ...(diff.updates || []),
        ...(diff.deletions || []),
    ];
    for (const entry of all) {
        const parts = entry.path.split("/");
        const fileName = parts.pop()!;
        let node = root;
        for (const part of parts) {
            if (!node.children.has(part)) {
                node.children.set(part, newTreeNode(part));
            }
            node = node.children.get(part)!;
        }
        node.files.push({ ...entry, path: fileName });
    }
    return root;
}

/** Get sorted child directory names. */
function sortedDirs(node: TreeNode): TreeNode[] {
    return Array.from(node.children.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** Sort files: adds first, then updates, then deletes, then alphabetically. */
function sortedFiles(files: DiffEntry[]): DiffEntry[] {
    const typeOrder = { add: 0, update: 1, delete: 2 };
    return [...files].sort((a, b) => typeOrder[a.type] - typeOrder[b.type] || a.path.localeCompare(b.path));
}

const typeColors = {
    add: "success",
    update: "warning",
    delete: "error",
} as const;

// --- Rendering ---

function TreeNodeView({ node, depth }: { node: TreeNode; depth: number }) {
    const theme = useTheme();
    const dirs = sortedDirs(node);
    const files = sortedFiles(node.files);

    return (
        <>
            {/* Directory name (skip for root) */}
            {node.name && (
                <Typography
                    variant="caption"
                    sx={{
                        display: "block",
                        pl: depth * 1.25,
                        pt: depth > 1 ? 0.5 : 0,
                        pb: 0.25,
                        color: theme.palette.text.secondary,
                        fontFamily: "monospace",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                    }}
                >
                    {node.name}/
                </Typography>
            )}
            {/* Files in this directory */}
            {files.length > 0 && (
                <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                        {files.map((entry) => {
                            const colorKey = typeColors[entry.type];
                            const fileColor = theme.palette[colorKey].main;
                            const sizeLabel = entry.oldSize
                                ? `${entry.oldSize} → ${entry.size}`
                                : entry.size;
                            return (
                                <Box component="tr" key={entry.path}>
                                    <Box
                                        component="td"
                                        sx={{
                                            pl: (depth + 1) * 1.25 + 0.5,
                                            py: 0.1,
                                            fontFamily: "monospace",
                                            fontSize: "0.8rem",
                                            color: fileColor,
                                            opacity: 0.8,
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {entry.path}
                                    </Box>
                                    <Box
                                        component="td"
                                        sx={{
                                            pl: 2,
                                            py: 0.1,
                                            whiteSpace: "nowrap",
                                            textAlign: "right",
                                            fontSize: "0.7rem",
                                            color: fileColor,
                                            opacity: 0.5,
                                        }}
                                    >
                                        {sizeLabel}
                                    </Box>
                                </Box>
                            );
                        })}
                    </tbody>
                </Box>
            )}
            {/* Child directories */}
            {dirs.map((child) => (
                <TreeNodeView key={child.name} node={child} depth={depth + 1} />
            ))}
        </>
    );
}

const DiffOutput: React.FC<DiffOutputProps> = ({ diff }) => {
    const theme = useTheme();
    const tree = useMemo(() => buildTree(diff), [diff]);
    const additions = diff.additions || [];
    const updates = diff.updates || [];
    const deletions = diff.deletions || [];
    const totalChanges = additions.length + updates.length + deletions.length;

    if (totalChanges === 0) {
        return (
            <Box sx={{ py: 2, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">No changes detected.</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ py: 0.5 }}>
            <TreeNodeView node={tree} depth={0} />
            {/* Summary */}
            <Box sx={{ display: "flex", gap: 1, mt: 1.5, pt: 1, borderTop: `1px solid ${theme.palette.divider}`, alignItems: "center" }}>
                {additions.length > 0 && <Chip size="small" label={`+${additions.length}`} color="success" variant="outlined" sx={{ height: 20, fontSize: "0.7rem" }} />}
                {updates.length > 0 && <Chip size="small" label={`~${updates.length}`} color="warning" variant="outlined" sx={{ height: 20, fontSize: "0.7rem" }} />}
                {deletions.length > 0 && <Chip size="small" label={`-${deletions.length}`} color="error" variant="outlined" sx={{ height: 20, fontSize: "0.7rem" }} />}
                <Typography variant="caption" sx={{ ml: "auto", color: theme.palette.secondary.main, fontWeight: 500 }}>
                    {diff.changeSize} to transfer
                </Typography>
            </Box>
        </Box>
    );
};

export default DiffOutput;
