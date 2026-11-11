import 'dotenv/config';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import { cheers, goals, incentiveCycles, incentiveDecisions } from '../src/db/schema.ts';

const YEAR = 2026;
const MONTHS = [7, 8, 9];

const CONFIRM = process.argv.includes('--confirm');

async function purgeClosedCycleData() {
  if (!CONFIRM) {
    console.error('Destructive purge — re-run with --confirm');
    process.exit(1);
  }

  const cycles = await db
    .select()
    .from(incentiveCycles)
    .where(and(eq(incentiveCycles.year, YEAR), inArray(incentiveCycles.month, MONTHS)))
    .orderBy(incentiveCycles.month);

  if (cycles.length === 0) {
    throw new Error(`No cycles found for ${YEAR} months ${MONTHS.join(', ')}`);
  }

  for (const cycle of cycles) {
    const proofSizeResult = await db.execute(sql`
      SELECT COALESCE(SUM(LENGTH(COALESCE(p.external_url, ''))), 0)::bigint AS proof_bytes
      FROM proofs p
      INNER JOIN goals g ON g.id = p.goal_id
      WHERE g.cycle_id = ${cycle.id}::uuid
    `);
    const proof_bytes = Number((proofSizeResult.rows[0] as { proof_bytes: string }).proof_bytes);

    const decisionsRemoved = await db
      .delete(incentiveDecisions)
      .where(eq(incentiveDecisions.cycleId, cycle.id))
      .returning({ id: incentiveDecisions.id });

    const cheersRemoved = await db
      .delete(cheers)
      .where(eq(cheers.cycleId, cycle.id))
      .returning({ id: cheers.id });

    const goalsRemoved = await db
      .delete(goals)
      .where(eq(goals.cycleId, cycle.id))
      .returning({ id: goals.id });

    console.log(
      `${cycle.name}: ${goalsRemoved.length} goal(s), proofs (cascade), ` +
        `${decisionsRemoved.length} incentive decision(s), ${cheersRemoved.length} cheer(s); ` +
        `~${Math.round(Number(proof_bytes) / (1024 * 1024))} MB proof payload`
    );
  }

  console.log('Running VACUUM ANALYZE (may take a minute)...');
  await db.execute(sql`VACUUM ANALYZE`);

  const sizeResult = await db.execute(sql`
    SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size
  `);
  const db_size = (sizeResult.rows[0] as { db_size: string }).db_size;
  console.log(`Database size after purge: ${db_size}`);
}

purgeClosedCycleData().catch((err) => {
  console.error(err);
  process.exit(1);
});
