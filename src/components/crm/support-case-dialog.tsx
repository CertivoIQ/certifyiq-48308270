import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CASE_STATUSES,
  CASE_PRIORITIES,
  CASE_CHANNELS,
  type SupportCase,
  type Account,
  type Contact,
  type CaseStatus,
  type CasePriority,
  type CaseChannel,
} from "@/lib/crm";
import type { StaffUser } from "@/lib/crm-staff.functions";

const field = "space-y-1.5";

type Draft = {
  subject: string;
  description: string;
  status: CaseStatus;
  priority: CasePriority;
  channel: CaseChannel;
  account_id: string;
  contact_id: string;
  assigned_to: string;
  source_email: string;
  tags: string;
};

const empty: Draft = {
  subject: "",
  description: "",
  status: "open",
  priority: "normal",
  channel: "email",
  account_id: "",
  contact_id: "",
  assigned_to: "",
  source_email: "",
  tags: "",
};

function toDraft(c: SupportCase): Draft {
  return {
    subject: c.subject,
    description: c.description ?? "",
    status: (c.status as CaseStatus) ?? "open",
    priority: (c.priority as CasePriority) ?? "normal",
    channel: (c.channel as CaseChannel) ?? "email",
    account_id: c.account_id ?? "",
    contact_id: c.contact_id ?? "",
    assigned_to: c.assigned_to ?? "",
    source_email: c.source_email ?? "",
    tags: (c.tags ?? []).join(", "),
  };
}

export function SupportCaseDialog({
  open,
  onOpenChange,
  supportCase,
  accounts,
  contacts,
  staff,
  staffEmail,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  supportCase?: SupportCase | null;
  accounts: Account[];
  contacts: Contact[];
  staff: StaffUser[];
  staffEmail: string;
}) {
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>(empty);
  const [note, setNote] = useState("");

  const notes = useQuery({
    queryKey: ["support-case-notes", supportCase?.id],
    enabled: open && !!supportCase,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_case_notes")
        .select("*")
        .eq("case_id", supportCase!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (open) {
      setD(supportCase ? toDraft(supportCase) : empty);
      setNote("");
    }
  }, [open, supportCase]);

  const filteredContacts = d.account_id
    ? contacts.filter((c) => c.account_id === d.account_id)
    : contacts;

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        subject: d.subject.trim(),
        description: d.description.trim() || null,
        status: d.status,
        priority: d.priority,
        source: d.channel,
        account_id: d.account_id || null,
        contact_id: d.contact_id || null,
        assigned_to: d.assigned_to || null,
        tags: d.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      if (!payload.subject) throw new Error("Subject is required");
      if (supportCase) {
        const { error } = await supabase.from("support_cases").update(payload).eq("id", supportCase.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("support_cases").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-cases"] });
      toast.success(supportCase ? "Support case updated" : "Support case created");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const addNote = useMutation({
    mutationFn: async () => {
      if (!supportCase) return;
      if (!note.trim()) throw new Error("Note cannot be empty");
      const { error } = await supabase.from("support_case_notes").insert({
        case_id: supportCase.id,
        note: note.trim(),
        author_id: null,
        author_name: staffEmail,
        internal: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-case-notes", supportCase?.id] });
      qc.invalidateQueries({ queryKey: ["support-cases"] });
      setNote("");
      toast.success("Note added");
    },
    onError: () => toast.error("Could not add note"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{supportCase ? supportCase.case_number : "New support case"}</DialogTitle>
          <DialogDescription>
            {supportCase ? "Update the case, reassign it, or add internal notes." : "Create a new support case tied to an account or contact."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className={`${field} sm:col-span-2`}>
            <Label>Subject</Label>
            <Input value={d.subject} maxLength={200} onChange={(e) => setD({ ...d, subject: e.target.value })} />
          </div>
          <div className={field}>
            <Label>Status</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              value={d.status}
              onChange={(e) => setD({ ...d, status: e.target.value as CaseStatus })}
            >
              {CASE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className={field}>
            <Label>Priority</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              value={d.priority}
              onChange={(e) => setD({ ...d, priority: e.target.value as CasePriority })}
            >
              {CASE_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className={field}>
            <Label>Channel</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              value={d.channel}
              onChange={(e) => setD({ ...d, channel: e.target.value as CaseChannel })}
            >
              {CASE_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className={field}>
            <Label>Assigned to</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={d.assigned_to}
              onChange={(e) => setD({ ...d, assigned_to: e.target.value })}
            >
              <option value="">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.email})
                </option>
              ))}
            </select>
          </div>
          <div className={field}>
            <Label>Account</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={d.account_id}
              onChange={(e) => {
                const accountId = e.target.value;
                setD((prev) => ({ ...prev, account_id: accountId, contact_id: "" }));
              }}
            >
              <option value="">None</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className={field}>
            <Label>Contact</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={d.contact_id}
              onChange={(e) => setD({ ...d, contact_id: e.target.value })}
            >
              <option value="">None</option>
              {filteredContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.title ? `· ${c.title}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className={field}>
            <Label>Source email</Label>
            <Input
              type="email"
              value={d.source_email}
              maxLength={255}
              placeholder="support@certifyiq.com"
              onChange={(e) => setD({ ...d, source_email: e.target.value })}
            />
          </div>
          <div className={field}>
            <Label>Tags</Label>
            <Input
              value={d.tags}
              maxLength={200}
              placeholder="billing, onboarding, m365"
              onChange={(e) => setD({ ...d, tags: e.target.value })}
            />
          </div>
          <div className={`${field} sm:col-span-2`}>
            <Label>Description</Label>
            <Textarea
              rows={4}
              value={d.description}
              maxLength={4000}
              onChange={(e) => setD({ ...d, description: e.target.value })}
            />
          </div>
        </div>

        {supportCase && (
          <div className="mt-4 border-t border-border pt-4">
            <h4 className="mb-2 font-display text-[15px]">Internal notes</h4>
            <div className="mb-3 flex gap-2">
              <Textarea
                className="min-h-[60px] flex-1"
                placeholder="Add a note..."
                value={note}
                maxLength={2000}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button
                className="self-start"
                size="sm"
                onClick={() => addNote.mutate()}
                disabled={addNote.isPending || !note.trim()}
              >
                Add note
              </Button>
            </div>
            <ul className="space-y-2">
              {(notes.data ?? []).map((n) => (
                <li key={n.id} className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <p className="text-[13px] whitespace-pre-wrap">{n.note}</p>
                  <p className="cite mt-1">
                    {n.author_name ?? "Staff"} · {new Date(n.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
              {!notes.data?.length && <p className="cite">No notes yet.</p>}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !d.subject.trim()}>
            {supportCase ? "Save changes" : "Create case"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
