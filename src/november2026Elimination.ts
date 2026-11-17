import { isNovember2026Cycle } from './cycleLock.ts';

export type November2026EliminationReason = 'zero_progress';

/** Progress was 0% through 17 November — synced via npm run apply:nov-eliminations. */
export const NOVEMBER_2026_ZERO_PROGRESS_EMAILS = new Set(
  [
    'aalim.abbasi@learnapp.com',
    'aastha.gupta@learnapp.com',
    'abhishek.sharma@learnapp.com',
    'ajay.rawat@learnapp.com',
    'anjali@learnapp.com',
    'apoorv.suman@learnapp.com',
    'bhavya.menon@learnapp.com',
    'deepak@learnapp.com',
    'dheeraj.rajvania@learnapp.com',
    'divyanshu@learnapp.com',
    'harish@learnapp.com',
    'harshita.varshney@learnapp.com',
    'ishika.badal@learnapp.com',
    'khushi.narula@learnapp.com',
    'manoj.kumar@learnapp.com',
    'mod.abid@learnapp.com',
    'mudhit.mehra@learnapp.com',
    'nishita.gupta@learnapp.com',
    'pulkit@learnapp.com',
    'rahul@learnapp.com',
    'siya.khanna@learnapp.com',
    'tilak.mahawar@learnapp.com',
    'vaibhav@learnapp.com',
  ].map((e) => e.toLowerCase())
);

export type November2026EliminationProfile = {
  email?: string | null;
};

export function getNovember2026EliminationReason(
  profile: November2026EliminationProfile | null | undefined,
  cycle: { month: number; year: number } | null | undefined
): November2026EliminationReason | null {
  if (!isNovember2026Cycle(cycle) || !profile?.email) return null;
  const email = profile.email.toLowerCase();
  if (NOVEMBER_2026_ZERO_PROGRESS_EMAILS.has(email)) return 'zero_progress';
  return null;
}

export function isNovember2026EliminatedProfile(
  profile: November2026EliminationProfile | null | undefined,
  cycle: { month: number; year: number } | null | undefined
): boolean {
  return getNovember2026EliminationReason(profile, cycle) !== null;
}

export function getNovember2026EliminationMessage(
  _reason: November2026EliminationReason
): string {
  return `Eliminated — progress was 0% through 17 November.`;
}
