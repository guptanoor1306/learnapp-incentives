export type GoalProgressInput = {
  goalType: string;
  progressPercentage: number;
};

export function averageGoalTypeProgress(goals: GoalProgressInput[], type: 'business' | 'personal') {
  const filtered = goals.filter((goal) => goal.goalType === type);
  if (filtered.length === 0) return 0;
  return Math.round(
    filtered.reduce((sum, goal) => sum + goal.progressPercentage, 0) / filtered.length
  );
}

/** Business and personal each contribute half of total progress (by type average, not goal count). */
export function calculateGoalTypeContributions(goals: GoalProgressInput[]) {
  const businessPct = averageGoalTypeProgress(goals, 'business');
  const personalPct = averageGoalTypeProgress(goals, 'personal');
  const businessContrib = businessPct * 0.5;
  const personalContrib = personalPct * 0.5;

  return {
    businessPct,
    personalPct,
    businessContrib,
    personalContrib,
    finalPct: Math.round(businessContrib + personalContrib),
  };
}

/** Same formula as the leaderboard progress bar percentage on the tool. */
export function calculateLeaderboardProgress(goals: GoalProgressInput[]) {
  if (goals.length === 0) return 0;
  return calculateGoalTypeContributions(goals).finalPct;
}
