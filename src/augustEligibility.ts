import { isAugust2026Cycle } from './cycleLock.ts';

export { isAugust2026Cycle };

/** August 2026 incentive participants: submitted ≥1 goal by 6 Aug EOD IST, minus Chandan (no business goal) and Dheeraj. */
export const AUGUST_2026_ELIGIBLE_EMAILS = new Set(
  [
    'abhishek.sharma@learnapp.com',
    'abhishek.shukla@learnapp.com',
    'ajay.rawat@learnapp.com',
    'aman@learnapp.com',
    'aman.ghosh@learnapp.com',
    'amit.joshi@learnapp.com',
    'anish@learnapp.com',
    'ankush.choudhary@learnapp.com',
    'anmol@learnapp.com',
    'anubha@learnapp.com',
    'ashutosh.kaushik@learnapp.com',
    'bhavya.oberoi@learnapp.com',
    'deepak.kumar@learnapp.com',
    'harish@learnapp.com',
    'harshita.varshney@learnapp.com',
    'ishika.badal@learnapp.com',
    'mayank.chauhan@learnapp.com',
    'naveen.tiwari@learnapp.com',
    'nishita.gupta@learnapp.com',
    'noor@learnapp.com',
    'piyush@learnapp.com',
    'pranchal@learnapp.com',
    'priyanshu.kumar@learnapp.com',
    'pulkit@learnapp.com',
    'rahul@learnapp.com',
    'raj@learnapp.com',
    'rakhi.dhama@learnapp.com',
    'rishabh@learnapp.com',
    'satyavrat.sharma@learnapp.com',
    'supriya@learnapp.com',
    'swatijuyal@learnapp.com',
    'tilak.mahawar@learnapp.com',
    'tushar.kumar@learnapp.com',
    'vaishnavi.mishra@learnapp.com',
  ].map((e) => e.toLowerCase())
);

export function isAugust2026EligibleEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return AUGUST_2026_ELIGIBLE_EMAILS.has(email.toLowerCase());
}

export function isAugust2026EligibleProfile(
  profile: { email: string } | null | undefined,
  cycle: { month: number; year: number } | null | undefined
): boolean {
  if (!isAugust2026Cycle(cycle)) return true;
  return isAugust2026EligibleEmail(profile?.email);
}
