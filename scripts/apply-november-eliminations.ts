import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import { goals, incentiveCycles, profiles } from '../src/db/schema.ts';
import { calculateLeaderboardProgress } from '../src/progressMetrics.ts';
import { NOVEMBER_2026_OPT_OUT_EMAILS } from '../src/november2026OptOut.ts';
import {
  getNovember2026EliminationMessage,
  type November2026EliminationReason,
} from '../src/november2026Elimination.ts';

const CUTOFF_LABEL = '17 November';

function writeEliminationSourceFile(emails: string[]) {
  const sorted = [...new Set(emails.map((e) => e.toLowerCase()))].sort();
  const body = sorted.map((e) => `    '${e}',`).join('\n');
  const content = `import { isNovember2026Cycle } from './cycleLock.ts';

export type November2026EliminationReason = 'zero_progress';

/** Progress was 0% through ${CUTOFF_LABEL} — synced via npm run apply:nov-eliminations. */
export const NOVEMBER_2026_ZERO_PROGRESS_EMAILS = new Set(
  [
${body}
  ].map((e) => e.toLowerCase())
);

export type November2026EliminationProfile = {
  email?: string | null;
};

export function getNovember2026EliminationReason(
  profile: November2026EliminationProfile | null | undefined,
  cycle: { month: number; year: number } | null | undefined
): November2026EliminationReason | null {
  if (!isNovember2026Cycle(cycle) || !profile?.email) return null;
  const email = profile.email.toLowerCase();
  if (NOVEMBER_2026_ZERO_PROGRESS_EMAILS.has(email)) return 'zero_progress';
  return null;
}

export function isNovember2026EliminatedProfile(
  profile: November2026EliminationProfile | null | undefined,
  cycle: { month: number; year: number } | null | undefined
): boolean {
  return getNovember2026EliminationReason(profile, cycle) !== null;
}

export function getNovember2026EliminationMessage(
  _reason: November2026EliminationReason
): string {
  return \`Eliminated — progress was 0% through ${CUTOFF_LABEL}.\`;
}
`;
  const outPath = join(process.cwd(), 'src/november2026Elimination.ts');
  writeFileSync(outPath, content, 'utf-8');
  console.log(`Updated ${outPath} with ${sorted.length} eliminated email(s).`);
}

async function applyNovemberEliminations() {
  const [novemberCycle] = await db
    .select()
    .from(incentiveCycles)
    .where(and(eq(incentiveCycles.month, 11), eq(incentiveCycles.year, 2026)))
    .limit(1);

  if (!novemberCycle) {
    throw new Error('November 2026 cycle not found.');
  }

  const allGoals = await db.select().from(goals).where(eq(goals.cycleId, novemberCycle.id));
  const allProfiles = await db.select().from(profiles);

  const goalsByEmployee = new Map<string, Array<{ goalType: string; progressPercentage: number }>>();
  for (const g of allGoals) {
    const list = goalsByEmployee.get(g.employeeId) ?? [];
    list.push({ goalType: g.goalType, progressPercentage: g.progressPercentage });
    goalsByEmployee.set(g.employeeId, list);
  }

  const eliminatedEmails: string[] = [];
  const eliminatedProfiles: typeof profiles.$inferSelect[] = [];

  for (const [employeeId, inputs] of goalsByEmployee) {
    if (inputs.length === 0) continue;
    if (calculateLeaderboardProgress(inputs) !== 0) continue;

    const profile = allProfiles.find((p) => p.id === employeeId);
    if (!profile) continue;
    const email = profile.email.toLowerCase();
    if (NOVEMBER_2026_OPT_OUT_EMAILS.has(email)) continue;

    eliminatedEmails.push(email);
    eliminatedProfiles.push(profile);
  }

  if (eliminatedEmails.length === 0) {
    console.log('No zero-progress November profiles to eliminate.');
    return;
  }

  writeEliminationSourceFile(eliminatedEmails);

  const ids = eliminatedProfiles.map((p) => p.id);
  const removed = await db
    .delete(goals)
    .where(and(eq(goals.cycleId, novemberCycle.id), inArray(goals.employeeId, ids)))
    .returning({ id: goals.id, employeeId: goals.employeeId });

  console.log(
    `Removed ${removed.length} November goal(s) for ${eliminatedProfiles.length} eliminated people.\n`
  );

  const reason: November2026EliminationReason = 'zero_progress';
  const message = getNovember2026EliminationMessage(reason);

  for (const profile of eliminatedProfiles.sort((a, b) => a.fullName.localeCompare(b.fullName))) {
    const count = removed.filter((r) => r.employeeId === profile.id).length;
    console.log(`  ${profile.fullName}: ${count} goal(s) — ${message}`);
  }
}

applyNovemberEliminations().catch((err) => {
  console.error(err);
  process.exit(1);
});