import { isOctober2026Cycle } from './cycleLock.ts';

export type October2026EliminationReason = 'not_approved' | 'zero_progress';

/** Progress was 0% through 15 Oct — removed from October incentive participation. */
export const OCTOBER_2026_ZERO_PROGRESS_EMAILS = new Set(
  [
    'aastha.gupta@learnapp.com',
    'akriti.singh@learnapp.com',
    'bhavya.oberoi@learnapp.com',
    'bratish.banerjee@learnapp.com',
    'deepak.kumar@learnapp.com',
    'divyanshu@learnapp.com',
    'harish@learnapp.com',
    'khushi.narula@learnapp.com',
    'manoj.kumar@learnapp.com',
    'mod.abid@learnapp.com',
    'mudhit.mehra@learnapp.com',
    'priyanshu.kumar@learnapp.com',
    'rohit@learnapp.com',
    'siya.khanna@learnapp.com',
    'tanya.khanna@learnapp.com',
    'wasim@learnapp.com',
  ].map((e) => e.toLowerCase())
);

const NOT_APPROVED_EXTRA_EMAILS = new Set(
  ['pranchal@learnapp.com', 'rishabh@learnapp.com'].map((e) => e.toLowerCase())
);

export type October2026EliminationProfile = {
  email?: string | null;
  department?: string | null;
};

export function getOctober2026EliminationReason(
  profile: October2026EliminationProfile | null | undefined,
  cycle: { month: number; year: number } | null | undefined
): October2026EliminationReason | null {
  if (!isOctober2026Cycle(cycle) || !profile?.email) return null;

  const email = profile.email.toLowerCase();

  if (profile.department === 'Technology' || NOT_APPROVED_EXTRA_EMAILS.has(email)) {
    return 'not_approved';
  }

  if (OCTOBER_2026_ZERO_PROGRESS_EMAILS.has(email)) {
    return 'zero_progress';
  }

  return null;
}

export function isOctober2026EliminatedProfile(
  profile: October2026EliminationProfile | null | undefined,
  cycle: { month: number; year: number } | null | undefined
): boolean {
  return getOctober2026EliminationReason(profile, cycle) !== null;
}

export function getOctober2026EliminationMessage(
  reason: October2026EliminationReason
): string {
  if (reason === 'not_approved') {
    return 'Goals not approved till the deadline.';
  }
  return 'Eliminated — progress was 0% through 15 October.';
}
