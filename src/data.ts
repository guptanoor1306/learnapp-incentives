// Seeded goals pre-fed for LearnApp employees (simulating the Excel sheet feed)
export interface SeededGoal {
  employeeName: string;
  department: string;
  title: string;
  description: string;
  metricType: 'percentage' | 'numeric' | 'binary';
  target: number;
  current: number;
  status: 'Approved' | 'Achieved' | 'Under Final Review' | 'Draft' | 'Pending Approval';
  successCriteria: string;
  beyondBauExplanation?: string;
  streak: number;
  goalType?: 'personal' | 'business';
}

export const SEEDED_GOALS: SeededGoal[] = [];

export const DEPARTMENTS = [
  "All",
  "Product",
  "Technology",
  "Zerodha Online",
  "Varsity",
  "Partnerships",
  "Graphics",
  "Sound",
  "Editing 1",
  "Editing 2",
  "Content 1",
  "Content 2",
  "Social",
  "Pre-production",
  "HR"
];

export const DEPARTMENT_COLORS: Record<string, string> = {
  "Product": "from-[#ff0055] to-[#ff5500]",
  "Technology": "from-[#00ffcc] to-[#0099ff]",
  "Zerodha Online": "from-[#00ff7f] to-[#00b55b]",
  "Varsity": "from-[#ffaa00] to-[#ff5500]",
  "Partnerships": "from-[#cc00ff] to-[#7700ff]",
  "Graphics": "from-[#ff00ff] to-[#ff0055]",
  "Sound": "from-[#00ffff] to-[#0000ff]",
  "Editing 1": "from-[#ffff00] to-[#ffaa00]",
  "Editing 2": "from-[#00ff00] to-[#009900]",
  "Content 1": "from-[#ff3300] to-[#ff0055]",
  "Content 2": "from-[#3300ff] to-[#cc00ff]",
  "Social": "from-[#ff0066] to-[#ff3300]",
  "Pre-production": "from-[#00ff99] to-[#00ffff]",
  "HR": "from-[#ff00ff] to-[#9900ff]"
};

// Smileys array corresponding to progress:
// Index 0: 💩 (Poop) - 0% - 19%
// Index 1: 😐 (Poker) - 20% - 44%
// Index 2: 🙂 (Good) - 45% - 69%
// Index 3: 😍 (Love) - 70% - 94%
// Index 4: 🚀 (Rocket) - 95% - 100%
export interface SmileyOption {
  label: string;
  emoji: string;
  color: string;
  desc: string;
  percentageRange: [number, number];
}

export const SMILEYS: SmileyOption[] = [
  { label: "Poop", emoji: "💩", color: "text-amber-700 shadow-amber-900/30", desc: "Just getting started / Sh*t level", percentageRange: [0, 19] },
  { label: "Meh", emoji: "😐", color: "text-gray-400 shadow-gray-700/30", desc: "Barely moving", percentageRange: [20, 44] },
  { label: "Good", emoji: "🙂", color: "text-blue-400 shadow-blue-500/30", desc: "Solid progress", percentageRange: [45, 69] },
  { label: "Love", emoji: "😍", color: "text-pink-400 shadow-pink-500/30", desc: "Killing it!", percentageRange: [70, 94] },
  { label: "Rocket", emoji: "🚀", color: "text-emerald-400 shadow-emerald-500/30", desc: "Milestone crushed!", percentageRange: [95, 100] }
];

export function getSmileyForPercentage(pct: number): SmileyOption {
  if (pct < 20) return SMILEYS[0];
  if (pct < 45) return SMILEYS[1];
  if (pct < 70) return SMILEYS[2];
  if (pct < 95) return SMILEYS[3];
  return SMILEYS[4];
}

export function formatCultMilestone(
  type: 'percentage' | 'numeric' | 'binary',
  target: number,
  current: number
): { heading: string; detail: string; stepsAway: number; isComplete: boolean } {
  const safeTarget = target || 1;
  const safeCurrent = Math.min(Math.max(current || 0, 0), safeTarget);
  
  if (type === 'numeric') {
    const isComplete = safeCurrent >= safeTarget;
    const remaining = safeTarget - safeCurrent;
    return {
      heading: isComplete ? "Okay, you reached this milestone! 🎉" : `You completed ${safeCurrent} of ${safeTarget}!`,
      detail: isComplete 
        ? "Awesome work! Let's conquer the next summit." 
        : `You have ${remaining} more to go to reach your goal.`,
      stepsAway: remaining,
      isComplete
    };
  } else if (type === 'binary') {
    const isComplete = safeCurrent === 1;
    return {
      heading: isComplete ? "Okay, you reached this milestone! 🎉" : "Milestone Pending",
      detail: isComplete 
        ? "Task is fully marked as accomplished!" 
        : "You are 1 step away from your milestone.",
      stepsAway: isComplete ? 0 : 1,
      isComplete
    };
  } else {
    // Percentage
    const isComplete = safeCurrent >= 100;
    const remaining = 100 - safeCurrent;
    return {
      heading: isComplete ? "Okay, you reached this milestone! 🎉" : `Progress is at ${safeCurrent}%`,
      detail: isComplete 
        ? "Perfect 100% completion verified!" 
        : `You are ${remaining}% away from your milestone.`,
      stepsAway: Math.ceil(remaining / 10), // approximate steps in 10% blocks
      isComplete
    };
  }
}
