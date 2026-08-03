import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { and, eq } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import { profiles, incentiveCycles, goals } from '../src/db/schema.ts';
import {
  averageGoalTypeProgress,
  calculateLeaderboardProgress,
} from '../src/progressMetrics.ts';

function escapeCsv(value: string | number) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function exportJulyProgress() {
  const [julyCycle] = await db
    .select()
    .from(incentiveCycles)
    .where(and(eq(incentiveCycles.month, 7), eq(incentiveCycles.year, 2026)))
    .limit(1);

  if (!julyCycle) {
    throw new Error('July 2026 cycle not found.');
  }

  const [allProfiles, julyGoals] = await Promise.all([
    db.select().from(profiles).orderBy(profiles.fullName),
    db.select().from(goals).where(eq(goals.cycleId, julyCycle.id)),
  ]);

  const rows = allProfiles.map((profile) => {
    const employeeGoals = julyGoals.filter((goal) => goal.employeeId === profile.id);
    const goalInputs = employeeGoals.map((goal) => ({
      goalType: goal.goalType,
      progressPercentage: goal.progressPercentage,
    }));

    return {
      name: profile.fullName,
      department: profile.department,
      email: profile.email,
      businessPct: averageGoalTypeProgress(goalInputs, 'business'),
      personalPct: averageGoalTypeProgress(goalInputs, 'personal'),
      finalPct: calculateLeaderboardProgress(goalInputs),
    };
  });

  const header = 'Name,Department,Email,Business Progress %,Personal Progress %,Final Progress %';
  const body = rows
    .map((row) =>
      [
        escapeCsv(row.name),
        escapeCsv(row.department),
        escapeCsv(row.email),
        row.businessPct,
        row.personalPct,
        row.finalPct,
      ].join(',')
    )
    .join('\n');

  const csv = `${header}\n${body}\n`;
  const outDir = join(process.cwd(), 'exports');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'july-2026-progress.csv');
  writeFileSync(outPath, csv, 'utf-8');

  console.log(`Exported ${rows.length} rows to ${outPath}`);
  console.log('\n' + csv);
}

exportJulyProgress().catch((err) => {
  console.error(err);
  process.exit(1);
});
