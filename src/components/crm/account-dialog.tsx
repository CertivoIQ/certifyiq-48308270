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
import {
  OWNERSHIP_VERIFICATION_STATUSES,
  STAGES,
  type Account,
  type AccountType,
  type OwnershipVerificationStatus,
  type Stage,
} from "@/lib/crm";

type Draft = {
  name: string;
  account_type: AccountType;
  units: string;
  hq: string;
  website: string;
  linkedin_url: string;
  stage: Stage;
  is_demo: boolean;
  contract_verified: boolean;
  payment_verified: boolean;
  arr: string;
  plan: string;
  owner: string;
  property_owner_name: string;
  management_company_name: string;
  owner_manager_website: string;
  ownership_verification_status: OwnershipVerificationStatus;
  ownership_confidence: string;
  ownership_sources: string;
  ownership_verified_at: string;
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
  is_demo: false,
  contract_verified: false,
  payment_verified: false,
  arr: "",
  plan: "Enterprise",
  owner: "Unassigned",
  property_owner_name: "",
  management_company_name: "",
  owner_manager_website: "",
  ownership_verification_status: "unverified",
  ownership_confidence: "",
  ownership_sources: "",
  ownership_verified_at: "",
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
    is_demo: a.is_demo,
    contract_verified: Boolean(a.contract_verified_at),
    payment_verified: Boolean(a.payment_verified_at),
    arr: String(a.arr ?? ""),
    plan: a.plan ?? "",
    owner: a.owner ?? "",
    property_owner_name: a.property_owner_name ?? "",
    management_company_name: a.management_company_name ?? "",
    owner_manager_website: a.owner_manager_website ?? "",
    ownership_verification_status: a.ownership_verification_status as OwnershipVerificationStatus,
    ownership_confidence: String(a.ownership_confidence ?? ""),
    ownership_sources: (a.ownership_sources ?? []).join("\n"),
    ownership_verified_at: a.ownership_verified_at ?? "",
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
        is_demo: d.is_demo,
        contract_verified_at: d.contract_verified
          ? account?.contract_verified_at ?? new Date().toISOString()
          : null,
        payment_verified_at: d.payment_verified
          ? account?.payment_verified_at ?? new Date().toISOString()
          : null,
        arr: Number(d.arr) || 0,
        plan: d.plan.trim() || null,
        owner: d.owner.trim() || null,
        property_owner_name: d.property_owner_name.trim() || null,
        management_company_name: d.management_company_name.trim() || null,
        owner_manager_website: d.owner_manager_website.trim() || null,
        ownership_verification_status: d.ownership_verification_status,
        ownership_confidence: d.ownership_confidence.trim() === "" ? null : Number(d.ownership_confidence),
        ownership_sources: d.ownership_sources.split(/\n/).map((value) => value.trim()).filter(Boolean),
        ownership_verified_at: d.ownership_verified_at || null,
        source: d.source.trim() || null,
        last_touch: d.last_touch.trim() || null,
        notes: d.notes.trim() || null,
      };
      if (!payload.name) throw new Error("Account name is required");
      if (payload.ownership_confidence !== null && (payload.ownership_confidence < 0 || payload.ownership_confidence > 100)) {
        throw new Error("Ownership confidence must be between 0 and 100");
      }
      if (account) {
        const { error } = await supabase.from("crm_accounts").update(payload).eq("id", account.id);
        if (error) throw error;
      } else {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const { error } = await supabase.from("crm_accounts").insert({
          ...payload,
          created_by: authData.user?.id ?? null,
        });
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
          <div className="sm:col-span-2 mt-2 rounded-xl border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-900 dark:bg-sky-950/20">
            <h3 className="font-sans text-sm font-semibold text-sky-950 dark:text-sky-50">Verified sale controls</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              The post-sale checklist appears only for a non-demo account in Closed Won with a verified contract or payment.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={d.is_demo}
                  onChange={(e) => setD({ ...d, is_demo: e.target.checked })}
                />
                Demo / test record
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={d.contract_verified}
                  onChange={(e) => setD({ ...d, contract_verified: e.target.checked })}
                />
                Executed contract verified
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={d.payment_verified}
                  onChange={(e) => setD({ ...d, payment_verified: e.target.checked })}
                />
                Payment verified
              </label>
            </div>
            {d.stage === "won" && !d.is_demo && !d.contract_verified && !d.payment_verified && (
              <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300">
                Closed Won is not yet verified. This record will not trigger post-sale monitoring.
              </p>
            )}
          </div>
          <div className="sm:col-span-2 mt-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
            <h3 className="font-sans text-sm font-semibold text-emerald-950 dark:text-emerald-50">Ownership & management verification</h3>
            <p className="mt-1 text-xs text-muted-foreground">Record public facts separately from the internal sales owner. Use “Unable to determine” when reliable sources do not establish an answer.</p>
          </div>
          <div className={field}>
            <Label>Property owner</Label>
            <Input value={d.property_owner_name} maxLength={240} onChange={(e) => setD({ ...d, property_owner_name: e.target.value })} />
          </div>
          <div className={field}>
            <Label>Management company</Label>
            <Input value={d.management_company_name} maxLength={240} onChange={(e) => setD({ ...d, management_company_name: e.target.value })} />
          </div>
          <div className={`${field} sm:col-span-2`}>
            <Label>Owner / manager website</Label>
            <Input value={d.owner_manager_website} maxLength={300} placeholder="https://…" onChange={(e) => setD({ ...d, owner_manager_website: e.target.value })} />
          </div>
          <div className={field}>
            <Label>Verification status</Label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize" value={d.ownership_verification_status} onChange={(e) => setD({ ...d, ownership_verification_status: e.target.value as OwnershipVerificationStatus })}>
              {OWNERSHIP_VERIFICATION_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <div className={field}>
            <Label>Confidence (0–100)</Label>
            <Input value={d.ownership_confidence} type="number" min={0} max={100} onChange={(e) => setD({ ...d, ownership_confidence: e.target.value })} />
          </div>
          <div className={field}>
            <Label>Verification date</Label>
            <Input value={d.ownership_verified_at} type="date" onChange={(e) => setD({ ...d, ownership_verified_at: e.target.value })} />
          </div>
          <div className={`${field} sm:col-span-2`}>
            <Label>Verification sources</Label>
            <Textarea rows={3} value={d.ownership_sources} placeholder="One public source URL per line" onChange={(e) => setD({ ...d, ownership_sources: e.target.value })} />
          </div>
          <div className={field}>
            <Label>Lead source</Label>
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
