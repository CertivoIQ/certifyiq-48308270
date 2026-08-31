/**
 * Keep the persisted LaunchPad cursor and completion list consistent.
 * The current step is authoritative: returning to a step means that step and
 * every later step must be confirmed again.
 */
export function normalizeOnboardingProgress({
  currentStep,
  completedSteps,
  completedAt,
  totalSteps,
}) {
  const safeTotal = Math.max(1, Number.isInteger(totalSteps) ? totalSteps : 1);
  const safeCurrent = Number.isInteger(currentStep) ? currentStep : 1;
  const normalizedStep = Math.max(1, Math.min(safeTotal, safeCurrent));
  const validIds = new Set(Array.from({ length: safeTotal }, (_, index) => index + 1));
  const normalizedCompleted = Array.from(
    new Set(
      Array.isArray(completedSteps)
        ? completedSteps.filter((id) => Number.isInteger(id) && validIds.has(id))
        : [],
    ),
  ).sort((a, b) => a - b);

  const allStepsComplete =
    normalizedCompleted.length === safeTotal &&
    normalizedCompleted.every((id, index) => id === index + 1);

  if (completedAt && allStepsComplete) {
    return {
      currentStep: safeTotal,
      completedSteps: normalizedCompleted,
      completedAt,
    };
  }

  return {
    currentStep: normalizedStep,
    completedSteps: normalizedCompleted.filter((id) => id < normalizedStep),
    completedAt: null,
  };
}

export function previousOnboardingProgress({
  currentStep,
  completedSteps,
  totalSteps,
}) {
  return normalizeOnboardingProgress({
    currentStep: Math.max(1, currentStep - 1),
    completedSteps,
    completedAt: null,
    totalSteps,
  });
}
