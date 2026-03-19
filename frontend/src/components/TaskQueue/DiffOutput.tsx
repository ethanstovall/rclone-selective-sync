import React, { useMemo } from "react";
import { Box, Chip, Typography, useTheme } from "@mui/material";
import { Add, Edit, DeleteOutline } from "@mui/icons-material";

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

/** Groups entries by their directory path, sorted alphabetically. Root ("") sorts first. */
function groupByDir(entries: DiffEntry[]): [string, DiffEntry[]][] {
    const map = new Map<string, DiffEntry[]>();
    for (const entry of entries) {
        const lastSlash = entry.path.lastIndexOf("/");
        const dir = lastSlash >= 0 ? entry.path.substring(0, lastSlash) : "";
        if (!map.has(dir)) map.set(dir, []);
        map.get(dir)!.push(entry);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function DiffSection({ title, icon, entries, color }: {
    title: string;
    icon: React.ReactNode;
    entries: DiffEntry[];
    color: string;
}) {
    const theme = useTheme();
    const grouped = useMemo(() => groupByDir(entries), [entries]);
    if (entries.length === 0) return null;

    return (
        <Box sx={{ mb: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75 }}>
                {icon}
                <Typography variant="caption" sx={{ fontWeight: 600, color, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {title} ({entries.length})
                </Typography>
            </Box>
            {grouped.map(([dir, dirEntries], groupIdx) => (
                <Box key={dir || "__root__"} sx={{ mb: groupIdx < grouped.length - 1 ? 0.75 : 0 }}>
                    {dir && (
                        <Typography
                            variant="caption"
                            sx={{
                                display: "block",
                                pl: 2.5,
                                pb: 0.25,
                                color: theme.palette.text.disabled,
                                fontFamily: "monospace",
                                fontSize: "0.7rem",
                            }}
                        >
                            {dir}/
                        </Typography>
                    )}
                    <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                        <tbody>
                            {dirEntries.map((entry) => {
                                const lastSlash = entry.path.lastIndexOf("/");
                                const fileName = lastSlash >= 0 ? entry.path.substring(lastSlash + 1) : entry.path;
                                const sizeLabel = entry.oldSize
                                    ? `${entry.oldSize} → ${entry.size}`
                                    : entry.detail || entry.size;
                                return (
                                    <Box component="tr" key={entry.path}>
                                        <Box
                                            component="td"
                                            sx={{
                                                pl: dir ? 4 : 2.5,
                                                py: 0.1,
                                                fontFamily: "monospace",
                                                fontSize: "0.8rem",
                                                color: theme.palette.secondary.main,
                                                fontWeight: 500,
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
                                                color: theme.palette.text.disabled,
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
        </Box>
    );
}

const DiffOutput: React.FC<DiffOutputProps> = ({ diff }) => {
    const theme = useTheme();
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
            <DiffSection
                title="Additions"
                icon={<Add sx={{ fontSize: 14, color: theme.palette.success.main }} />}
                entries={additions}
                color={theme.palette.success.main}
            />
            <DiffSection
                title="Updates"
                icon={<Edit sx={{ fontSize: 14, color: theme.palette.warning.main }} />}
                entries={updates}
                color={theme.palette.warning.main}
            />
            <DiffSection
                title="Deletions"
                icon={<DeleteOutline sx={{ fontSize: 14, color: theme.palette.error.main }} />}
                entries={deletions}
                color={theme.palette.error.main}
            />
            {/* Summary */}
            <Box sx={{ display: "flex", gap: 1, mt: 1, pt: 1, borderTop: `1px solid ${theme.palette.divider}` }}>
                {additions.length > 0 && <Chip size="small" label={`+${additions.length}`} color="success" variant="outlined" sx={{ height: 20, fontSize: "0.7rem" }} />}
                {updates.length > 0 && <Chip size="small" label={`~${updates.length}`} color="warning" variant="outlined" sx={{ height: 20, fontSize: "0.7rem" }} />}
                {deletions.length > 0 && <Chip size="small" label={`-${deletions.length}`} color="error" variant="outlined" sx={{ height: 20, fontSize: "0.7rem" }} />}
                <Typography variant="caption" color="text.disabled" sx={{ ml: "auto" }}>
                    {diff.changeSize} to transfer
                </Typography>
            </Box>
        </Box>
    );
};

export default DiffOutput;
