import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui-kit";

type Receipt = {
  run_id: string;
  state_code: string;
  pack_id: string;
  created: number;
  attached: number;
  held: number;
  preserved: number;
  outcomes: { acquisition_source_id: string; candidate_id: string | null; outcome: string }[];
};
type Batch = {
  run_id: string;
  pack_id: string;
  state_code: string;
  manifest_sha256: string;
  source_records: number;
  processed: boolean;
  snapshot_changed: boolean;
  pack_protected: boolean;
  result: Receipt | null;
};

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error &&
      typeof error.message === "string") return error.message;
  return "Import could not be completed. No validation or activation was requested.";
}

// This isolated RPC boundary follows the validation workspace's existing convention
// while generated database types catch up with controlled schema deployment.
async function callImport<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return data as T;
}

export function StateSourceImportPanel() {
  const queryClient = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);
  const [progress, setProgress] = useState("");
  const [failures, setFailures] = useState<string[]>([]);
  const query = useQuery({
    queryKey: ["state-source-import-queue"],
    queryFn: () => callImport<Batch[]>("state_source_import_queue"),
    retry: false,
  });
  const batches = query.data ?? [];
  const pending = batches.filter((b) => !b.processed && !b.snapshot_changed && !b.pack_protected);
  const receipts = batches.flatMap((b) => b.result ? [b.result] : []);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!confirmed) throw new Error("Confirm the import limitations first.");
      setFailures([]);
      let completed = 0;
      for (const batch of pending) {
        setProgress("Importing " + batch.state_code + " (" + (completed + 1) + "/" + pending.length + ")");
        try {
          await callImport<Receipt>("apply_state_source_import", {
            p_run_id: batch.run_id,
            p_pack_id: batch.pack_id,
          });
          completed++;
        } catch (error) {
          // Stop after an uncertain/network/auth result. Refresh obtains committed receipts;
          // a retry uses the same immutable run/pack key and cannot duplicate committed work.
          setFailures((current) => [...current, batch.state_code + ": " + errorMessage(error)]);
          throw error;
        }
      }
      setProgress(completed + " batches processed. Held rows remain unresolved.");
    },
    onSettled: async () => {
      setConfirmed(false);
      await queryClient.invalidateQueries({ queryKey: ["state-source-import-queue"] });
      await queryClient.invalidateQueries({ queryKey: ["state-rule-validation-queue"] });
    },
  });

  function downloadReceipts() {
    const blob = new Blob([JSON.stringify({
      independent_validation_complete: false,
      activation_allowed: false,
      receipts,
      failures,
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "state-source-import-receipts.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Panel className="mt-4" title="Import staged acquisition evidence" bodyClassName="p-5">
      <p className="text-sm text-muted-foreground">
        This uses your signed-in Administrator identity. Only server-staged packages can be imported.
        Existing review decisions are preserved. New records remain unvalidated, and blocked or
        incomplete evidence stays in manual review. Importing does not approve or activate any rule.
      </p>
      {query.isLoading ? <p className="mt-3 text-sm">Loading staged packages...</p> : null}
      {query.error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          The import service is unavailable: {errorMessage(query.error)}
        </p>
      ) : null}
      {!query.isLoading && !query.error && !batches.length ? (
        <p className="mt-3 text-sm">No trusted reconciliation package has been staged.</p>
      ) : null}
      {batches.length ? (
        <div className="mt-4 max-h-72 overflow-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead><tr><th className="p-2">Jurisdiction</th><th className="p-2">Records</th><th className="p-2">Import status</th></tr></thead>
            <tbody>{batches.map((batch) => (
              <tr key={batch.run_id + batch.pack_id} className="border-t">
                <td className="p-2">{batch.state_code === "US" ? "Federal shared" : batch.state_code}</td>
                <td className="p-2">{batch.source_records}</td>
                <td className="p-2">
                  {batch.processed && batch.result
                    ? batch.result.created + " created; " + batch.result.attached + " attached; " +
                      batch.result.held + " held; " + batch.result.preserved + " preserved"
                    : batch.pack_protected ? "Protected pack: no import"
                    : batch.snapshot_changed ? "Snapshot changed: new reconciliation required"
                    : "Ready for acquisition import, not validation"}
                  <details className="mt-1 text-xs text-muted-foreground">
                    <summary>Package identity</summary>
                    <p className="break-all">{batch.run_id}</p>
                    <p className="break-all">SHA-256: {batch.manifest_sha256}</p>
                  </details>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : null}
      <label className="mt-4 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={confirmed}
          disabled={mutation.isPending || !pending.length || query.isFetching}
          onChange={(event) => setConfirmed(event.target.checked)} />
        I authorize acquisition import only. This is not independent validation or production activation.
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button disabled={!confirmed || !pending.length || mutation.isPending || query.isFetching || !!query.error}
          onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Importing..." : "Import " + pending.length + " eligible batches"}
        </Button>
        <Button variant="outline" disabled={mutation.isPending || query.isFetching}
          onClick={() => { void query.refetch(); }}>Refresh import status</Button>
        <Button variant="outline" disabled={!receipts.length || mutation.isPending}
          onClick={downloadReceipts}>Download import receipts</Button>
      </div>
      <p role="status" aria-live="polite" className="mt-3 text-sm">{progress}</p>
      {mutation.error ? <p role="alert" className="mt-2 text-sm text-destructive">
        Import stopped: {errorMessage(mutation.error)} Refresh the status before retrying.
      </p> : null}
    </Panel>
  );
}
