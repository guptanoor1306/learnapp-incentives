import 'dotenv/config';
import { readFileSync } from 'fs';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import { profiles, incentiveCycles, goals } from '../src/db/schema.ts';

const REPLACE = process.argv.includes('--replace');

const DEPARTMENT_ALIASES: Record<string, string> = {
  tech: 'Technology',
  technology: 'Technology',
  product: 'Product',
  graphics: 'Graphics',
  content: 'Content 1',
  varsity: 'Varsity',
  zo: 'Zerodha Online',
  'zerodha online': 'Zerodha Online',
  'pre prod': 'Pre-production',
  'pre-production': 'Pre-production',
  'editing 1': 'Editing 1',
  'editing 2': 'Editing 2',
  social: 'Social',
  sound: 'Sound',
  business: 'Partnerships',
  hr: 'HR',
};

type ParsedGoal = {
  department: string;
  teamMemberName: string;
  goalType: 'personal' | 'business';
  title: string;
  description: string;
  approved: boolean;
};

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i++;
      row.push(field);
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  }

  return rows;
}

function normalizeDepartment(value: string) {
  const key = value.trim().toLowerCase();
  return DEPARTMENT_ALIASES[key] || value.trim();
}

function parseGoalsFromCsv(content: string): ParsedGoal[] {
  const rows = parseCsv(content);
  const parsed: ParsedGoal[] = [];

  let currentDepartment = '';
  let currentMember = '';

  for (const row of rows.slice(1)) {
    const deptCell = (row[0] || '').trim();
    const memberCell = (row[2] || '').trim();
    const goalTypeCell = (row[3] || '').trim().toLowerCase();
    const titleCell = (row[4] || '').trim();
    const descriptionCell = (row[5] || '').trim();
    const managerApproval = (row[6] || '').trim().toLowerCase();
    const finalApproval = (row[7] || '').trim().toLowerCase();

    if (deptCell) currentDepartment = normalizeDepartment(deptCell);
    if (memberCell) currentMember = memberCell;

    if (!currentDepartment || !currentMember) continue;
    if (goalTypeCell !== 'personal' && goalTypeCell !== 'business') continue;

    const approved =
      managerApproval === 'approved' ||
      finalApproval === 'approved' ||
      (managerApproval !== 'not approved' && finalApproval !== 'not approved' && managerApproval.length === 0 && finalApproval.length === 0);

    if (managerApproval === 'not approved' || finalApproval === 'not approved') {
      continue;
    }

    const title = titleCell || descriptionCell.slice(0, 120);
    const description = descriptionCell || titleCell;
    if (!title && !description) continue;

    parsed.push({
      department: currentDepartment,
      teamMemberName: currentMember,
      goalType: goalTypeCell as 'personal' | 'business',
      title,
      description,
      approved,
    });
  }

  return parsed;
}

function findProfile(teamMemberName: string, allProfiles: typeof profiles.$inferSelect[]) {
  const needle = teamMemberName.trim().toLowerCase();
  return allProfiles.find((profile) => {
    const full = profile.fullName.toLowerCase();
    const first = full.split(/\s+/)[0];
    return full === needle || full.startsWith(`${needle} `) || first === needle;
  });
}

async function importSeptemberGoals() {
  const csvArgIndex = process.argv.findIndex((arg) => arg.endsWith('.csv'));
  const csvPath =
    csvArgIndex >= 0
      ? process.argv[csvArgIndex]
      : '/Users/noorgupta/Downloads/Goals & Incentives - Sept.csv';

  const deptFlagIndex = process.argv.findIndex((arg) => arg === '--department');
  const departmentFilter =
    deptFlagIndex >= 0 ? normalizeDepartment(process.argv[deptFlagIndex + 1] || '') : null;

  const csvContent = readFileSync(csvPath, 'utf-8');
  const parsedGoals = parseGoalsFromCsv(csvContent);
  const goalsToImport = departmentFilter
    ? parsedGoals.filter((goal) => goal.department === departmentFilter)
    : parsedGoals;

  const [septemberCycle] = await db
    .select()
    .from(incentiveCycles)
    .where(and(eq(incentiveCycles.month, 9), eq(incentiveCycles.year, 2026)))
    .limit(1);

  if (!septemberCycle) {
    throw new Error('September 2026 cycle not found. Run npm run seed first.');
  }

  const allProfiles = await db.select().from(profiles);
  const missingMembers = new Set<string>();
  const resolved: Array<{ profile: typeof profiles.$inferSelect; goal: ParsedGoal }> = [];

  for (const goal of goalsToImport) {
    const profile = findProfile(goal.teamMemberName, allProfiles);
    if (!profile) {
      missingMembers.add(`${goal.teamMemberName} (${goal.department})`);
      continue;
    }
    resolved.push({ profile, goal });
  }

  if (REPLACE) {
    const employeeIds = [...new Set(resolved.map((entry) => entry.profile.id))];
    if (employeeIds.length > 0) {
      const deleted = await db
        .delete(goals)
        .where(
          and(eq(goals.cycleId, septemberCycle.id), inArray(goals.employeeId, employeeIds))
        )
        .returning({ id: goals.id });
      if (deleted.length > 0) {
        console.log(`Removed ${deleted.length} existing September goals for selected employees.`);
      }
    }
  }

  let inserted = 0;
  for (const { profile, goal } of resolved) {
    await db.insert(goals).values({
      employeeId: profile.id,
      cycleId: septemberCycle.id,
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
      targetDate: '2026-09-30',
      progressPercentage: 0,
      status: 'Approved',
    });
    inserted++;
  }

  console.log(`Imported ${inserted} September goals into "${septemberCycle.name}".`);
  if (departmentFilter) {
    console.log(`Department filter: ${departmentFilter}`);
  }
  if (missingMembers.size > 0) {
    console.log('Profiles not matched:', [...missingMembers].join(', '));
  }

  const byPerson = new Map<string, number>();
  for (const { profile } of resolved) {
    byPerson.set(profile.fullName, (byPerson.get(profile.fullName) || 0) + 1);
  }
  for (const [name, count] of [...byPerson.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${name}: ${count} goals`);
  }
}

importSeptemberGoals().catch((err) => {
  console.error(err);
  process.exit(1);
});
