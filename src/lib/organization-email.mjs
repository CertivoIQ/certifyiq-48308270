const PERSONAL_EMAIL_DOMAINS = new Set([
  "aol.com",
  "fastmail.com",
  "gmail.com",
  "googlemail.com",
  "gmx.com",
  "gmx.net",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "mail.com",
  "me.com",
  "msn.com",
  "outlook.com",
  "pm.me",
  "proton.me",
  "protonmail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "ymail.com",
  "zoho.com",
]);

const RESERVED_SUFFIXES = [".example", ".invalid", ".localhost", ".test"];

export function isOrganizationEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;

  const domain = email.slice(email.lastIndexOf("@") + 1);
  if (PERSONAL_EMAIL_DOMAINS.has(domain)) return false;
  if (RESERVED_SUFFIXES.some((suffix) => domain === suffix.slice(1) || domain.endsWith(suffix))) return false;

  return true;
}
