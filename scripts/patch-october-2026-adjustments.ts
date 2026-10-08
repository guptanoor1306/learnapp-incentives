import 'dotenv/config';
import { and, eq, ilike } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import { profiles, incentiveCycles, goals } from '../src/db/schema.ts';

const ABHISHEK_EMAIL = 'abhishek.sharma@learnapp.com';
const RISHABH_EMAIL = 'rishabh@learnapp.com';

const ABHISHEK_GOALS = [
  {
    goalType: 'personal' as const,
    title: 'Workout everyday',
    description: 'Workout everyday',
  },
  {
    goalType: 'business' as const,
    title: 'Test OPUS 5.5 to apply edits and animations to the ZERO1 OG short.',
    description: 'Figure out SOP to generate 4 videos a day, Talking head',
  },
];

async function patch() {
  const [octoberCycle] = await db
    .select()
    .from(incentiveCycles)
    .where(and(eq(incentiveCycles.month, 10), eq(incentiveCycles.year, 2026)))
    .limit(1);

  if (!octoberCycle) {
    throw new Error('October 2026 cycle not found.');
  }

  const allProfiles = await db.select().from(profiles);
  const rishabh =
    allProfiles.find((p) => p.email.toLowerCase() === RISHABH_EMAIL) ||
    allProfiles.find((p) => p.fullName.toLowerCase().includes('rishabh bangwal'));

  if (rishabh) {
    const removed = await db
      .delete(goals)
      .where(and(eq(goals.cycleId, octoberCycle.id), eq(goals.employeeId, rishabh.id)))
      .returning({ id: goals.id });
    console.log(`Removed ${removed.length} October goal(s) for ${rishabh.fullName} (no goals).`);
  } else {
    console.warn(`Profile not found: ${RISHABH_EMAIL}`);
  }

  const abhishek = allProfiles.find((p) => p.email.toLowerCase() === ABHISHEK_EMAIL);

  if (!abhishek) {
    throw new Error(`Profile not found: ${ABHISHEK_EMAIL}`);
  }

  const removedAbhishek = await db
    .delete(goals)
    .where(and(eq(goals.cycleId, octoberCycle.id), eq(goals.employeeId, abhishek.id)))
    .returning({ id: goals.id });
  console.log(`Cleared ${removedAbhishek.length} existing October goal(s) for ${abhishek.fullName}.`);

  for (const goal of ABHISHEK_GOALS) {
    await db.insert(goals).values({
      employeeId: abhishek.id,
      cycleId: octoberCycle.id,
      goalType: goal.goalType,
      title: goal.title,
      description: goal.description,
      successCriteria: JSON.stringify({
        type: 'percentage',
        target: 100,
        current: 0,
        text: 'Self-tracked via emojis',
      }),
      beyondBauExplanation: null,
      targetDate: '2026-10-31',
      progressPercentage: 0,
      status: 'Approved',
    });
  }
  console.log(`Inserted ${ABHISHEK_GOALS.length} October goals for ${abhishek.fullName}.`);
}

patch().catch((err) => {
  console.error(err);
  process.exit(1);
});
