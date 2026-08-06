import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  FileCheck2,
  AlertTriangle,
  Scale,
  Sparkles,
  GraduationCap,
  Menu,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

const NAV = [
  { to: "/", label: "Executive", icon: LayoutDashboard },
  { to: "/properties", label: "Properties", icon: Building2 },
  { to: "/files", label: "Certifications", icon: FileCheck2 },
  { to: "/findings", label: "Findings", icon: AlertTriangle },
  { to: "/rules", label: "Rule packs", icon: Scale },
  { to: "/copilot", label: "AI Copilot", icon: Sparkles },
  { to: "/knowledge", label: "KnowledgeIQ", icon: GraduationCap },
] as const;

function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-[5px] bg-sidebar-primary font-mono text-[13px] font-bold text-sidebar-primary-foreground">
        IQ
      </span>
      <span className="font-display text-lg leading-none tracking-tight text-sidebar-foreground">
        Certify<span className="text-seal-soft">IQ</span>
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          activeOptions={{ exact: to === "/" }}
          activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
          inactiveProps={{ className: "text-sidebar-foreground/72 hover:bg-sidebar-accent/60" }}
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors"
        >
          <Icon className="size-4 shrink-0" strokeWidth={1.75} />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <Wordmark />
        <p className="mt-1.5 pl-[42px] text-[11px] tracking-wide text-sidebar-foreground/55">
          Compliance intelligence
        </p>
        <div className="mt-7">
          <NavLinks />
        </div>
        <div className="mt-auto rounded-md border border-sidebar-border/70 p-3">
          <p className="cite text-[10.5px] uppercase tracking-[0.16em] text-sidebar-foreground/55">
            Rule packs active
          </p>
          <p className="mt-1.5 font-mono text-[12px] text-sidebar-foreground/85">
            LIHTC · HOTMA · HOME · PBS8
          </p>
          <p className="mt-1 font-mono text-[11px] text-sidebar-foreground/55">50 states · 2026.08 build</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/92 backdrop-blur">
          <div className="flex items-center gap-3 border-b border-border bg-sidebar px-4 py-2.5 lg:hidden">
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle navigation"
              className="grid size-8 place-items-center rounded-md text-sidebar-foreground"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <Wordmark />
          </div>
          {open && (
            <div className="border-b border-sidebar-border bg-sidebar px-4 py-3 lg:hidden">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
          )}
          <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-4 sm:px-7">
            <div className="min-w-0">
              <h1 className="truncate font-display text-[22px] leading-tight sm:text-[26px]">{title}</h1>
              {subtitle && <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-7 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
