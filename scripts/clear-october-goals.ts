import 'dotenv/config';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import { profiles, incentiveCycles, goals } from '../src/db/schema.ts';

/** October 2026: roster members who should show in "no goals" (no CSV import). */
const NO_OCTOBER_GOAL_EMAILS = [
  'rishabh@learnapp.com',
  'tushar.kumar@learnapp.com',
];

async function clearOctoberGoals() {
  const [octoberCycle] = await db
    .select()
    .from(incentiveCycles)
    .where(and(eq(incentiveCycles.month, 10), eq(incentiveCycles.year, 2026)))
    .limit(1);

  if (!octoberCycle) {
    throw new Error('October 2026 cycle not found.');
  }

  const allProfiles = await db.select().from(profiles);
  const targets = allProfiles.filter((p) =>
    NO_OCTOBER_GOAL_EMAILS.includes(p.email.toLowerCase())
  );

  if (targets.length === 0) {
    console.warn('No matching profiles for:', NO_OCTOBER_GOAL_EMAILS.join(', '));
    return;
  }

  const ids = targets.map((p) => p.id);
  const removed = await db
    .delete(goals)
    .where(and(eq(goals.cycleId, octoberCycle.id), inArray(goals.employeeId, ids)))
    .returning({ id: goals.id, employeeId: goals.employeeId });

  for (const profile of targets) {
    const count = removed.filter((r) => r.employeeId === profile.id).length;
    console.log(`${profile.fullName} (${profile.email}): removed ${count} October goal(s).`);
  }
}

clearOctoberGoals().catch((err) => {
  console.error(err);
  process.exit(1);
});
