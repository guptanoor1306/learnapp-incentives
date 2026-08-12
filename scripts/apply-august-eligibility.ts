import 'dotenv/config';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import { profiles, incentiveCycles, goals, incentiveDecisions } from '../src/db/schema.ts';
import { AUGUST_2026_ELIGIBLE_EMAILS } from '../src/augustEligibility.ts';

async function applyAugustEligibility() {
  const [augustCycle] = await db
    .select()
    .from(incentiveCycles)
    .where(and(eq(incentiveCycles.month, 8), eq(incentiveCycles.year, 2026)))
    .limit(1);

  if (!augustCycle) {
    throw new Error('August 2026 cycle not found.');
  }

  const allProfiles = await db.select().from(profiles);
  const eligibleProfiles = allProfiles.filter((p) =>
    AUGUST_2026_ELIGIBLE_EMAILS.has(p.email.toLowerCase())
  );
  const ineligibleProfiles = allProfiles.filter(
    (p) => !AUGUST_2026_ELIGIBLE_EMAILS.has(p.email.toLowerCase())
  );

  if (eligibleProfiles.length !== 35) {
    console.warn(
      `Expected 35 eligible profiles, matched ${eligibleProfiles.length}. Check email casing in roster.`
    );
  }

  const ineligibleIds = ineligibleProfiles.map((p) => p.id);
  let deletedGoals: { id: string }[] = [];

  if (ineligibleIds.length > 0) {
    deletedGoals = await db
      .delete(goals)
      .where(and(eq(goals.cycleId, augustCycle.id), inArray(goals.employeeId, ineligibleIds)))
      .returning({ id: goals.id });
  }

  for (const profile of allProfiles) {
    const eligible = AUGUST_2026_ELIGIBLE_EMAILS.has(profile.email.toLowerCase());
    const status = eligible ? 'Eligible' : 'Not Eligible';

    const [existing] = await db
      .select({ id: incentiveDecisions.id })
      .from(incentiveDecisions)
      .where(
        and(
          eq(incentiveDecisions.employeeId, profile.id),
          eq(incentiveDecisions.cycleId, augustCycle.id)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(incentiveDecisions)
        .set({ eligibilityStatus: status, updatedAt: new Date() })
        .where(eq(incentiveDecisions.id, existing.id));
    } else {
      await db.insert(incentiveDecisions).values({
        employeeId: profile.id,
        cycleId: augustCycle.id,
        eligibilityStatus: status,
        paymentStatus: 'Pending',
      });
    }
  }

  console.log(`August 2026 eligibility applied.`);
  console.log(`Eligible: ${eligibleProfiles.length}`);
  console.log(`Ineligible: ${ineligibleProfiles.length}`);
  console.log(`Deleted ${deletedGoals.length} August goals for ineligible employees.`);
}

applyAugustEligibility().catch((err) => {
  console.error(err);
  process.exit(1);
});
