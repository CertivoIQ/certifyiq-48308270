declare module "@/lib/certification-authority.mjs" {
  export const SUBMISSION_AUTHORITY: Readonly<Record<string, string>>;
  export const SUBMISSION_STATUS: Readonly<Record<string, string>>;
  export function evaluateSubmissionAuthority(input: {
    item: unknown;
    findings: unknown;
    reviews: unknown;
    manifest?: unknown;
    [key: string]: unknown;
  }): {
    authority: string;
    status: string;
    blockers: string[];
    [key: string]: unknown;
  };
}
