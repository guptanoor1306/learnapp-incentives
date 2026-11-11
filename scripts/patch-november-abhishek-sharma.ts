import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import { profiles, incentiveCycles, goals } from '../src/db/schema.ts';

const ABHISHEK_EMAIL = 'abhishek.sharma@learnapp.com';

const NOVEMBER_GOALS = [
  {
    goalType: 'personal' as const,
    title: 'Solo travelling and camping in car',
    description: 'Solo travelling and camping in car',
  },
  {
    goalType: 'business' as const,
    title: 'Experimenting with new IP for OG shorts',
    description: `1. Salary Breakdown
2. ₹1 Lakh Challenge
3. Comment-Based IP`,
  },
];

async function patch() {
  const [novemberCycle] = await db
    .select()
    .from(incentiveCycles)
    .where(and(eq(incentiveCycles.month, 11), eq(incentiveCycles.year, 2026)))
    .limit(1);

  if (!novemberCycle) {
    throw new Error('November 2026 cycle not found.');
  }

  const [abhishek] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.email, ABHISHEK_EMAIL))
    .limit(1);

  if (!abhishek) {
    throw new Error(`Profile not found: ${ABHISHEK_EMAIL}`);
  }

  const removed = await db
    .delete(goals)
    .where(and(eq(goals.cycleId, novemberCycle.id), eq(goals.employeeId, abhishek.id)))
    .returning({ id: goals.id });
  console.log(`Cleared ${removed.length} November goal(s) for ${abhishek.fullName}.`);

  for (const goal of NOVEMBER_GOALS) {
    await db.insert(goals).values({
      employeeId: abhishek.id,
      cycleId: novemberCycle.id,
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
      targetDate: '2026-11-30',
      progressPercentage: 0,
      status: 'Approved',
    });
  }
  console.log(`Inserted ${NOVEMBER_GOALS.length} November goals for ${abhishek.fullName}.`);
}

patch().catch((err) => {
  console.error(err);
  process.exit(1);
});
