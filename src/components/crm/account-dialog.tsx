import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { STAGES, type Account, type AccountType, type Stage } from "@/lib/crm";

type Draft = {
  name: string;
  account_type: AccountType;
  units: string;
  hq: string;
  website: string;
  linkedin_url: string;
  stage: Stage;
  arr: string;
  plan: string;
  owner: string;
  source: string;
  last_touch: string;
  notes: string;
};

const empty: Draft = {
  name: "",
  account_type: "enterprise",
  units: "",
  hq: "",
  website: "",
  linkedin_url: "",
  stage: "new",
  arr: "",
  plan: "Enterprise",
  owner: "Unassigned",
  source: "Manually created",
  last_touch: "Never contacted",
  notes: "",
};

function toDraft(a: Account): Draft {
  return {
    name: a.name,
    account_type: a.account_type,
    units: String(a.units ?? ""),
    hq: a.hq ?? "",
    website: a.website ?? "",
    linkedin_url: a.linkedin_url ?? "",
    stage: a.stage,
    arr: String(a.arr ?? ""),
    plan: a.plan ?? "",
    owner: a.owner ?? "",
    source: a.source ?? "",
    last_touch: a.last_touch ?? "",
    notes: a.notes ?? "",
  };
}

const field = "space-y-1.5";

export function AccountDialog({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  account?: Account | null;
}) {
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>(empty);

  useEffect(() => {
    if (open) setD(account ? toDraft(account) : empty);
  }, [open, account]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: d.name.trim(),
        account_type: d.account_type,
        units: Number(d.units) || 0,
        hq: d.hq.trim() || null,
        website: d.website.trim() || null,
        linkedin_url: d.linkedin_url.trim() || null,
        stage: d.stage,
        arr: Number(d.arr) || 0,
        plan: d.plan.trim() || null,
        owner: d.owner.trim() || null,
        source: d.source.trim() || null,
        last_touch: d.last_touch.trim() || null,
        notes: d.notes.trim() || null,
      };
      if (!payload.name) throw new Error("Account name is required");
      if (account) {
        const { error } = await supabase.from("crm_accounts").update(payload).eq("id", account.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("crm_accounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm"] });
      toast.success(account ? "Account profile updated" : "Account profile created");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{account ? "Edit account profile" : "New account profile"}</DialogTitle>
          <DialogDescription>Enterprise or company lead record with pipeline and notes.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className={`${field} sm:col-span-2`}>
            <Label>Account name</Label>
            <Input value={d.name} maxLength={160} onChange={(e) => setD({ ...d, name: e.target.value })} />
          </div>
          <div className={field}>
            <Label>Account type</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={d.account_type}
              onChange={(e) => setD({ ...d, account_type: e.target.value as AccountType })}
            >
              <option value="enterprise">Enterprise</option>
              <option value="company">Company</option>
            </select>
          </div>
          <div className={field}>
            <Label>Pipeline stage</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              value={d.stage}
              onChange={(e) => setD({ ...d, stage: e.target.value as Stage })}
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className={field}>
            <Label>Units</Label>
            <Input value={d.units} inputMode="numeric" onChange={(e) => setD({ ...d, units: e.target.value })} />
          </div>
          <div className={field}>
            <Label>Headquarters</Label>
            <Input value={d.hq} maxLength={120} onChange={(e) => setD({ ...d, hq: e.target.value })} />
          </div>
          <div className={field}>
            <Label>Website</Label>
            <Input value={d.website} maxLength={200} onChange={(e) => setD({ ...d, website: e.target.value })} />
          </div>
          <div className={field}>
            <Label>LinkedIn company page</Label>
            <Input
              value={d.linkedin_url}
              maxLength={240}
              placeholder="linkedin.com/company/…"
              onChange={(e) => setD({ ...d, linkedin_url: e.target.value })}
            />
          </div>
          <div className={field}>
            <Label>Annual contract value ($)</Label>
            <Input value={d.arr} inputMode="numeric" onChange={(e) => setD({ ...d, arr: e.target.value })} />
          </div>
          <div className={field}>
            <Label>Plan</Label>
            <Input value={d.plan} maxLength={60} onChange={(e) => setD({ ...d, plan: e.target.value })} />
          </div>
          <div className={field}>
            <Label>Sales owner</Label>
            <Input value={d.owner} maxLength={80} onChange={(e) => setD({ ...d, owner: e.target.value })} />
          </div>
          <div className={field}>
            <Label>Source</Label>
            <Input value={d.source} maxLength={160} onChange={(e) => setD({ ...d, source: e.target.value })} />
          </div>
          <div className={`${field} sm:col-span-2`}>
            <Label>Last touch</Label>
            <Input value={d.last_touch} maxLength={200} onChange={(e) => setD({ ...d, last_touch: e.target.value })} />
          </div>
          <div className={`${field} sm:col-span-2`}>
            <Label>Notes</Label>
            <Textarea
              rows={4}
              value={d.notes}
              maxLength={4000}
              onChange={(e) => setD({ ...d, notes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {account ? "Save changes" : "Create account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ContactDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accountId: string;
  accountName: string;
}) {
  const qc = useQueryClient();
  const [d, setD] = useState({ name: "", title: "", email: "", phone: "", linkedin_url: "", notes: "" });

  useEffect(() => {
    if (open) setD({ name: "", title: "", email: "", phone: "", linkedin_url: "", notes: "" });
  }, [open]);

  const save = useMutation({
    mutationFn: async () => {
      if (!d.name.trim()) throw new Error("Contact name is required");
      const { error } = await supabase.from("crm_contacts").insert({
        account_id: accountId,
        name: d.name.trim(),
        title: d.title.trim() || null,
        email: d.email.trim() || null,
        phone: d.phone.trim() || null,
        linkedin_url: d.linkedin_url.trim() || null,
        notes: d.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm"] });
      toast.success("Contact added");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
          <DialogDescription>{accountName}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3.5">
          <div className={field}>
            <Label>Name</Label>
            <Input value={d.name} maxLength={120} onChange={(e) => setD({ ...d, name: e.target.value })} />
          </div>
          <div className={field}>
            <Label>Title</Label>
            <Input
              value={d.title}
              maxLength={120}
              placeholder="VP of Property Management"
              onChange={(e) => setD({ ...d, title: e.target.value })}
            />
          </div>
          <div className={field}>
            <Label>Email</Label>
            <Input value={d.email} type="email" maxLength={255} onChange={(e) => setD({ ...d, email: e.target.value })} />
          </div>
          <div className={field}>
            <Label>Phone</Label>
            <Input value={d.phone} maxLength={40} onChange={(e) => setD({ ...d, phone: e.target.value })} />
          </div>
          <div className={field}>
            <Label>LinkedIn profile</Label>
            <Input
              value={d.linkedin_url}
              maxLength={240}
              placeholder="linkedin.com/in/…"
              onChange={(e) => setD({ ...d, linkedin_url: e.target.value })}
            />
          </div>
          <div className={field}>
            <Label>Notes</Label>
            <Textarea rows={3} value={d.notes} maxLength={2000} onChange={(e) => setD({ ...d, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Add contact
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
