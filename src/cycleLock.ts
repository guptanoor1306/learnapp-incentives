export function isJuly2026Cycle(
  cycle: { month: number; year: number } | null | undefined
): boolean {
  return !!cycle && cycle.month === 7 && cycle.year === 2026;
}

export function isAugust2026Cycle(
  cycle: { month: number; year: number } | null | undefined
): boolean {
  return !!cycle && cycle.month === 8 && cycle.year === 2026;
}

export function isCycleLocked(
  cycle: { month: number; year: number; status?: string } | null | undefined
): boolean {
  if (!cycle) return false;
  return isJuly2026Cycle(cycle) || cycle.status === 'Closed';
}

/** August goals are frozen; only progress updates are allowed. */
export function isAugust2026GoalContentLocked(
  cycle: { month: number; year: number } | null | undefined
): boolean {
  return isAugust2026Cycle(cycle);
}
