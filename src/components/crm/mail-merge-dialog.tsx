import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

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
import { sendMailMerge } from "@/lib/crm-outreach.functions";
import { mergeTokens, type Account, type Campaign, type Template } from "@/lib/crm";

const field = "space-y-1.5";

const DEFAULT_BODY = `Hi {{first_name}},

{{company}} manages {{units}} affordable units across {{states}} — every one of those files has to survive a {{programs}} audit.

CertivoIQ reviews tenant income certifications and TICs against program rules before an auditor ever sees them, gives a pass/fail score with correction steps, and keeps a human sign-off on record.

Worth a 15-minute look at how it would score your last 10 certifications?`;

export function MailMergeDialog({
  open,
  onOpenChange,
  accounts,
  templates,
  campaigns,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accounts: Account[];
  templates: Template[];
  campaigns: Campaign[];
}) {
  const qc = useQueryClient();
  const send = useServerFn(sendMailMerge);
  const [d, setD] = useState({
    subject: "Your {{programs}} certifications, audit-ready before the state asks",
    body: DEFAULT_BODY,
    ctaLabel: "See a 2-minute demo",
    ctaUrl: "https://certivoiq.com/welcome",
    campaignId: "",
  });

  useEffect(() => {
    if (open) setD((p) => ({ ...p, campaignId: "" }));
  }, [open]);

  const preview = accounts[0];
  const mutation = useMutation({
    mutationFn: async () =>
      send({
        data: {
          accountIds: accounts.map((a) => a.id),
          subject: d.subject,
          body: d.body,
          ctaLabel: d.ctaLabel,
          ctaUrl: d.ctaUrl,
          campaignId: d.campaignId || null,
        },
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["crm"] });
      if (r.sent) toast.success(`${r.sent} personalized emails sent`);
      if (r.skipped.length) {
        toast.warning(`${r.skipped.length} skipped`, {
          description: r.skipped
            .slice(0, 4)
            .map((s) => `${s.company}: ${s.reason}`)
            .join(" · "),
        });
      }
      if (r.sent) onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Send failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mail merge · {accounts.length} leads</DialogTitle>
          <DialogDescription>
            Tokens available: {"{{company}} {{contact}} {{first_name}} {{hq}} {{units}} {{properties}} {{states}} {{programs}} {{plan}}"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5">
          <div className={field}>
            <Label>Start from a template</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-[13px]"
              onChange={(e) => {
                const t = templates.find((x) => x.id === e.target.value);
                if (t) setD((p) => ({ ...p, subject: t.subject, body: t.body, ctaLabel: t.cta_label ?? p.ctaLabel }));
              }}
              defaultValue=""
            >
              <option value="">Custom message</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className={field}>
            <Label htmlFor="mm-subject">Subject</Label>
            <Input id="mm-subject" value={d.subject} onChange={(e) => setD({ ...d, subject: e.target.value })} />
          </div>

          <div className={field}>
            <Label htmlFor="mm-body">Message</Label>
            <Textarea id="mm-body" rows={10} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className={field}>
              <Label htmlFor="mm-cta">Button label</Label>
              <Input id="mm-cta" value={d.ctaLabel} onChange={(e) => setD({ ...d, ctaLabel: e.target.value })} />
            </div>
            <div className={field}>
              <Label htmlFor="mm-url">Button link</Label>
              <Input id="mm-url" value={d.ctaUrl} onChange={(e) => setD({ ...d, ctaUrl: e.target.value })} />
            </div>
          </div>

          <div className={field}>
            <Label>Attribute to campaign</Label>
            <select
              value={d.campaignId}
              onChange={(e) => setD({ ...d, campaignId: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-[13px]"
            >
              <option value="">No campaign</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {preview && (
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
              <p className="cite">Preview · {preview.name}</p>
              <p className="mt-1 text-[13.5px] font-medium">{mergeTokens(d.subject, preview)}</p>
              <p className="mt-1.5 text-[12.5px] whitespace-pre-wrap text-muted-foreground">
                {mergeTokens(d.body, preview)}
              </p>
            </div>
          )}

          <p className="cite">
            Leads without a verified email are skipped and reported back — nothing is sent to an unverified address.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send to{" "}
            {accounts.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
