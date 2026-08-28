import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Building2, FileCheck2, AlertTriangle, Scale, Sparkles, Rocket,
  Menu, X, Briefcase, Shield, CreditCard, HelpCircle, Users, ClipboardList,
  ClipboardCheck, ShieldCheck, SlidersHorizontal, UserPlus, MailCheck, ArrowLeftRight,
  Library, LogOut, FileSearch,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { IQText } from "@/components/iq-text";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useIsStaff, useSession } from "@/hooks/use-session";
import { useCrmStaffAuthority } from "@/hooks/use-crm-staff-authority";
import { useWorkspaceProfile, type PhaAgencyRole } from "@/hooks/use-workspace-profile";
import { PublicShell } from "@/components/public-shell";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MULTIFAMILY_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/properties", label: "Properties", icon: Building2 },
  { to: "/files", label: "Certifications", icon: FileCheck2 },
  { to: "/findings", label: "Findings & Corrections", icon: AlertTriangle },
  { to: "/rules", label: "Program Compliance", icon: Scale },
  { to: "/copilot", label: "Compliance Assistant", icon: Sparkles },
  { to: "/workspace-setup", label: "Organization & Programs", icon: SlidersHorizontal },
  { to: "/launchpad", label: "Portfolio Setup", icon: Rocket },
  { to: "/account/security", label: "Users & Security", icon: Shield },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/contact-support", label: "Support", icon: HelpCircle },
] as const;

const PHA_NAV = [
  { to: "/dashboard", label: "Command Center", icon: LayoutDashboard, key: "command" },
  { to: "/pha-family-intake", label: "Family Intake & Evidence", icon: UserPlus, key: "family_write" },
  { to: "/pha-families", label: "Families & Reexaminations", icon: Users, key: "family_read" },
  { to: "/pha-portability", label: "HCV Portability", icon: ArrowLeftRight, key: "hcv_operations" },
  { to: "/pha-hcv-lease-up", label: "HCV Lease-Up", icon: ClipboardCheck, key: "hcv_operations" },
  { to: "/pha-pbv-operations", label: "PBV Operations", icon: Building2, key: "pbv_operations" },
  { to: "/pha-pbv-waiting-lists", label: "PBV Waiting Lists", icon: ClipboardList, key: "pbv_operations" },
  { to: "/pha-public-housing-operations", label: "Public Housing Operations", icon: Building2, key: "ph_operations" },
  { to: "/pha-public-housing-admissions", label: "Public Housing Admissions", icon: ClipboardCheck, key: "ph_operations" },
  { to: "/pha-public-housing-occupancy", label: "Public Housing Occupancy", icon: Building2, key: "ph_operations" },
  { to: "/pha-mod-rehab-operations", label: "Mod Rehab Operations", icon: Building2, key: "mod_rehab_operations" },
  { to: "/pha-waiting-lists", label: "Waiting Lists", icon: ClipboardList, key: "waiting_lists" },
  { to: "/pha-accommodations", label: "Reasonable Accommodations", icon: ShieldCheck, key: "accommodations" },
  { to: "/pha-notices", label: "Family Notices", icon: MailCheck, key: "family_write" },
  { to: "/pha-50058", label: "HUD-50058 Queue", icon: ClipboardList, key: "family_read" },
  { to: "/pha-inspections", label: "Inspections / NSPIRE", icon: ClipboardCheck, key: "inspections" },
  { to: "/pha-hotma", label: "HOTMA Readiness", icon: ShieldCheck, key: "compliance" },
  { to: "/pha-policies", label: "Policies & Notice Controls", icon: Scale, key: "compliance" },
  { to: "/pha-source-library", label: "Source Library & Forms", icon: Library, key: "compliance" },
  { to: "/pha-reports", label: "Reports & Evidence", icon: FileCheck2, key: "reports" },
  { to: "/findings", label: "Findings", icon: AlertTriangle, key: "findings" },
  { to: "/rules", label: "Federal & Source Rules", icon: Scale, key: "compliance" },
  { to: "/workspace-setup", label: "Organization & Programs", icon: SlidersHorizontal, key: "admin" },
  { to: "/launchpad", label: "Agency Setup", icon: Rocket, key: "admin" },
  { to: "/pha-agency-settings", label: "Agency Settings & Integrations", icon: SlidersHorizontal, key: "admin" },
  { to: "/pha-users", label: "Users & Permissions", icon: Shield, key: "admin" },
  { to: "/billing", label: "Billing", icon: CreditCard, key: "owner_admin" },
  { to: "/contact-support", label: "Support", icon: HelpCircle, key: "support" },
] as const;

function phaNavAllowed(role: PhaAgencyRole | null, key: (typeof PHA_NAV)[number]["key"]) {
  if (!role || role === "workspace_owner" || role === "agency_admin" || role === "compliance_admin") return true;
  if (key === "command" || key === "support") return true;
  if (role === "executive") return ["family_read", "pbv_operations", "ph_operations", "mod_rehab_operations", "waiting_lists", "accommodations", "compliance", "reports", "findings"].includes(key);
  if (role === "inspection_staff") return ["inspections", "accommodations", "reports", "findings"].includes(key);
  if (role === "hcv_pbv_specialist") return ["family_write", "family_read", "hcv_operations", "pbv_operations", "mod_rehab_operations", "waiting_lists", "accommodations", "compliance", "reports", "findings"].includes(key);
  if (role === "public_housing_specialist") return ["family_write", "family_read", "ph_operations", "waiting_lists", "accommodations", "compliance", "reports", "findings"].includes(key);
  return false;
}
function Wordmark(){return <Link to="/dashboard" className="flex items-center gap-2.5"><img src="/certivoiq-logo-dark.png" alt="CertivoIQ" className="h-12 w-auto object-contain" /></Link>;}
function NavLinks({onNavigate}:{onNavigate?:()=>void}){
  const{isStaff}=useIsStaff();
  const{canManageStaff}=useCrmStaffAuthority();
  const{profile,phaRole}=useWorkspaceProfile();
  const isPha=profile.organization_type==="pha";
  const workspaceItems=isPha?PHA_NAV.filter(item=>phaNavAllowed(phaRole,item.key)):MULTIFAMILY_NAV;
  const items=isStaff
    ? [
        workspaceItems[0],
        {to:"/tasks",label:"Tasks",icon:ClipboardCheck} as const,
        ...(canManageStaff ? [{to:"/state-rule-validation",label:"State Rule Validation",icon:FileSearch} as const] : []),
        ...workspaceItems.slice(1),
        {to:"/crm",label:"CRM",icon:Briefcase} as const,
      ]
    : workspaceItems;
  return <nav className="flex flex-col gap-0.5"><p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">{isPha?"PHA workspace":"Multifamily workspace"}</p>{isPha&&phaRole?<p className="mb-2 px-3 text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/40">{phaRole.replaceAll("_"," ")}</p>:null}{items.map(({to,label,icon:Icon})=><Link key={to} to={to} onClick={onNavigate} activeOptions={{exact:to==="/dashboard"}} activeProps={{className:"bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_0_var(--sidebar-primary)]"}} inactiveProps={{className:"text-sidebar-foreground/70 hover:bg-sidebar-accent/55"}} className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors"><Icon className="size-4 shrink-0" strokeWidth={1.9}/>{label}</Link>)}</nav>;
}
function SessionActions({email}:{email:string}){
  const navigate=useNavigate();
  const[signingOut,setSigningOut]=useState(false);
  const signOut=async()=>{
    setSigningOut(true);
    try{
      const{error}=await supabase.auth.signOut({scope:"local"});
      if(error)throw error;
      sessionStorage.removeItem("certivoiq:after-auth");
      await navigate({to:"/auth",search:{mode:"signin"},replace:true});
    }catch(error){
      toast.error(error instanceof Error?error.message:"Could not sign out");
      setSigningOut(false);
    }
  };
  return <div className="flex items-center gap-2"><span className="hidden max-w-48 truncate text-xs text-muted-foreground xl:inline">{email}</span><Button type="button" size="sm" variant="outline" disabled={signingOut} onClick={signOut}><LogOut className="size-4"/>{signingOut?"Signing out…":"Sign out"}</Button></div>;
}
export function AppShell({children,title,subtitle,actions}:{children:ReactNode;title:string;subtitle?:string;actions?:ReactNode}){const{session}=useSession();const{profile}=useWorkspaceProfile();const[open,setOpen]=useState(false);const t=useT();if(!session)return <PublicShell title={title} subtitle={subtitle} actions={actions}>{children}</PublicShell>;const isPha=profile.organization_type==="pha";const programSummary=isPha?(profile.pha_programs.length?profile.pha_programs.map(p=>p.toUpperCase()).join(" · "):"PHA programs not configured"):(profile.selected_programs.length?profile.selected_programs.map(p=>p.replaceAll("_"," ").toUpperCase()).join(" · "):"Programs not configured");return <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]"><aside className="hidden flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 lg:sticky lg:top-0 lg:flex lg:h-screen"><Wordmark/><p className="mt-2 pl-1 text-[11px] tracking-wide text-sidebar-foreground/55">{t("shell.tagline")}</p><div className="mt-7 overflow-y-auto"><NavLinks/></div><div className="mt-auto rounded-lg border border-sidebar-border/70 bg-sidebar-accent/40 p-3"><p className="cite text-[10.5px] uppercase tracking-[0.16em] text-sidebar-foreground/60">Active program profile</p><p className="mt-1.5 text-[11px] leading-5 text-sidebar-foreground/90">{programSummary}</p>{profile.derived_overlays.some(item=>item.startsWith("hotma_"))?<p className="mt-1 font-mono text-[11px] text-sidebar-foreground/55">HOTMA applicability derived</p>:null}</div><div className="mt-3"><SessionActions email={session.user.email ?? "Signed in"}/></div></aside><div className="flex min-w-0 flex-col"><header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur"><div className="flex items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 py-2.5 lg:hidden"><button onClick={()=>setOpen(v=>!v)} aria-label={t("nav.toggle")} className="grid size-8 place-items-center rounded-md text-sidebar-foreground">{open?<X className="size-5"/>:<Menu className="size-5"/>}</button><Wordmark/></div>{open&&<div className="border-b border-sidebar-border bg-sidebar px-4 py-3 lg:hidden"><NavLinks onNavigate={()=>setOpen(false)}/></div>}<div className="flex flex-wrap items-end justify-between gap-3 px-4 py-4 sm:px-7"><div className="min-w-0"><h1 className="truncate font-display text-[23px] leading-tight sm:text-[27px]"><IQText>{title}</IQText></h1>{subtitle&&<p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>}</div><div className="flex flex-wrap items-center gap-2">{actions}<SessionActions email={session.user.email ?? "Signed in"}/><LanguageToggle/><ThemeToggle/></div></div></header><main className="min-w-0 flex-1 px-4 py-6 sm:px-7 sm:py-8">{children}</main></div></div>;}
