import { isNovember2026Cycle } from './cycleLock.ts';

/** Synced from November CSV via npm run seed:nov-goals (OPT OUT rows). */
export const NOVEMBER_2026_OPT_OUT_EMAILS = new Set(
  [
    'abhishek@learnapp.com',
    'aman.ghosh@learnapp.com',
    'anish@learnapp.com',
    'raj@learnapp.com',
    'rishabh@learnapp.com',
    'shreya@learnapp.com',
    'tanya.khanna@learnapp.com',
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
