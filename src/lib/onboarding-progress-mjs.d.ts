declare module "@/lib/onboarding-progress.mjs" {
  export type OnboardingProgress = {
    currentStep: number;
    completedSteps: number[];
    completedAt: string | null;
  };

  export function normalizeOnboardingProgress(input: {
    currentStep: number;
    completedSteps: number[] | null | undefined;
    completedAt: string | null;
    totalSteps: number;
  }): OnboardingProgress;

  export function previousOnboardingProgress(input: {
    currentStep: number;
    completedSteps: number[];
    totalSteps: number;
  }): OnboardingProgress;
}
