/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "@/lib/support-triage.mjs" {
  export const SUPPORT_PRIORITY: any;
  export const SUPPORT_DISPOSITION: any;
  export function classifySupportRequest(input?: any): any;
  export function buildSupportActionPlan(classification: any): any;
}
declare module "@/lib/support-routine-replies.mjs" {
  export function resolveRoutineSupportRequest(message: any): any;
}
