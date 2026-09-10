import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { DatabaseZap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type CorpusStatus = {
  architecture_version: string;
  raw_cross_tenant_access: false;
  raw_customer_records_model_training_eligible: false;
  model_training_permission: "prohibited" | "permitted";
  anonymized_aggregation_permission: "prohibited" | "permitted";
  anonymized_aggregation_supported: true;
  minimum_aggregate_tenant_count: number;
  record_counts: Record<string, number>;
};

export function ComplianceCorpusGovernance() {
  const [status, setStatus] = useState<CorpusStatus | null>(null);
  // Database types intentionally trail controlled rollout migrations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const load = useMutation({
    mutationFn: async () => {
      const { data, error } = await client.rpc("compliance_corpus_status", {});
      if (error) throw error;
      return data as CorpusStatus;
    },
    onSuccess: setStatus,
    onError: (error) => toast.error(error instanceof Error ? error.message : "Corpus governance lookup failed closed"),
  });
  return (
    <Panel
      title="CertivoIQ Compliance Corpus"
      description="Provenance-preserving relationships for future analytics with strict customer-confidentiality boundaries."
      actions={<Button size="sm" onClick={() => load.mutate()} disabled={load.isPending}><DatabaseZap className="size-4" /> Inspect governance</Button>}
    >
      {status ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2"><Pill tone="seal">Tenant raw data isolated</Pill><Pill tone="neutral">Training: {status.model_training_permission}</Pill><Pill tone="neutral">Aggregation: {status.anonymized_aggregation_permission}</Pill></div>
          <p className="text-sm text-muted-foreground">Raw customer records are never model-training eligible. Any future anonymized aggregate requires explicit permission and at least {status.minimum_aggregate_tenant_count} contributing tenants.</p>
          <div className="grid gap-3 sm:grid-cols-4">{Object.entries(status.record_counts).map(([kind,count]) => <Stat key={kind} label={kind} value={count} />)}</div>
        </div>
      ) : <p className="text-sm text-muted-foreground">Inspect the tenant-specific corpus policy and structured relationship counts.</p>}
    </Panel>
  );
}
