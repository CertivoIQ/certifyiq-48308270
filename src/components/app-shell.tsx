import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  FileCheck2,
  AlertTriangle,
  Scale,
  Landmark,
  Sparkles,
  GraduationCap,
  Rocket,
  Tag,
  Menu,
  X,
  Clock,
  Gift,
  Briefcase,
  Shield,
  CreditCard,
  HelpCircle,
} from "lucide-react";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyAgencies } from "@/lib/hfa-regulatory.functions";
import { TRIAL } from "@/lib/platform-data";
import { Button } from "@/components/ui/button";
import { IQText } from "@/components/iq-text";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useIsStaff } from "@/hooks/use-session";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/en";


const NAV = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/properties", labelKey: "nav.properties", icon: Building2 },
  { to: "/files", labelKey: "nav.files", icon: FileCheck2 },
  { to: "/findings", labelKey: "nav.findings", icon: AlertTriangle },
  { to: "/rules", labelKey: "nav.rules", icon: Scale },
  { to: "/submissions", labelKey: "nav.submissions", icon: Landmark },
  { to: "/copilot", labelKey: "nav.copilot", icon: Sparkles },
  { to: "/academy", labelKey: "nav.academy", icon: GraduationCap },
  { to: "/launchpad", labelKey: "nav.launchpad", icon: Rocket },
  { to: "/trial", labelKey: "nav.trial", icon: Gift },
  { to: "/pricing", labelKey: "nav.pricing", icon: Tag },
  { to: "/account/security", labelKey: "nav.security", icon: Shield },
  { to: "/billing", labelKey: "nav.billing", icon: CreditCard },
  { to: "/contact-support", labelKey: "nav.support", icon: HelpCircle },
] as const satisfies readonly { to: string; labelKey: TranslationKey; icon: unknown }[];



function Wordmark() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2.5">
      <span className="brand-gradient grid size-8 place-items-center rounded-[8px] font-mono text-[13px] font-bold text-gold">
        IQ
      </span>
      <span className="font-display text-lg leading-none tracking-tight text-sidebar-foreground">
        Certivo<span className="text-gold">IQ</span>
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { isStaff } = useIsStaff();
  const t = useT();
  const fetchAgencies = useServerFn(listMyAgencies);
  // Agency console entry point appears only for housing-agency members.
  const agencies = useQuery({
    queryKey: ["hfa-agencies"],
    queryFn: () => fetchAgencies({}),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const items = [
    ...NAV,
    ...(agencies.data?.length ? [{ to: "/agency", labelKey: "nav.agency", icon: Landmark } as const] : []),
    ...(isStaff ? [{ to: "/crm", labelKey: "nav.crm", icon: Briefcase } as const] : []),
  ];
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map(({ to, labelKey, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          activeOptions={{ exact: to === "/dashboard" }}
          activeProps={{
            className:
              "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_0_var(--sidebar-primary)]",
          }}
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


function TrialBanner() {
  const t = useT();
  if (!TRIAL.active) return null;
  return (
    <div className="brand-gradient flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-primary-foreground sm:px-7">
      <Clock className="size-4 shrink-0" />
      <p className="text-[12.5px] font-medium">
        {t("shell.trial.status", {
          daysLeft: TRIAL.daysLeft,
          daysTotal: TRIAL.daysTotal,
          used: TRIAL.uploadsUsed,
          allowed: TRIAL.uploadsAllowed,
        })}
      </p>
      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" variant="secondary" asChild>
          <Link to="/welcome">{t("shell.trial.watchDemo")}</Link>
        </Button>
        <Button
          size="sm"
          className="border border-primary-foreground/40 bg-primary-foreground/10 hover:bg-primary-foreground/20"
          asChild
        >
          <Link to="/pricing">{t("shell.trial.upgrade")}</Link>
        </Button>
      </div>
    </div>
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
  const t = useT();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <Wordmark />
        <p className="mt-1.5 pl-[42px] text-[11px] tracking-wide text-sidebar-foreground/55">
          {t("shell.tagline")}
        </p>
        <div className="mt-7 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="mt-auto rounded-lg border border-sidebar-border/70 bg-sidebar-accent/40 p-3">
          <p className="cite text-[10.5px] uppercase tracking-[0.16em] text-sidebar-foreground/60">
            {t("shell.rulePacksActive")}
          </p>
          <p className="mt-1.5 font-mono text-[12px] text-sidebar-foreground/90">LIHTC · HOTMA · HOME · PBS8</p>
          <p className="mt-1 font-mono text-[11px] text-sidebar-foreground/55">{t("shell.statesBuild")}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 py-2.5 lg:hidden">
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label={t("nav.toggle")}
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
          <TrialBanner />
          <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-4 sm:px-7">
            <div className="min-w-0">
              <h1 className="truncate font-display text-[23px] leading-tight sm:text-[27px]">
                <IQText>{title}</IQText>
              </h1>
              {subtitle && <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {actions}
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>

        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-7 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
