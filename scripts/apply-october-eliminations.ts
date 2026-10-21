import 'dotenv/config';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import { profiles, incentiveCycles, goals } from '../src/db/schema.ts';
import {
  getOctober2026EliminationReason,
  getOctober2026EliminationMessage,
} from '../src/october2026Elimination.ts';

async function applyOctoberEliminations() {
  const [octoberCycle] = await db
    .select()
    .from(incentiveCycles)
    .where(and(eq(incentiveCycles.month, 10), eq(incentiveCycles.year, 2026)))
    .limit(1);

  if (!octoberCycle) {
    throw new Error('October 2026 cycle not found.');
  }

  const allProfiles = await db.select().from(profiles);
  const eliminated = allProfiles.filter(
    (p) => getOctober2026EliminationReason(p, octoberCycle) !== null
  );

  if (eliminated.length === 0) {
    console.log('No eliminated profiles matched.');
    return;
  }

  const ids = eliminated.map((p) => p.id);
  const removed = await db
    .delete(goals)
    .where(and(eq(goals.cycleId, octoberCycle.id), inArray(goals.employeeId, ids)))
    .returning({ id: goals.id, employeeId: goals.employeeId });

  console.log(`Removed ${removed.length} October goal(s) for ${eliminated.length} eliminated people.\n`);

  for (const profile of eliminated.sort((a, b) => a.fullName.localeCompare(b.fullName))) {
    const reason = getOctober2026EliminationReason(profile, octoberCycle)!;
    const count = removed.filter((r) => r.employeeId === profile.id).length;
    console.log(
      `  ${profile.fullName}: ${count} goal(s) — ${getOctober2026EliminationMessage(reason)}`
    );
  }
}

applyOctoberEliminations().catch((err) => {
  console.error(err);
  process.exit(1);
});
