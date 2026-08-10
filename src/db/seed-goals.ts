import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { and, eq } from 'drizzle-orm';
import { profiles, incentiveCycles, goals } from './schema.ts';
import { getPoolConfig } from './poolConfig.ts';

dotenv.config();

const REPLACE = process.argv.includes('--replace');

interface JulyGoalRow {
  name: string;
  goalType: 'personal' | 'business';
  title: string;
  description: string;
}

async function seedJulyGoals() {
  const pool = new Pool(getPoolConfig());
  const db = drizzle(pool);
  const jsonPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'july-goals.json');
  const julyGoals: JulyGoalRow[] = JSON.parse(readFileSync(jsonPath, 'utf-8'));

  console.log(`Loading ${julyGoals.length} July goals...`);

  try {
    const [julyCycle] = await db
      .select()
      .from(incentiveCycles)
      .where(and(eq(incentiveCycles.month, 7), eq(incentiveCycles.year, 2026)))
      .limit(1);

    if (!julyCycle) throw new Error('July 2026 cycle not found. Run npm run seed first.');

    const allProfiles = await db.select().from(profiles);
    const profileByName = new Map(allProfiles.map((p) => [p.fullName, p]));

    if (REPLACE) {
      const existing = await db.select({ id: goals.id }).from(goals).where(eq(goals.cycleId, julyCycle.id));
      if (existing.length > 0) {
        await db.delete(goals).where(eq(goals.cycleId, julyCycle.id));
        console.log(`Removed ${existing.length} existing July goals.`);
      }
    }

    let inserted = 0;
    const missing = new Set<string>();

    for (const row of julyGoals) {
      const profile = profileByName.get(row.name);
      if (!profile) {
        missing.add(row.name);
        continue;
      }

      await db.insert(goals).values({
        employeeId: profile.id,
        cycleId: julyCycle.id,
        goalType: row.goalType,
        title: row.title,
        description: row.description,
        successCriteria: JSON.stringify({ type: 'percentage', target: 100, current: 0, text: 'Self-tracked via emojis' }),
        beyondBauExplanation: null,
        targetDate: '2026-07-31',
        progressPercentage: 0,
        status: 'Approved',
      });
      inserted++;
    }

    console.log(`Inserted ${inserted} July goals into "${julyCycle.name}".`);
    if (missing.size > 0) console.log('Profiles not found:', [...missing].join(', '));
  } catch (err) {
    console.error('Error seeding July goals:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seedJulyGoals();
