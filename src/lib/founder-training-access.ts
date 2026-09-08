/** Read only from server-managed account_access, never profile metadata or role selection. */
export function hasFounderTrainingAccess(access: {
  plan_id?: string | null;
  status?: string | null;
  access_until?: string | null;
} | null | undefined, now = Date.now()): boolean {
  return access?.plan_id === "founder_internal" && access.status === "active" &&
    (access.access_until == null || new Date(access.access_until).getTime() > now);
}
