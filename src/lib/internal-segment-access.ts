/** UI convenience only. Server and database independently verify the current identity. */
export function isInternalSegmentUser(user: { id?: string; email?: string; email_confirmed_at?: string; is_anonymous?: boolean } | null | undefined): boolean {
  return !!user?.id && !!user.email_confirmed_at && !user.is_anonymous &&
    /^[^@\s]+@certivoiq\.com$/i.test(user.email ?? "");
}

export function isInternalSegmentPath(path: string): boolean {
  return /^\/(?:pha(?:[/-]|$)|nspire(?:[/-]|$)|crm-pha-controls(?:\/|$))/i.test(path);
}

export function assertPublicLicenseKind(kind: string): void {
  if (kind !== "multifamily_enterprise") throw new Error("Only Multifamily Enterprise is available for purchase.");
}
