export function isJuly2026Cycle(
  cycle: { month: number; year: number } | null | undefined
): boolean {
  return !!cycle && cycle.month === 7 && cycle.year === 2026;
}

export function isCycleLocked(
  cycle: { month: number; year: number; status?: string } | null | undefined
): boolean {
  if (!cycle) return false;
  return isJuly2026Cycle(cycle) || cycle.status === 'Closed';
}
