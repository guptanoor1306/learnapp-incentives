import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { and, eq } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import { profiles, incentiveCycles, goals } from '../src/db/schema.ts';

function avgProgress(goalList: { progressPercentage: number }[]) {
  if (goalList.length === 0) return 0;
  const total = goalList.reduce((sum, goal) => sum + goal.progressPercentage, 0);
  return Math.round(total / goalList.length);
}

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
    const businessGoals = employeeGoals.filter((goal) => goal.goalType === 'business');
    const personalGoals = employeeGoals.filter((goal) => goal.goalType === 'personal');

    return {
      name: profile.fullName,
      department: profile.department,
      email: profile.email,
      businessPct: avgProgress(businessGoals),
      personalPct: avgProgress(personalGoals),
    };
  });

  const header = 'Name,Department,Email,Business Progress %,Personal Progress %';
  const body = rows
    .map((row) =>
      [
        escapeCsv(row.name),
        escapeCsv(row.department),
        escapeCsv(row.email),
        row.businessPct,
        row.personalPct,
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
