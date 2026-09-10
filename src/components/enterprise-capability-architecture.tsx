import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

export function EnterpriseCapabilityArchitecture() {
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  // Database types intentionally trail controlled rollout migrations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const load = useMutation({
    mutationFn: async () => {
      const { data, error } = await client.rpc("enterprise_capability_matrix", {});
      if (error) throw error;
      return data as Matrix;
    },
    onSuccess: setMatrix,
    onError: (error) => toast.error(error instanceof Error ? error.message : "Enterprise capability lookup failed closed"),
  });
  return (
    <Panel
      title="Enterprise Capability Architecture"
      description="Governed plan boundaries for premium capabilities. No per-feature pricing or automatic package activation."
      actions={<Button size="sm" onClick={() => load.mutate()} disabled={load.isPending}><Building2 className="size-4" /> View capability boundary</Button>}
    >
      {matrix ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2"><Pill tone="seal">Enterprise-ready</Pill><Pill tone="neutral">Pricing logic: none</Pill><Pill tone="neutral">Manual authorization</Pill></div>
          <div className="grid gap-3 lg:grid-cols-2">
            {matrix.capabilities.map((capability) => (
              <div key={capability.capability_key} className="rounded-md border p-4">
                <div className="flex items-center justify-between gap-2"><p className="font-medium">{capability.display_name}</p><Pill tone={capability.access_level==="disabled" ? "neutral" : "seal"}>{capability.access_level}</Pill></div>
                <p className="mt-1 text-sm text-muted-foreground">{capability.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">{capability.decision_source}</p>
              </div>
            ))}
          </div>
        </div>
      ) : <p className="text-sm text-muted-foreground">Load the governed capability matrix when needed.</p>}
    </Panel>
  );
}
