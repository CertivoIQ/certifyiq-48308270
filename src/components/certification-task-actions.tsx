import { useState } from "react";
import { CheckCircle2, FileArchive, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [responsiblePartyName, setResponsiblePartyName] = useState("");
  const [responsiblePartyPosition, setResponsiblePartyPosition] = useState("");
  const [signature, setSignature] = useState("");
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
    const name = responsiblePartyName.trim();
    const position = responsiblePartyPosition.trim();
    const signed = signature.trim();

    if (!name || !position || !signed) {
      toast.error("Responsible party name, position, and signature are required.");
      return;
    }
    if (name.toLocaleLowerCase() !== signed.toLocaleLowerCase()) {
      toast.error("The typed signature must match the responsible party name.");
      return;
    }

    setSubmitting(true);
    try {
      // Generated types refresh after the production migration is applied.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("approve_certification_final", {
        _case_id: caseId,
        _responsible_party_name: name,
        _responsible_party_position: position,
        _signature: signed,
      });
      if (error) throw error;
      toast.success("Final review confirmed. Certification approved and filed with its immutable audit manifest.");
      setResponsiblePartyName("");
      setResponsiblePartyPosition("");
      setSignature("");
      onCompleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Final review confirmation could not be recorded.");
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
    const ready =
      responsiblePartyName.trim().length >= 2 &&
      responsiblePartyPosition.trim().length >= 2 &&
      signature.trim().length >= 2 &&
      responsiblePartyName.trim().toLocaleLowerCase() === signature.trim().toLocaleLowerCase();

    return (
      <div className="mt-3 max-w-2xl rounded-md border border-border bg-muted/20 p-4">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium">Pending Final Review</p>
            <p className="mt-1 text-xs text-muted-foreground">
              All findings must be resolved before this step. The responsible party must confirm final review and sign before the certification can be filed for audit.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`responsible-name-${caseId}`}>Responsible party name</Label>
            <Input
              id={`responsible-name-${caseId}`}
              value={responsiblePartyName}
              maxLength={200}
              autoComplete="name"
              onChange={(event) => setResponsiblePartyName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`responsible-position-${caseId}`}>Position / title</Label>
            <Input
              id={`responsible-position-${caseId}`}
              value={responsiblePartyPosition}
              maxLength={200}
              placeholder="Compliance Manager"
              onChange={(event) => setResponsiblePartyPosition(event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`responsible-signature-${caseId}`}>Signature</Label>
            <Input
              id={`responsible-signature-${caseId}`}
              value={signature}
              maxLength={200}
              placeholder="Type the responsible party's full name"
              onChange={(event) => setSignature(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              By signing, the responsible party confirms that all certification findings have been resolved and final review is complete.
            </p>
          </div>
        </div>

        <Button className="mt-4" size="sm" disabled={submitting || !ready} onClick={() => void approveCertification()}>
          <FileArchive className="size-4" />
          {submitting ? "Filing…" : "Confirm final review and file"}
        </Button>
      </div>
    );
  }

  return null;
}
