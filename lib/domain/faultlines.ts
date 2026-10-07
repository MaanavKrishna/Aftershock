export function faultLines(incidents: { watchedFiles: string[] }[]): { file: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const i of incidents) for (const f of new Set(i.watchedFiles)) counts.set(f, (counts.get(f) ?? 0) + 1);
  return [...counts]
    .map(([file, count]) => ({ file, count }))
    .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file));
}
