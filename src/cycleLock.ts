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

export function isSeptember2026Cycle(
  cycle: { month: number; year: number } | null | undefined
): boolean {
  return !!cycle && cycle.month === 9 && cycle.year === 2026;
}

export function isOctober2026Cycle(
  cycle: { month: number; year: number } | null | undefined
): boolean {
  return !!cycle && cycle.month === 10 && cycle.year === 2026;
}

export function isCycleLocked(
  cycle: { month: number; year: number; status?: string } | null | undefined
): boolean {
  if (!cycle) return false;
  return (
    isJuly2026Cycle(cycle) ||
    isAugust2026Cycle(cycle) ||
    isSeptember2026Cycle(cycle) ||
    cycle.status === 'Closed'
  );
}

/** August 2026 is fully locked — no goal or progress edits. */
export function isAugust2026GoalContentLocked(
  cycle: { month: number; year: number } | null | undefined
): boolean {
  return isAugust2026Cycle(cycle);
}
