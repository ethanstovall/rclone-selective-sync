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

/** Merge all entries and group by directory, sorted alphabetically. */
function groupAllByDir(diff: DiffResult): [string, DiffEntry[]][] {
    const all: DiffEntry[] = [
        ...(diff.additions || []),
        ...(diff.updates || []),
        ...(diff.deletions || []),
    ];
    const map = new Map<string, DiffEntry[]>();
    for (const entry of all) {
        const lastSlash = entry.path.lastIndexOf("/");
        const dir = lastSlash >= 0 ? entry.path.substring(0, lastSlash) : "";
        if (!map.has(dir)) map.set(dir, []);
        map.get(dir)!.push(entry);
    }
    const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    const typeOrder = { add: 0, update: 1, delete: 2 };
    for (const [, entries] of sorted) {
        entries.sort((a, b) => typeOrder[a.type] - typeOrder[b.type] || a.path.localeCompare(b.path));
    }
    return sorted;
}

const typeColors = {
    add: "success",
    update: "warning",
    delete: "error",
} as const;

const DiffOutput: React.FC<DiffOutputProps> = ({ diff }) => {
    const theme = useTheme();
    const grouped = useMemo(() => groupAllByDir(diff), [diff]);
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
            {grouped.map(([dir, entries], groupIdx) => (
                <Box
                    key={dir || "__root__"}
                    sx={{
                        mb: groupIdx < grouped.length - 1 ? 1.5 : 0,
                        borderLeft: `2px solid ${theme.palette.divider}`,
                        pl: 0.5,
                    }}
                >
                    {dir && (
                        <Typography
                            variant="caption"
                            sx={{
                                display: "block",
                                pl: 1,
                                pb: 0.25,
                                color: theme.palette.text.secondary,
                                fontFamily: "monospace",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                            }}
                        >
                            {dir}/
                        </Typography>
                    )}
                    <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                        <tbody>
                            {entries.map((entry) => {
                                const lastSlash = entry.path.lastIndexOf("/");
                                const fileName = lastSlash >= 0 ? entry.path.substring(lastSlash + 1) : entry.path;
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
                                                pl: dir ? 3 : 1,
                                                py: 0.1,
                                                fontFamily: "monospace",
                                                fontSize: "0.8rem",
                                                color: fileColor,
                                                opacity: 0.8,
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {fileName}
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
                </Box>
            ))}
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
