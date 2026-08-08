/**
 * Synthetic demo isolation.
 *
 * Every demonstration surface belongs to one reserved tenant id. Production
 * workflows (uploads, reviews, sign-off, billing activation, evidence
 * manifests) must call `assertProductionTenant` before writing, so synthetic
 * records can never be mistaken for a real portfolio. Paid activation creates a
 * clean production account; it never copies demo records.
 */

export const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";

export function isDemoTenant(organizationId: string | null | undefined): boolean {
  return organizationId === DEMO_ORGANIZATION_ID;
}

export function assertProductionTenant(organizationId: string) {
  if (organizationId === DEMO_ORGANIZATION_ID) {
    throw new Error("Synthetic demo data cannot enter production workflows.");
  }
}

/** Fictional contact address domain used by every demo record. */
export const DEMO_EMAIL_DOMAIN = "demo.invalid";

export function demoEmail(localPart: string): string {
  return `${localPart.toLowerCase().replace(/[^a-z0-9.]+/g, ".")}@${DEMO_EMAIL_DOMAIN}`;
}

/** Persistent banner shown on every demo route. */
export function DemoDataBanner() {
  return (
    <div
      role="status"
      className="bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-950"
    >
      Interactive demonstration · All people, properties, files and results are fictional · Do not
      upload real tenant information
    </div>
  );
}

/** Diagonal DEMO watermark for demo screens. */
export function DemoWatermark() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40 select-none overflow-hidden"
    >
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[28deg] whitespace-nowrap font-mono text-[18vw] font-bold uppercase leading-none tracking-[0.2em] text-foreground/[0.05]">
        Demo
      </div>
    </div>
  );
}
