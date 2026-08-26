import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  FileCheck2,
  AlertTriangle,
  Scale,
  Sparkles,
  Rocket,
  Tag,
  Menu,
  X,
  Briefcase,
  Shield,
  CreditCard,
  HelpCircle,
} from "lucide-react";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { IQText } from "@/components/iq-text";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useIsStaff, useSession } from "@/hooks/use-session";
import { PublicShell } from "@/components/public-shell";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/en";

const NAV = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/properties", labelKey: "nav.properties", icon: Building2 },
  { to: "/files", labelKey: "nav.files", icon: FileCheck2 },
  { to: "/findings", labelKey: "nav.findings", icon: AlertTriangle },
  { to: "/rules", labelKey: "nav.rules", icon: Scale },
  { to: "/copilot", labelKey: "nav.copilot", icon: Sparkles },
  { to: "/launchpad", labelKey: "nav.launchpad", icon: Rocket },
  { to: "/pricing", labelKey: "nav.pricing", icon: Tag },
  { to: "/account/security", labelKey: "nav.security", icon: Shield },
  { to: "/billing", labelKey: "nav.billing", icon: CreditCard },
  { to: "/contact-support", labelKey: "nav.support", icon: HelpCircle },
] as const satisfies readonly { to: string; labelKey: TranslationKey; icon: unknown }[];

function Wordmark() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2.5">
      <img src="/certivoiq-logo-dark.png" alt="CertivoIQ" className="h-12 w-auto object-contain" />
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { isStaff } = useIsStaff();
  const t = useT();
  const items = isStaff ? [...NAV, { to: "/crm", labelKey: "nav.crm", icon: Briefcase } as const] : NAV;
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map(({ to, labelKey, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          activeOptions={{ exact: to === "/dashboard" }}
          activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_0_var(--sidebar-primary)]" }}
          inactiveProps={{ className: "text-sidebar-foreground/70 hover:bg-sidebar-accent/55" }}
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors"
        >
          <Icon className="size-4 shrink-0" strokeWidth={1.9} />
          {t(labelKey)}
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({ children, title, subtitle, actions }: { children: ReactNode; title: string; subtitle?: string | undefined; actions?: ReactNode | undefined }) {
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const t = useT();

  // Authentication boundary for navigation: the portfolio sidebar is only for a
  // signed-in user inside the CertivoIQ application workspace. Anyone without a
  // session gets the public marketing shell instead.
  if (!session) {
    return <PublicShell title={title} subtitle={subtitle} actions={actions}>{children}</PublicShell>;
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <Wordmark />
        <p className="mt-2 pl-1 text-[11px] tracking-wide text-sidebar-foreground/55">{t("shell.tagline")}</p>
        <div className="mt-7 overflow-y-auto"><NavLinks /></div>
        <div className="mt-auto rounded-lg border border-sidebar-border/70 bg-sidebar-accent/40 p-3">
          <p className="cite text-[10.5px] uppercase tracking-[0.16em] text-sidebar-foreground/60">{t("shell.rulePacksActive")}</p>
          <p className="mt-1.5 font-mono text-[12px] text-sidebar-foreground/90">LIHTC · HOTMA · HOME · PBS8</p>
          <p className="mt-1 font-mono text-[11px] text-sidebar-foreground/55">{t("shell.statesBuild")}</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 py-2.5 lg:hidden">
            <button onClick={() => setOpen((v) => !v)} aria-label={t("nav.toggle")} className="grid size-8 place-items-center rounded-md text-sidebar-foreground">{open ? <X className="size-5" /> : <Menu className="size-5" />}</button>
            <Wordmark />
          </div>
          {open && <div className="border-b border-sidebar-border bg-sidebar px-4 py-3 lg:hidden"><NavLinks onNavigate={() => setOpen(false)} /></div>}
          <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-4 sm:px-7">
            <div className="min-w-0">
              <h1 className="truncate font-display text-[23px] leading-tight sm:text-[27px]"><IQText>{title}</IQText></h1>
              {subtitle && <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">{actions}<LanguageToggle /><ThemeToggle /></div>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-7 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
