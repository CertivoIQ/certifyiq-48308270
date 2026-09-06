import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeftRight,
  Briefcase,
  Building2,
  Calculator,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FileSearch,
  FileUp,
  HelpCircle,
  BookOpen,
  LayoutDashboard,
  Library,
  Lightbulb,
  LogOut,
  MailCheck,
  Menu,
  Rocket,
  Scale,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { IQText } from "@/components/iq-text";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useIsStaff, useSession } from "@/hooks/use-session";
import { useCrmStaffAuthority } from "@/hooks/use-crm-staff-authority";
import { useWorkspaceProfile, type PhaAgencyRole } from "@/hooks/use-workspace-profile";
import {
  PLATFORM_DASHBOARD_LABELS,
  resolvePlatformDashboardMode,
  usePlatformDashboardAccess,
  type PlatformDashboardMode,
} from "@/hooks/use-platform-dashboard-access";
import { PublicShell } from "@/components/public-shell";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

type PhaNavKey =
  | "command"
  | "tasks"
  | "family_write"
  | "family_read"
  | "hcv_operations"
  | "pbv_operations"
  | "ph_operations"
  | "mod_rehab_operations"
  | "waiting_lists"
  | "accommodations"
  | "inspections"
  | "compliance"
  | "reports"
  | "findings"
  | "admin"
  | "owner_admin"
  | "support";

type PhaNavItem = NavItem & { key: PhaNavKey };

const MF_COMMAND: readonly NavItem[] = [
  { to: "/income-calculator", label: "Income Calculator", icon: Calculator },
  { to: "/upload-certification", label: "Upload Certification & OCR", icon: FileUp },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tasks", label: "Tasks", icon: ClipboardCheck },
];

const MF_OPERATIONS: readonly NavItem[] = [
  { to: "/files", label: "Certification Review Queue", icon: FileCheck2 },
  { to: "/findings", label: "Findings & Corrections", icon: AlertTriangle },
  { to: "/audit-readiness", label: "Audit Operations", icon: ClipboardCheck },
  { to: "/document-intelligence", label: "Document Intelligence", icon: Library },
  { to: "/rules", label: "Program Compliance", icon: Scale },
  { to: "/copilot", label: "Compliance Assistant", icon: Sparkles },
];

const MF_ADMIN: readonly NavItem[] = [
  { to: "/workspace-setup", label: "Organization & Programs", icon: SlidersHorizontal },
  { to: "/launchpad", label: "Onboarding & Portfolio Setup", icon: Rocket },
  { to: "/account/security", label: "Users & Security", icon: Shield },
];

const HELP_NAV: readonly NavItem[] = [
  { to: "/training", label: "Training", icon: BookOpen },
  { to: "/feature-suggestions", label: "Suggest a Feature", icon: Lightbulb },
  { to: "/contact-support", label: "Tech Support", icon: HelpCircle },
];

const PHA_COMMAND: readonly PhaNavItem[] = [
  { to: "/income-calculator", label: "Income Calculator", icon: Calculator, key: "family_read" },
  { to: "/upload-certification", label: "Upload Certification & OCR", icon: FileUp, key: "command" },
  { to: "/dashboard", label: "Command Center", icon: LayoutDashboard, key: "command" },
  { to: "/tasks", label: "Tasks", icon: ClipboardCheck, key: "tasks" },
  { to: "/pha-family-intake", label: "Family Intake & Evidence", icon: UserPlus, key: "family_write" },
  { to: "/pha-families", label: "Families & Reexaminations", icon: Users, key: "family_read" },
];

const PHA_OPERATIONS: readonly PhaNavItem[] = [
  { to: "/pha-portability", label: "HCV Portability", icon: ArrowLeftRight, key: "hcv_operations" },
  { to: "/pha-hcv-lease-up", label: "HCV Lease-Up", icon: ClipboardCheck, key: "hcv_operations" },
  { to: "/pha-pbv-operations", label: "PBV Operations", icon: Building2, key: "pbv_operations" },
  { to: "/pha-pbv-waiting-lists", label: "PBV Waiting Lists", icon: ClipboardList, key: "pbv_operations" },
  { to: "/pha-public-housing-operations", label: "Public Housing Operations", icon: Building2, key: "ph_operations" },
  { to: "/pha-public-housing-admissions", label: "Public Housing Admissions", icon: ClipboardCheck, key: "ph_operations" },
  { to: "/pha-public-housing-occupancy", label: "Public Housing Occupancy", icon: Building2, key: "ph_operations" },
  { to: "/pha-mod-rehab-operations", label: "Mod Rehab Operations", icon: Building2, key: "mod_rehab_operations" },
  { to: "/pha-waiting-lists", label: "Waiting Lists", icon: ClipboardList, key: "waiting_lists" },
  { to: "/pha-50058", label: "HUD-50058 Queue", icon: ClipboardList, key: "family_read" },
  { to: "/pha-inspections", label: "NSPIRE Inspections", icon: ClipboardCheck, key: "inspections" },
  { to: "/audit-readiness", label: "Audit Operations", icon: ClipboardCheck, key: "reports" },
];

const PHA_COMPLIANCE: readonly PhaNavItem[] = [
  { to: "/findings", label: "Findings & Corrections", icon: AlertTriangle, key: "findings" },
  { to: "/pha-accommodations", label: "Reasonable Accommodations", icon: ShieldCheck, key: "accommodations" },
  { to: "/pha-notices", label: "Family Notices", icon: MailCheck, key: "family_write" },
  { to: "/pha-policies", label: "Policies & Notice Controls", icon: Scale, key: "compliance" },
  { to: "/pha-source-library", label: "Source Library", icon: Library, key: "compliance" },
  { to: "/document-intelligence", label: "Document Intelligence", icon: FileSearch, key: "compliance" },
  { to: "/pha-reports", label: "Reports & Evidence", icon: FileCheck2, key: "reports" },
  { to: "/rules", label: "Federal & Source Rules", icon: Scale, key: "compliance" },
];

const PHA_ADMIN: readonly PhaNavItem[] = [
  { to: "/workspace-setup", label: "Organization & Programs", icon: SlidersHorizontal, key: "admin" },
  { to: "/launchpad", label: "Agency Setup", icon: Rocket, key: "admin" },
  { to: "/pha-agency-settings", label: "Settings & Integrations", icon: SlidersHorizontal, key: "admin" },
  { to: "/pha-users", label: "Users & Permissions", icon: Shield, key: "admin" },
  { to: "/account/security", label: "Account Security", icon: ShieldCheck, key: "owner_admin" },
];

function phaNavAllowed(role: PhaAgencyRole | null, key: PhaNavKey) {
  if (role === "workspace_owner" || role === "agency_admin") return true;
  if (!role) return key === "command" || key === "support";
  if (key === "command" || key === "tasks" || key === "support") return true;
  if (role === "compliance_admin") return ["family_read", "hcv_operations", "pbv_operations", "ph_operations", "mod_rehab_operations", "waiting_lists", "accommodations", "inspections", "compliance", "reports", "findings"].includes(key);
  if (role === "executive") return ["family_read", "pbv_operations", "ph_operations", "mod_rehab_operations", "waiting_lists", "accommodations", "compliance", "reports", "findings"].includes(key);
  if (role === "inspection_staff") return ["inspections", "accommodations", "reports", "findings"].includes(key);
  if (role === "hcv_pbv_specialist") return ["family_write", "family_read", "hcv_operations", "pbv_operations", "mod_rehab_operations", "waiting_lists", "accommodations", "compliance", "reports", "findings"].includes(key);
  if (role === "public_housing_specialist") return ["family_write", "family_read", "ph_operations", "waiting_lists", "accommodations", "compliance", "reports", "findings"].includes(key);
  return false;
}

function routeIsActive(pathname: string, to: string) {
  return to === "/dashboard" ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
}

function NavLink({ item, onNavigate, nested = false }: { item: NavItem; onNavigate?: (() => void) | undefined; nested?: boolean }) {
  const { to, label, icon: Icon } = item;
  return (
    <Link
      to={to}
      onClick={onNavigate}
      activeOptions={{ exact: to === "/dashboard" }}
      activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_0_var(--sidebar-primary)]" }}
      inactiveProps={{ className: "text-sidebar-foreground/70 hover:bg-sidebar-accent/55" }}
      className={`flex items-center gap-2.5 rounded-md py-2 pr-3 text-[13px] font-medium transition-colors ${nested ? "pl-7" : "px-3"}`}
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.9} />
      {label}
    </Link>
  );
}

function NavGroup({
  label,
  icon: SectionIcon,
  items,
  pathname,
  onNavigate,
  initiallyOpen = false,
}: {
  label: string;
  icon: LucideIcon;
  items: readonly NavItem[];
  pathname: string;
  onNavigate?: (() => void) | undefined;
  initiallyOpen?: boolean;
}) {
  const active = items.some((item) => routeIsActive(pathname, item.to));
  const [expanded, setExpanded] = useState(initiallyOpen || active);

  useEffect(() => {
    if (active) setExpanded(true);
  }, [active]);

  if (!items.length) return null;
  return (
    <section className="border-b border-sidebar-border/50 pb-1 last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/45 hover:text-sidebar-foreground"
      >
        <SectionIcon className="size-3.5 shrink-0" strokeWidth={1.9} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDown className={`size-3.5 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {expanded ? <div className="pb-1">{items.map((item) => <NavLink key={`${item.to}-${item.label}`} item={item} onNavigate={onNavigate} nested />)}</div> : null}
    </section>
  );
}

function Wordmark() {
  return <Link to="/dashboard" className="flex items-center gap-2.5"><img src="/certivoiq-logo-dark.png" alt="CertivoIQ" className="h-12 w-auto object-contain" /></Link>;
}

function NavLinks({ onNavigate, dashboardMode }: { onNavigate?: (() => void) | undefined; dashboardMode: PlatformDashboardMode }) {
  const { isStaff } = useIsStaff();
  const { accessLevel, canManageStaff } = useCrmStaffAuthority();
  const { phaRole } = useWorkspaceProfile();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isPha = dashboardMode === "pha";
  const showBilling = dashboardMode === "executive_demo" || accessLevel === "manager" || phaRole === "executive";

  if (!isPha) {
    const adminItems: NavItem[] = [...MF_ADMIN];
    if (showBilling) adminItems.push({ to: "/billing", label: "Billing", icon: CreditCard });
    if (isStaff && canManageStaff) adminItems.push({ to: "/state-rule-validation", label: "State Rule Validation", icon: FileSearch });
    if (isStaff) adminItems.push({ to: "/crm", label: "CRM", icon: Briefcase });

    return (
      <nav aria-label={`${dashboardMode === "executive_demo" ? "Executive" : "Multifamily"} workspace navigation`} data-navigation-version="grouped-v2">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
          {dashboardMode === "executive_demo" ? "Executive workspace" : "Multifamily workspace"}
        </p>
        <div className="space-y-1">
          <NavGroup label="Command Center" icon={LayoutDashboard} items={MF_COMMAND} pathname={pathname} onNavigate={onNavigate} initiallyOpen />
          <div className="py-1"><NavLink item={{ to: "/hotma-readiness", label: "HOTMA Readiness", icon: ShieldCheck }} onNavigate={onNavigate} /></div>
          <NavGroup label="Operations" icon={Briefcase} items={MF_OPERATIONS} pathname={pathname} onNavigate={onNavigate} />
          <NavGroup label="Administration" icon={SlidersHorizontal} items={adminItems} pathname={pathname} onNavigate={onNavigate} />
          <NavGroup label="Help" icon={HelpCircle} items={HELP_NAV} pathname={pathname} onNavigate={onNavigate} />
        </div>
      </nav>
    );
  }

  const commandItems = PHA_COMMAND.filter((item) => phaNavAllowed(phaRole, item.key));
  const operationItems = PHA_OPERATIONS.filter((item) => phaNavAllowed(phaRole, item.key));
  const complianceItems = PHA_COMPLIANCE.filter((item) => phaNavAllowed(phaRole, item.key));
  const adminItems: NavItem[] = PHA_ADMIN.filter((item) => phaNavAllowed(phaRole, item.key));
  if (showBilling) adminItems.push({ to: "/billing", label: "Billing", icon: CreditCard });
  if (isStaff && canManageStaff) adminItems.push({ to: "/state-rule-validation", label: "State Rule Validation", icon: FileSearch });
  if (isStaff) adminItems.push({ to: "/crm", label: "CRM", icon: Briefcase });

  return (
    <nav aria-label="PHA workspace navigation" data-navigation-version="grouped-v2">
      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">PHA workspace</p>
      <p className="mb-3 px-3 text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/40">{phaRole ? phaRole.replaceAll("_", " ") : "Role assignment required"}</p>
      <div className="space-y-1">
        <NavGroup label="Command Center" icon={LayoutDashboard} items={commandItems} pathname={pathname} onNavigate={onNavigate} initiallyOpen />
        {phaNavAllowed(phaRole, "compliance") ? <div className="py-1"><NavLink item={{ to: "/hotma-readiness", label: "HOTMA Readiness", icon: ShieldCheck }} onNavigate={onNavigate} /></div> : null}
        <NavGroup label="Operations" icon={Briefcase} items={operationItems} pathname={pathname} onNavigate={onNavigate} />
        <NavGroup label="Compliance & Evidence" icon={ShieldCheck} items={complianceItems} pathname={pathname} onNavigate={onNavigate} />
        <NavGroup label="Administration" icon={SlidersHorizontal} items={adminItems} pathname={pathname} onNavigate={onNavigate} />
        <NavGroup label="Help" icon={HelpCircle} items={HELP_NAV} pathname={pathname} onNavigate={onNavigate} />
      </div>
    </nav>
  );
}

function SessionActions({
  email,
  dashboardMode,
  allowedModes,
  hasSwitcher,
  selectDashboard,
}: {
  email: string;
  dashboardMode: PlatformDashboardMode;
  allowedModes: PlatformDashboardMode[];
  hasSwitcher: boolean;
  selectDashboard: (mode: PlatformDashboardMode) => boolean;
}) {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      sessionStorage.removeItem("certivoiq:after-auth");
      await navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out");
      setSigningOut(false);
    }
  };

  const switchDashboard = (value: string) => {
    if (selectDashboard(value as PlatformDashboardMode)) window.location.assign("/dashboard");
  };

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-48 truncate text-xs text-muted-foreground xl:inline">{email}</span>
      {hasSwitcher ? (
        <Select value={dashboardMode} onValueChange={switchDashboard}>
          <SelectTrigger className="h-9 w-[166px]" aria-label="Platform dashboard">
            <ArrowLeftRight className="size-4" /><SelectValue />
          </SelectTrigger>
          <SelectContent>{allowedModes.map((mode) => <SelectItem key={mode} value={mode}>{PLATFORM_DASHBOARD_LABELS[mode]}</SelectItem>)}</SelectContent>
        </Select>
      ) : null}
      <Button type="button" size="sm" variant="outline" disabled={signingOut} onClick={signOut}>
        <LogOut className="size-4" />{signingOut ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}

export function AppShell({ children, title, subtitle, actions }: { children: ReactNode; title: string; subtitle?: string; actions?: ReactNode }) {
  const { session } = useSession();
  const { profile } = useWorkspaceProfile();
  const { selectedMode, allowedModes, hasSwitcher, selectDashboard } = usePlatformDashboardAccess();
  const [open, setOpen] = useState(false);
  const t = useT();
  if (!session) return <PublicShell title={title} subtitle={subtitle} actions={actions}>{children}</PublicShell>;

  const dashboardMode = resolvePlatformDashboardMode(selectedMode, profile.organization_type);
  const isPha = dashboardMode === "pha";
  const programSummary = dashboardMode === "executive_demo"
    ? "Executive portfolio"
    : isPha
      ? (profile.pha_programs.length ? profile.pha_programs.map((p) => p.toUpperCase()).join(" · ") : "PHA programs not configured")
      : (profile.selected_programs.length ? profile.selected_programs.map((p) => p.replaceAll("_", " ").toUpperCase()).join(" · ") : "Programs not configured");
  const sessionActions = <SessionActions email={session.user.email ?? "Signed in"} dashboardMode={dashboardMode} allowedModes={allowedModes} hasSwitcher={hasSwitcher} selectDashboard={selectDashboard} />;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <Wordmark />
        <p className="mt-2 pl-1 text-[11px] tracking-wide text-sidebar-foreground/55">{t("shell.tagline")}</p>
        <div className="mt-7 overflow-y-auto"><NavLinks dashboardMode={dashboardMode} /></div>
        <div className="mt-auto rounded-lg border border-sidebar-border/70 bg-sidebar-accent/40 p-3">
          <p className="cite text-[10.5px] uppercase tracking-[0.16em] text-sidebar-foreground/60">Active program profile</p>
          <p className="mt-1.5 text-[11px] leading-5 text-sidebar-foreground/90">{programSummary}</p>
          {profile.derived_overlays.some((item) => item.startsWith("hotma_")) ? <p className="mt-1 font-mono text-[11px] text-sidebar-foreground/55">HOTMA applicability derived</p> : null}
        </div>
        <div className="mt-3">{sessionActions}</div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 py-2.5 lg:hidden">
            <button onClick={() => setOpen((v) => !v)} aria-label={t("nav.toggle")} className="grid size-8 place-items-center rounded-md text-sidebar-foreground">{open ? <X className="size-5" /> : <Menu className="size-5" />}</button>
            <Wordmark />
          </div>
          {open ? <div className="max-h-[calc(100vh-4.5rem)] overflow-y-auto border-b border-sidebar-border bg-sidebar px-4 py-3 lg:hidden"><NavLinks onNavigate={() => setOpen(false)} dashboardMode={dashboardMode} /></div> : null}
          <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-4 sm:px-7">
            <div className="min-w-0">
              <h1 className="truncate font-display text-[23px] leading-tight sm:text-[27px]"><IQText>{title}</IQText></h1>
              {subtitle ? <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">{actions}{sessionActions}<LanguageToggle /><ThemeToggle /></div>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-7 sm:py-8">{children}</main>
      </div>
    </div>
  );
}


