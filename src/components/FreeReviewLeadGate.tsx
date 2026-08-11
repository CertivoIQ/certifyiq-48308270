import { type ReactNode, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Mail, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui-kit";
import { captureFreeReviewLead, getFreeReviewLead } from "@/lib/free-review-lead.functions";

const field = "space-y-1.5";
const splitList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export function FreeReviewLeadGate({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const getLead = useServerFn(getFreeReviewLead);
  const captureLead = useServerFn(captureFreeReviewLead);
  const lead = useQuery({ queryKey: ["free-review-lead"], queryFn: () => getLead() });
  const [d, setD] = useState({
    companyName: "",
    ownerName: "",
    ownerTitle: "",
    email: "",
    phone: "",
    units: "",
    properties: "",
    hq: "",
    states: "",
    programs: "",
    marketingConsent: false,
  });

  const save = useMutation({
    mutationFn: () =>
      captureLead({
        data: {
          companyName: d.companyName,
          ownerName: d.ownerName,
          ownerTitle: d.ownerTitle,
          email: d.email,
          phone: d.phone,
          units: Number(d.units),
          properties: Number(d.properties),
          hq: d.hq,
          states: splitList(d.states),
          programs: splitList(d.programs),
          marketingConsent: d.marketingConsent,
        },
      }),
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["free-review-lead"] });
      toast.success("You're cleared for 3 FREE certification reviews", {
        description: `CRM lead captured. Recommended plan: ${result.plan}.`,
      });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save your company information"),
  });

  if (lead.isLoading) {
    return <Panel title="Preparing your 3 FREE certification reviews" description="Checking your review access…"><div className="h-20 animate-pulse rounded-lg bg-muted" /></Panel>;
  }

  if (lead.data) return <>{children}</>;

  return (
    <Panel
      title="Tell us about your company before your 3 FREE reviews"
      description="This one-time step creates your warm lead in our CRM and lets us recommend the right plan for your portfolio. Your certification files remain yours."
      bodyClassName="p-5"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="font-medium">Required before any FREE certification upload</p>
            <p className="mt-1 text-sm text-muted-foreground">We use these details to personalize your CRM record, calculate the best-fit plan, and populate recipient fields in future email outreach.</p>
          </div>
        </div>

        <div className={field}>
          <Label>Company name *</Label>
          <Input value={d.companyName} onChange={(e) => setD({ ...d, companyName: e.target.value })} placeholder="Your company" />
        </div>
        <div className={field}>
          <Label>Owner / decision-maker name *</Label>
          <Input value={d.ownerName} onChange={(e) => setD({ ...d, ownerName: e.target.value })} placeholder="Full name" />
        </div>
        <div className={field}>
          <Label>Owner / decision-maker title *</Label>
          <Input value={d.ownerTitle} onChange={(e) => setD({ ...d, ownerTitle: e.target.value })} placeholder="Owner, CEO, VP Property Management…" />
        </div>
        <div className={field}>
          <Label>Business email *</Label>
          <Input type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} placeholder="name@company.com" />
        </div>
        <div className={field}>
          <Label>Phone (optional)</Label>
          <Input value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} placeholder="(555) 555-5555" />
        </div>
        <div className={field}>
          <Label>Total portfolio units *</Label>
          <Input type="number" min="1" value={d.units} onChange={(e) => setD({ ...d, units: e.target.value })} placeholder="12,000" />
        </div>
        <div className={field}>
          <Label>Total portfolio properties *</Label>
          <Input type="number" min="1" value={d.properties} onChange={(e) => setD({ ...d, properties: e.target.value })} placeholder="120" />
        </div>
        <div className={field}>
          <Label>Headquarters / primary market *</Label>
          <Input value={d.hq} onChange={(e) => setD({ ...d, hq: e.target.value })} placeholder="Atlanta, GA" />
        </div>
        <div className={field}>
          <Label>States / markets served *</Label>
          <Input value={d.states} onChange={(e) => setD({ ...d, states: e.target.value })} placeholder="GA, FL, TN" />
        </div>
        <div className="lg:col-span-2 space-y-1.5">
          <Label>Housing programs in your portfolio *</Label>
          <Input value={d.programs} onChange={(e) => setD({ ...d, programs: e.target.value })} placeholder="LIHTC, Section 8, HOME" />
        </div>

        <div className="lg:col-span-2 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <input id="free-review-marketing-consent" type="checkbox" checked={d.marketingConsent} onChange={(e) => setD({ ...d, marketingConsent: e.target.checked })} className="mt-1 size-4 rounded border" />
            <label htmlFor="free-review-marketing-consent" className="text-sm leading-5">
              I agree to receive CertivoIQ emails about my FREE reviews, relevant compliance updates, and plan recommendations. I can unsubscribe from marketing emails at any time.
            </label>
          </div>
        </div>

        <div className="lg:col-span-2 grid gap-3 sm:grid-cols-3 rounded-lg border border-border p-4 text-sm">
          <div className="flex gap-2"><Building2 className="size-4 text-primary" /><span>CRM company record</span></div>
          <div className="flex gap-2"><Users className="size-4 text-primary" /><span>Primary decision-maker contact</span></div>
          <div className="flex gap-2"><Mail className="size-4 text-primary" /><span>Personalized email fields</span></div>
        </div>
      </div>

      <Button className="mt-5 w-full sm:w-auto" size="lg" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? "Saving your lead…" : "Continue to my 3 FREE certification reviews"}
      </Button>

      <p className="mt-3 text-xs text-muted-foreground">
        Your portfolio unit count determines the initial plan recommendation: Professional up to 500 units, Business up to 10,000, and Enterprise above 10,000.
      </p>
    </Panel>
  );
}
