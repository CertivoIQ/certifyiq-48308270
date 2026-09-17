import { useQuery } from "@tanstack/react-query";
import { Building2, LockKeyhole } from "lucide-react";

import { Panel, Pill } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type Capability = {
  capability_key: string;
  display_name: string;
  capability_category: string;
  description: string;
  access_level: "disabled" | "read" | "execute" | "admin";
  decision_source: string;
  requires_product_authorization: boolean;
};
type Matrix = {
  architecture_version: string;
  pricing_logic: "none";
  automatic_package_activation: false;
  capabilities: Capability[];
};

const CAPABILITY_ROUTES: Record<string, string> = {
  audit_simulation: "/audit-readiness#audit-simulator",
  auditor_workspace: "/audit-readiness#auditor-workspace",
  compliance_intelligence: "/compliance-intelligence#portfolio-compliance-intelligence",
  regulatory_change_intelligence: "/compliance-intelligence#regulatory-diff-engine",
  enterprise_benchmarking: "/compliance-intelligence#portfolio-compliance-intelligence",
};

function decisionLabel(source: string) {
  if (source === "founder_admin_authority") return "Founder administrator access";
  if (source === "external_license_required") return "External license required";
  return source.replaceAll("_", " ");
}

export function EnterpriseCapabilityArchitecture() {
  // Database types intentionally trail controlled rollout migrations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const matrix = useQuery({
    queryKey: ["enterprise-capability-matrix"],
    queryFn: async () => {
      const { data, error } = await client.rpc("enterprise_capability_matrix", {});
      if (error) throw error;
      return data as Matrix;
    },
  });

  return (
    <Panel
      title="Enterprise Capability Architecture"
      description="Governed access boundaries for enterprise capabilities. Module access does not bypass data-use, compliance-review, or external-license controls."
    >
      {matrix.isLoading ? <p className="text-sm text-muted-foreground">Loading capability access…</p> : null}
      {matrix.isError ? (
        <p className="text-sm text-destructive">Capability access could not be loaded. Access remains fail-closed.</p>
      ) : null}
      {matrix.data ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Pill tone="seal">Enterprise-ready</Pill>
            <Pill tone="neutral">Pricing logic: none</Pill>
            <Pill tone="neutral">Governed authorization</Pill>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {matrix.data.capabilities.map((capability) => {
              const route = CAPABILITY_ROUTES[capability.capability_key];
              const enabled = capability.access_level !== "disabled" && Boolean(route);
              const body = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {enabled ? <Building2 className="size-4 text-primary" aria-hidden="true" /> : <LockKeyhole className="size-4 text-muted-foreground" aria-hidden="true" />}
                      <p className="font-medium">{capability.display_name}</p>
                    </div>
                    <Pill tone={enabled ? "seal" : "neutral"}>{capability.access_level}</Pill>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{capability.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{decisionLabel(capability.decision_source)}</p>
                  {capability.capability_key === "enterprise_benchmarking" && enabled ? (
                    <p className="mt-2 text-xs text-muted-foreground">Module access is enabled. Cross-customer aggregation still requires explicit permission and the corpus minimum-contributor rule.</p>
                  ) : null}
                </>
              );

              return enabled ? (
                <a
                  key={capability.capability_key}
                  href={route}
                  className="block cursor-pointer rounded-md border p-4 transition-colors hover:border-primary/40 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {body}
                </a>
              ) : (
                <div key={capability.capability_key} className="rounded-md border bg-muted/20 p-4 opacity-80" aria-disabled="true">
                  {body}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
