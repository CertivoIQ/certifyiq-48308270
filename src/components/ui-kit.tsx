import { cn } from "@/lib/utils";
import type { Status } from "@/lib/demo-data";
import { statusLabel } from "@/lib/demo-data";
import type { ReactNode } from "react";

const TONE = {
  seal: "bg-seal-soft text-seal border-seal/25",
  flag: "bg-flag-soft text-flag border-flag/25",
  reject: "bg-reject-soft text-reject border-reject/25",
  neutral: "bg-muted text-muted-foreground border-border",
} as const;

export type Tone = keyof typeof TONE;

export const statusTone: Record<Status, Tone> = {
  approved: "seal",
  pending: "neutral",
  remediation: "flag",
  rejected: "reject",
};

export function Pill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone | undefined;
  children: ReactNode;
  className?: string | undefined;

}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: Status }) {
  const tone = statusTone[status];
  return (
    <Pill tone={tone}>
      <span className="size-1.5 rounded-full bg-current" />
      {statusLabel[status]}
    </Pill>
  );
}

export function Cite({ children }: { children: ReactNode }) {
  return <span className="cite">{children}</span>;
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode | undefined;
  description?: ReactNode | undefined;
  actions?: ReactNode | undefined;
  children?: ReactNode | undefined;
  className?: string | undefined;
  bodyClassName?: string | undefined;

}) {
  return (
    <section className={cn("rounded-lg border border-border bg-card shadow-ledger", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
          <div>
            {title && <h2 className="font-display text-[15.5px] leading-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
}) {
  const accent =
    tone === "seal" ? "text-seal" : tone === "flag" ? "text-flag" : tone === "reject" ? "text-reject" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3.5 shadow-ledger">
      <p className="cite text-[10.5px] uppercase tracking-[0.14em]">{label}</p>
      <p className={cn("mt-1.5 font-display text-[27px] leading-none", accent)}>{value}</p>
      {hint && <p className="mt-1.5 text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Meter({ value, tone = "neutral" }: { value: number; tone?: Tone }) {
  const bar = tone === "seal" ? "bg-seal" : tone === "flag" ? "bg-flag" : tone === "reject" ? "bg-reject" : "bg-ink";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}
