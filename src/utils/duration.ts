/** format a duration in milliseconds as `350ms` or `1.2s`; invalid input falls back to `0ms` */
export function formatDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0) return "0ms";
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
