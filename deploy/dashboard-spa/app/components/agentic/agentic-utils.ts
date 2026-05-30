export function gradeColor(grade: string): string {
  const map: Record<string, string> = {
    'A+': '#00C853',
    A: '#64DD17',
    B: '#FFD600',
    C: '#FF9100',
    D: '#FF3D00',
    F: '#D50000',
  };
  return map[grade] || '#94a3b8';
}

export function formatUptime(ms: number): string {
  const h = ms / 3600000;
  if (h < 1) return `${Math.round(ms / 60000)}m`;
  return `${h.toFixed(1)}h`;
}
