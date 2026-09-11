import { type ReactNode, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui-kit";
import { useSession } from "@/hooks/use-session";
import { isFounderUser } from "@/lib/founder-access";
import { captureFreeReviewLead, getFreeReviewLead } from "@/lib/free-review-lead.functions";

const field = "space-y-1.5";

export function FreeReviewLeadGate({ children }: { children: ReactNode }) {
  const { user, ready } = useSession();
  const isFounder = isFounderUser(user);
  const qc = useQueryClient();
  const getLead = useServerFn(getFreeReviewLead);
  const captureLead = useServerFn(captureFreeReviewLead);
  const lead = useQuery({ queryKey: ["free-review-lead"], queryFn: () => getLead(), enabled: ready && !isFounder });
  const [d, setD] = useState({ companyName: "", contactName: "", email: "" });

  const save = useMutation({
    mutationFn: () =>
      captureLead({
        data: {
          companyName: d.companyName,
          contactName: d.contactName,
          email: (d.email || user?.email || "").trim(),
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["free-review-lead"] });
      toast.success("Your 3 FREE certification reviews are ready");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save your company information"),
  });

  if (!ready || (!isFounder && lead.isLoading)) {
    return <Panel title="Preparing your 3 FREE certification reviews" description="Checking your review access…"><div className="h-20 animate-pulse rounded-lg bg-muted" /></Panel>;
  }

  if (isFounder || lead.data) return <>{children}</>;

  return (
    <Panel
      title="Start your 3 FREE certification reviews"
      description="Enter your company, contact name, and organization email, then continue directly to certification upload."
      bodyClassName="p-5"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="font-medium">Only the essentials before upload</p>
            <p className="mt-1 text-sm text-muted-foreground">An organization website email is required for the 3 FREE certification reviews.</p>
          </div>
        </div>

        <div className={field}>
          <Label>Company *</Label>
          <Input value={d.companyName} onChange={(e) => setD({ ...d, companyName: e.target.value })} placeholder="Your company" />
        </div>
        <div className={field}>
          <Label>Contact Name *</Label>
          <Input value={d.contactName} onChange={(e) => setD({ ...d, contactName: e.target.value })} placeholder="Full name" />
        </div>
        <div className={`${field} lg:col-span-2`}>
          <Label>Email *</Label>
          <Input type="email" value={d.email || user?.email || ""} onChange={(e) => setD({ ...d, email: e.target.value })} placeholder="name@company.com" />
        </div>
      </div>

      <Button className="mt-5 w-full sm:w-auto" size="lg" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? "Preparing your FREE reviews…" : "Continue to upload"}
      </Button>
    </Panel>
  );
}
