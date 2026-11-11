import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
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

function isOptOutMarker(text: string) {
  return text.trim().toLowerCase() === 'opt out';
}

function collectOptOutMembers(content: string): Set<string> {
  const rows = parseCsv(content);
  const optOut = new Set<string>();
  let currentMember = '';

  for (const row of rows.slice(1)) {
    const memberCell = (row[2] || '').trim();
    const titleCell = (row[4] || '').trim();
    const descriptionCell = (row[5] || '').trim();
    if (memberCell) currentMember = memberCell;
    if (!currentMember) continue;
    if (isOptOutMarker(titleCell) || isOptOutMarker(descriptionCell)) {
      optOut.add(currentMember);
    }
  }

  return optOut;
}

function parseGoalsFromCsv(content: string, optOutMembers: Set<string>): ParsedGoal[] {
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
    if (optOutMembers.has(currentMember)) continue;
    if (goalTypeCell !== 'personal' && goalTypeCell !== 'business') continue;
    if (isOptOutMarker(titleCell) || isOptOutMarker(descriptionCell)) continue;
    if (finalApproval !== 'approved') continue;
    if (managerApproval === 'not approved') continue;

    const title = titleCell || descriptionCell.slice(0, 120);
    const description = descriptionCell || titleCell;
    if (!title && !description) continue;

    parsed.push({
      department: currentDepartment,
      teamMemberName: currentMember,
      goalType: goalTypeCell as 'personal' | 'business',
      title,
      description,
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
  aman: 'aman ghosh',
  anish: 'anish mohan',
  'abhishek rathore': 'abhishek rathore',
  tanya: 'tanya khanna',
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

function writeOptOutSourceFile(emails: string[]) {
  const sorted = [...new Set(emails.map((e) => e.toLowerCase()))].sort();
  const body = sorted.map((e) => `    '${e}',`).join('\n');
  const content = `import { isNovember2026Cycle } from './cycleLock.ts';

/** Synced from November CSV via npm run seed:nov-goals (OPT OUT rows). */
export const NOVEMBER_2026_OPT_OUT_EMAILS = new Set(
  [
${body}
  ].map((e) => e.toLowerCase())
);

export function isNovember2026OptOutProfile(
  profile: { email?: string | null } | null | undefined,
  cycle: { month: number; year: number } | null | undefined
): boolean {
  if (!isNovember2026Cycle(cycle) || !profile?.email) return false;
  return NOVEMBER_2026_OPT_OUT_EMAILS.has(profile.email.toLowerCase());
}

export const NOVEMBER_2026_OPT_OUT_MESSAGE =
  'Opted out of November 2026 incentives.';
`;
  const outPath = join(process.cwd(), 'src/november2026OptOut.ts');
  writeFileSync(outPath, content, 'utf-8');
  console.log(`Updated ${outPath} with ${sorted.length} opt-out email(s).`);
}

async function importNovemberGoals() {
  const csvArgIndex = process.argv.findIndex((arg) => arg.endsWith('.csv'));
  const csvPath =
    csvArgIndex >= 0
      ? process.argv[csvArgIndex]
      : '/Users/noorgupta/Downloads/Goals & Incentives - Nov (1).csv';

  const csvContent = readFileSync(csvPath, 'utf-8');
  const optOutMembers = collectOptOutMembers(csvContent);
  const parsedGoals = parseGoalsFromCsv(csvContent, optOutMembers);

  const [novemberCycle] = await db
    .select()
    .from(incentiveCycles)
    .where(and(eq(incentiveCycles.month, 11), eq(incentiveCycles.year, 2026)))
    .limit(1);

  if (!novemberCycle) {
    throw new Error('November 2026 cycle not found. Run npm run seed first.');
  }

  const allProfiles = await db.select().from(profiles);

  const optOutProfiles: typeof profiles.$inferSelect[] = [];
  for (const member of optOutMembers) {
    const profile = findProfile(member, allProfiles);
    if (profile) optOutProfiles.push(profile);
    else console.warn(`OPT OUT: could not match profile for "${member}"`);
  }

  writeOptOutSourceFile(optOutProfiles.map((p) => p.email));

  const optOutIds = optOutProfiles.map((p) => p.id);
  if (optOutIds.length > 0) {
    const cleared = await db
      .delete(goals)
      .where(
        and(eq(goals.cycleId, novemberCycle.id), inArray(goals.employeeId, optOutIds))
      )
      .returning({ id: goals.id });
    console.log(`Cleared ${cleared.length} November goal(s) for ${optOutProfiles.length} opt-out profiles.`);
  }

  const missingMembers = new Set<string>();
  const resolved: Array<{ profile: typeof profiles.$inferSelect; goal: ParsedGoal }> = [];

  for (const goal of parsedGoals) {
    const profile = findProfile(goal.teamMemberName, allProfiles);
    if (!profile) {
      missingMembers.add(`${goal.teamMemberName} (${goal.department})`);
      continue;
    }
    if (optOutIds.includes(profile.id)) continue;
    resolved.push({ profile, goal });
  }

  const employeeIds = [...new Set(resolved.map((entry) => entry.profile.id))];
  if (REPLACE && employeeIds.length > 0) {
    const deleted = await db
      .delete(goals)
      .where(and(eq(goals.cycleId, novemberCycle.id), inArray(goals.employeeId, employeeIds)))
      .returning({ id: goals.id });
    if (deleted.length > 0) {
      console.log(`Removed ${deleted.length} existing November goals for employees being re-imported.`);
    }
  }

  let inserted = 0;
  for (const { profile, goal } of resolved) {
    await db.insert(goals).values({
      employeeId: profile.id,
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
    inserted++;
  }

  console.log(`Imported ${inserted} November goals into "${novemberCycle.name}".`);
  console.log(`OPT OUT members (${optOutMembers.size}):`, [...optOutMembers].join(', '));
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

importNovemberGoals().catch((err) => {
  console.error(err);
  process.exit(1);
});
