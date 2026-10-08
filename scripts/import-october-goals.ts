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
  preprod: 'Pre-production',
  'preprod.': 'Pre-production',
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

function shouldSkipPerson(department: string, teamMemberName: string) {
  if (department === 'Technology') return true;
  if (department === 'Graphics' && teamMemberName.trim().toLowerCase() === 'pranchal') {
    return true;
  }
  return false;
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
    if (shouldSkipPerson(currentDepartment, currentMember)) continue;
    if (goalTypeCell !== 'personal' && goalTypeCell !== 'business') continue;

    const title = titleCell || descriptionCell.slice(0, 120);
    const description = descriptionCell || titleCell;
    if (!title && !description) continue;

    const notApproved =
      managerApproval === 'not approved' || finalApproval === 'not approved';

    parsed.push({
      department: currentDepartment,
      teamMemberName: currentMember,
      goalType: goalTypeCell as 'personal' | 'business',
      title,
      description,
      approved: !notApproved,
    });
  }

  return parsed;
}

const TEAM_MEMBER_ALIASES: Record<string, string> = {
  'kumar priyanshu': 'priyanshu kumar',
  'deepak ch': 'deepak ch.',
  abid: 'mod abid',
  wasim: 'md wasim',
  'deepak k': 'deepak kumar',
  amandeep: 'aman deep',
  sahil: 'sahil mathur',
  shuchita: 'shuchita kumar',
  rohit: 'rohit sondhi',
  apoorv: 'apoorv suman',
  anmol: 'anmol anand',
  vikas: 'vikas kumar',
  bratish: 'bratish kanti banerjee',
  harish: 'harish rawat',
  aastha: 'aastha gupta',
  satyam: 'satyam',
  'abhishhek shukla': 'abhishek shukla',
  'abhishek shukla': 'abhishek shukla',
};

function findProfile(teamMemberName: string, allProfiles: typeof profiles.$inferSelect[]) {
  const needle = teamMemberName.trim().toLowerCase();
  const search = TEAM_MEMBER_ALIASES[needle] || needle;

  return allProfiles.find((profile) => {
    const full = profile.fullName.toLowerCase();
    const parts = full.split(/\s+/);
    const first = parts[0];
    const searchParts = search.split(/\s+/).filter(Boolean);

    if (searchParts.length > 1 && searchParts.every((part) => full.includes(part))) {
      return true;
    }

    return (
      full === search ||
      full.startsWith(`${search} `) ||
      first === search ||
      full.replace(/\./g, '').includes(search.replace(/\./g, ''))
    );
  });
}

function isSkippedProfile(profile: typeof profiles.$inferSelect) {
  if (profile.department === 'Technology') return true;
  if (profile.email.toLowerCase() === 'pranchal@learnapp.com') return true;
  return false;
}

async function importOctoberGoals() {
  const csvArgIndex = process.argv.findIndex((arg) => arg.endsWith('.csv'));
  const csvPath =
    csvArgIndex >= 0
      ? process.argv[csvArgIndex]
      : '/Users/noorgupta/Downloads/Goals & Incentives - Oct.csv';

  const deptFlagIndex = process.argv.findIndex((arg) => arg === '--department');
  const departmentFilter =
    deptFlagIndex >= 0 ? normalizeDepartment(process.argv[deptFlagIndex + 1] || '') : null;

  const csvContent = readFileSync(csvPath, 'utf-8');
  const parsedGoals = parseGoalsFromCsv(csvContent);
  const goalsToImport = departmentFilter
    ? parsedGoals.filter((goal) => goal.department === departmentFilter)
    : parsedGoals;

  const [octoberCycle] = await db
    .select()
    .from(incentiveCycles)
    .where(and(eq(incentiveCycles.month, 10), eq(incentiveCycles.year, 2026)))
    .limit(1);

  if (!octoberCycle) {
    throw new Error('October 2026 cycle not found. Run npm run seed first.');
  }

  const allProfiles = await db.select().from(profiles);

  const skippedProfileIds = allProfiles.filter(isSkippedProfile).map((p) => p.id);
  if (skippedProfileIds.length > 0) {
    const cleared = await db
      .delete(goals)
      .where(
        and(eq(goals.cycleId, octoberCycle.id), inArray(goals.employeeId, skippedProfileIds))
      )
      .returning({ id: goals.id });
    console.log(
      `Cleared ${cleared.length} October goal(s) for Technology team and Pranchal (${skippedProfileIds.length} profiles).`
    );
  }

  const missingMembers = new Set<string>();
  const resolved: Array<{ profile: typeof profiles.$inferSelect; goal: ParsedGoal }> = [];

  for (const goal of goalsToImport) {
    const profile = findProfile(goal.teamMemberName, allProfiles);
    if (!profile) {
      missingMembers.add(`${goal.teamMemberName} (${goal.department})`);
      continue;
    }
    if (isSkippedProfile(profile)) continue;
    resolved.push({ profile, goal });
  }

  const employeeIds = [...new Set(resolved.map((entry) => entry.profile.id))];
  if (REPLACE && employeeIds.length > 0) {
    const deleted = await db
      .delete(goals)
      .where(and(eq(goals.cycleId, octoberCycle.id), inArray(goals.employeeId, employeeIds)))
      .returning({ id: goals.id });
    if (deleted.length > 0) {
      console.log(`Removed ${deleted.length} existing October goals for employees being re-imported.`);
    }
  }

  let inserted = 0;
  for (const { profile, goal } of resolved) {
    await db.insert(goals).values({
      employeeId: profile.id,
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
      status: goal.approved ? 'Approved' : 'Pending Approval',
    });
    inserted++;
  }

  console.log(`Imported ${inserted} October goals into "${octoberCycle.name}".`);
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
  console.log(`\n${byPerson.size} people with imported goals:`);
  for (const [name, count] of [...byPerson.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${name}: ${count} goals`);
  }
}

importOctoberGoals().catch((err) => {
  console.error(err);
  process.exit(1);
});
