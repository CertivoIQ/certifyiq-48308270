import { useState } from "react";
import { CheckCircle2, FileArchive } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type CertificationTaskActionsProps = {
  findingId?: string;
  caseId?: string;
  active: boolean;
  onCompleted: () => void;
};

export function CertificationTaskActions({
  findingId,
  caseId,
  active,
  onCompleted,
}: CertificationTaskActionsProps) {
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!active) return null;

  const resolveFinding = async () => {
    if (!findingId) return;
    if (!notes.trim()) {
      toast.error("Enter resolution notes before closing the finding.");
      return;
    }

    setSubmitting(true);
    try {
      // Generated types refresh after the production migration is applied.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("resolve_certification_finding", {
        _finding_id: findingId,
        _resolution_notes: notes.trim(),
      });
      if (error) throw error;
      toast.success("Finding resolved. The certification reruns automatically after the last finding closes.");
      setNotes("");
      onCompleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The finding could not be resolved.");
    } finally {
      setSubmitting(false);
    }
  };

  const approveCertification = async () => {
    if (!caseId) return;

    setSubmitting(true);
    try {
      // Generated types refresh after the production migration is applied.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("approve_certification_final", {
        _case_id: caseId,
      });
      if (error) throw error;
      toast.success("Certification approved and filed with an immutable audit manifest.");
      onCompleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Final approval could not be recorded.");
    } finally {
      setSubmitting(false);
    }
  };

  if (findingId) {
    return (
      <div className="mt-3 max-w-2xl space-y-2">
        <label className="block text-xs font-medium text-muted-foreground" htmlFor={`resolution-${findingId}`}>
          Resolution notes
        </label>
        <textarea
          id={`resolution-${findingId}`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          placeholder="Describe the correction and the evidence reviewed."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button size="sm" disabled={submitting || !notes.trim()} onClick={() => void resolveFinding()}>
          <CheckCircle2 className="size-4" />
          {submitting ? "Resolving…" : "Resolve finding"}
        </Button>
      </div>
    );
  }

  if (caseId) {
    return (
      <div className="mt-3">
        <Button size="sm" disabled={submitting} onClick={() => void approveCertification()}>
          <FileArchive className="size-4" />
          {submitting ? "Filing…" : "Approve and file for audit"}
        </Button>
      </div>
    );
  }

  return null;
}
