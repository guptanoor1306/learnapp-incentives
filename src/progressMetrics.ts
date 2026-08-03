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

/** Same formula as the leaderboard progress bar percentage on the tool. */
export function calculateLeaderboardProgress(goals: GoalProgressInput[]) {
  if (goals.length === 0) return 0;

  const businessGoals = goals.filter((goal) => goal.goalType === 'business');
  const personalGoals = goals.filter((goal) => goal.goalType === 'personal');
  const businessContrib =
    businessGoals.reduce((sum, goal) => sum + goal.progressPercentage, 0) / goals.length;
  const personalContrib =
    personalGoals.reduce((sum, goal) => sum + goal.progressPercentage, 0) / goals.length;

  return Math.round(businessContrib + personalContrib);
}
