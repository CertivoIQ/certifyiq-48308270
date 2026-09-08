import { Link, useNavigate } from "@tanstack/react-router";
import {
  completeOrganizationOnboardingStep,
  organizationProfileIssue,
} from "@/lib/organization-onboarding";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, Pill } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import {
  useWorkspaceProfile,
  type Hud50058ReportingPath,
  type OrganizationType,
  type PhaHotmaCohort,
} from "@/hooks/use-workspace-profile";

const ORG_TYPES: { value: OrganizationType; label: string }[] = [
  { value: "multifamily_owner_agent", label: "Multifamily Owner / Management Agent" },
  { value: "pha", label: "Public Housing Agency" },
  { value: "developer_owner", label: "Affordable Housing Developer / Owner" },
  { value: "compliance_asset_management", label: "Compliance / Asset Management Organization" },
  { value: "housing_agency", label: "State or Local Housing Agency" },
  { value: "other", label: "Other" },
];

const MULTIFAMILY_PROGRAMS = [
  ["lihtc", "LIHTC"],
  ["home", "HOME"],
  ["htf", "Housing Trust Fund"],
  ["section8_pbra", "Section 8 Project-Based Rental Assistance"],
  ["section202_8", "Section 202/8"],
  ["section202_811_prac", "Section 202/811 PRAC"],
  ["section811_pra", "Section 811 PRA"],
  ["section236_irp", "Section 236 / IRP"],
  ["sprac", "SPRAC"],
  ["tax_exempt_bonds", "Tax-Exempt Bonds"],
  ["rural_development", "USDA Rural Development"],
] as const;

const PHA_PROGRAMS = [
  ["hcv", "Housing Choice Voucher"],
  ["pbv", "Project-Based Voucher"],
  ["public_housing", "Public Housing"],
  ["mod_rehab", "Moderate Rehabilitation"],
] as const;

const PHA_COHORTS: { value: PhaHotmaCohort; label: string; detail: string }[] = [
  {
    value: "NON_MTW_NON_FRS",
    label: "Non-MTW / Non-FRS",
    detail: "Standard PIH HOTMA implementation timeline.",
  },
  {
    value: "INITIAL_MTW",
    label: "Initial MTW Agency",
    detail: "Full Sections 102/104 deadline remains subject to HUD cohort guidance.",
  },
  {
    value: "MTW_EXPANSION",
    label: "MTW Expansion Agency",
    detail: "Full Sections 102/104 deadline remains subject to HUD cohort guidance.",
  },
  {
    value: "FRS_EXCLUSIVE",
    label: "FRS-Exclusive Agency",
    detail: "Full Sections 102/104 deadline remains subject to HUD cohort guidance.",
  },
];

const REPORTING_PATHS: { value: Hud50058ReportingPath; label: string }[] = [
  { value: "HUD_50058_2024", label: "HUD-50058 (2024) reporting path" },
  {
    value: "HUD_50058_2020_ALTERNATIVE",
    label: "HUD-50058 (2020) temporary alternative instructions",
  },
];

function ToggleCard({
  checked,
  label,
  detail,
  onClick,
}: {
  checked: boolean;
  label: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onClick}
      className={`flex min-h-14 items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
    >
      <span>
        <span className="block">{label}</span>
        {detail ? <span className="mt-1 block text-xs text-muted-foreground">{detail}</span> : null}
      </span>
      <span
        className={`grid size-5 shrink-0 place-items-center rounded border ${checked ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
      >
        {checked ? <Check className="size-3" /> : null}
      </span>
    </button>
  );
}

export function WorkspaceProfileConfigurator({ userId }: { userId: string }) {
  const { profile, refetch, loading, isInternal } = useWorkspaceProfile();
  const navigate = useNavigate();
  const dirty = useRef(false);
  const [organizationType, setOrganizationType] = useState<OrganizationType>(
    profile.organization_type,
  );
  const [programs, setPrograms] = useState<string[]>(profile.selected_programs);
  const [phaPrograms, setPhaPrograms] = useState<string[]>(profile.pha_programs);
  const [phaCohort, setPhaCohort] = useState<PhaHotmaCohort | null>(profile.pha_hotma_cohort);
  const [reportingPath, setReportingPath] = useState<Hud50058ReportingPath | null>(
    profile.hud_50058_reporting_path,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dirty.current || loading) return;
    setOrganizationType(profile.organization_type);
    setPrograms(profile.selected_programs);
    setPhaPrograms(profile.pha_programs);
    setPhaCohort(profile.pha_hotma_cohort);
    setReportingPath(profile.hud_50058_reporting_path);
  }, [
    loading,
    profile.organization_type,
    profile.selected_programs,
    profile.pha_programs,
    profile.pha_hotma_cohort,
    profile.hud_50058_reporting_path,
  ]);

  function toggle(value: string, current: string[], setter: (next: string[]) => void) {
    setter(
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
    dirty.current = true;
    setSaved(false);
  }

  async function save(continueSetup: boolean) {
    if (saving || loading) return;
    const isPha = isInternal && organizationType === "pha";
    const values = {
      user_id: userId,
      organization_type: isInternal ? organizationType : "multifamily_owner_agent",
      selected_programs: isPha ? [] : programs,
      pha_programs: isPha ? phaPrograms : [],
      pha_hotma_cohort: isPha ? phaCohort : null,
      hud_50058_reporting_path: isPha ? reportingPath : null,
    };
    const issue = organizationProfileIssue({
      ...values,
      derived_overlays: profile.derived_overlays,
    });
    if (issue) {
      setError(issue);
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const { data, error: saveError } = await supabase
        .from("customer_workspace_profiles")
        .upsert(values, { onConflict: "user_id" })
        .select("user_id")
        .abortSignal(AbortSignal.timeout(20000))
        .single();
      if (saveError || data?.user_id !== userId)
        throw new Error(
          "Your organization and program profile could not be saved. Your selections are still here; please retry.",
        );
      setSaved(true);
      if (continueSetup) await completeOrganizationOnboardingStep(userId);
      dirty.current = false;
      void refetch();
      if (continueSetup) await navigate({ to: "/launchpad" });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The save did not complete. Please retry before leaving this page.",
      );
    } finally {
      setSaving(false);
    }
  }

  const isPha = organizationType === "pha";
  return (
    <Panel
      title="Organization & program profile"
      description="Select every program you operate. CertivoIQ derives HOTMA and other regulatory overlays from this profile; HOTMA is not a selectable program."
    >
      <fieldset disabled={saving || loading} className="min-w-0 space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Organization type
          </p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {ORG_TYPES.filter((option) => isInternal || option.value === "multifamily_owner_agent").map((option) => (
              <ToggleCard
                key={option.value}
                checked={organizationType === option.value}
                label={option.label}
                onClick={() => {
                  dirty.current = true;
                  setOrganizationType(option.value);
                  setSaved(false);
                }}
              />
            ))}
          </div>
        </div>

        <div className="mt-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Programs
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Select all that apply. Program coverage can later be narrowed to property, building,
                or unit.
              </p>
            </div>
            <Pill>{isPha ? `${phaPrograms.length} selected` : `${programs.length} selected`}</Pill>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {(isPha ? PHA_PROGRAMS : MULTIFAMILY_PROGRAMS).map(([value, label]) => (
              <ToggleCard
                key={value}
                checked={(isPha ? phaPrograms : programs).includes(value)}
                label={label}
                onClick={() =>
                  isPha
                    ? toggle(value, phaPrograms, setPhaPrograms)
                    : toggle(value, programs, setPrograms)
                }
              />
            ))}
          </div>
        </div>

        {isPha ? (
          <>
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                PHA HOTMA cohort
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                PHA cohort and HUD-50058 reporting path are required for deadline enforcement routing. CertivoIQ does not assume every PHA
                follows the same January 1, 2027 enforcement path.
              </p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {PHA_COHORTS.map((option) => (
                  <ToggleCard
                    key={option.value}
                    checked={phaCohort === option.value}
                    label={option.label}
                    detail={option.detail}
                    onClick={() => {
                      dirty.current = true;
                      setPhaCohort(option.value);
                      setSaved(false);
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                HUD-50058 reporting path
              </p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {REPORTING_PATHS.map((option) => (
                  <ToggleCard
                    key={option.value}
                    checked={reportingPath === option.value}
                    label={option.label}
                    onClick={() => {
                      dirty.current = true;
                      setReportingPath(option.value);
                      setSaved(false);
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        ) : null}

        <div className="mt-5 rounded-md border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
          CertivoIQ uses this profile to determine which dashboard, modules, rule packs, deadlines,
          and regulatory overlays apply. LIHTC alone does not activate HOTMA; covered HUD programs
          do. Program selections are routed through the deterministic
          implementation engine rather than treated as user-defined compliance conclusions.
        </div>
      </fieldset>
      {loading ? (
        <p role="status" className="mt-3 text-sm">
          Loading your saved profile…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => void save(true)} disabled={saving || loading}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}Save profile & continue
        </Button>
        <Button variant="outline" onClick={() => void save(false)} disabled={saving || loading}>
          Save organization profile
        </Button>
        <Button variant="outline" asChild>
          <Link to="/launchpad">Return to setup checklist</Link>
        </Button>
        {saved ? (
          <span role="status" className="text-sm text-seal">
            Profile saved
          </span>
        ) : null}
      </div>
    </Panel>
  );
}
