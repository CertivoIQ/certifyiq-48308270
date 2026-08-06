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
import type { Campaign, Template } from "@/lib/crm";

const field = "space-y-1.5";

export function CampaignDialog({
  open,
  onOpenChange,
  templates,
  campaign,
  presetTemplateId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templates: Template[];
  campaign?: Campaign | null;
  presetTemplateId?: string | null;
}) {
  const qc = useQueryClient();
  const [d, setD] = useState({
    name: "",
    audience: "",
    compliance_event: "",
    subject: "",
    body: "",
    status: "draft",
    template_id: "",
    scheduled_for: "",
  });

  useEffect(() => {
    if (!open) return;
    if (campaign) {
      setD({
        name: campaign.name,
        audience: campaign.audience ?? "",
        compliance_event: campaign.compliance_event ?? "",
        subject: campaign.subject ?? "",
        body: campaign.body ?? "",
        status: campaign.status,
        template_id: campaign.template_id ?? "",
        scheduled_for: campaign.scheduled_for ? campaign.scheduled_for.slice(0, 16) : "",
      });
      return;
    }
    const t = templates.find((x) => x.id === presetTemplateId);
    setD({
      name: t ? `${t.name} — outbound` : "",
      audience: "",
      compliance_event: t?.compliance_event ?? "",
      subject: t?.subject ?? "",
      body: t?.body ?? "",
      status: "draft",
      template_id: t?.id ?? "",
      scheduled_for: "",
    });
  }, [open, campaign, presetTemplateId, templates]);

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    setD((prev) => ({
      ...prev,
      template_id: id,
      subject: t?.subject ?? prev.subject,
      body: t?.body ?? prev.body,
      compliance_event: t?.compliance_event ?? prev.compliance_event,
      name: prev.name || (t ? `${t.name} — outbound` : ""),
    }));
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!d.name.trim()) throw new Error("Campaign name is required");
      const payload = {
        name: d.name.trim(),
        channel: "email",
        audience: d.audience.trim() || null,
        compliance_event: d.compliance_event.trim() || null,
        subject: d.subject.trim() || null,
        body: d.body.trim() || null,
        status: d.status,
        template_id: d.template_id || null,
        scheduled_for: d.scheduled_for ? new Date(d.scheduled_for).toISOString() : null,
      };
      if (campaign) {
        const { error } = await supabase.from("crm_campaigns").update(payload).eq("id", campaign.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("crm_campaigns").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm"] });
      toast.success(campaign ? "Campaign updated" : "Campaign created");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit campaign" : "New marketing campaign"}</DialogTitle>
          <DialogDescription>
            Start from a compliance-event template, then choose the audience and schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className={`${field} sm:col-span-2`}>
            <Label>Start from template</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={d.template_id}
              onChange={(e) => applyTemplate(e.target.value)}
            >
              <option value="">No template — write from scratch</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className={`${field} sm:col-span-2`}>
            <Label>Campaign name</Label>
            <Input value={d.name} maxLength={160} onChange={(e) => setD({ ...d, name: e.target.value })} />
          </div>
          <div className={field}>
            <Label>Audience</Label>
            <Input
              value={d.audience}
              maxLength={200}
              placeholder="Enterprise non-subscribers · VP Property Management"
              onChange={(e) => setD({ ...d, audience: e.target.value })}
            />
          </div>
          <div className={field}>
            <Label>Federal compliance event</Label>
            <Input
              value={d.compliance_event}
              maxLength={200}
              onChange={(e) => setD({ ...d, compliance_event: e.target.value })}
            />
          </div>
          <div className={field}>
            <Label>Status</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={d.status}
              onChange={(e) => setD({ ...d, status: e.target.value })}
            >
              {["draft", "scheduled", "sending", "active", "paused", "complete"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className={field}>
            <Label>Send at</Label>
            <Input
              type="datetime-local"
              value={d.scheduled_for}
              onChange={(e) => setD({ ...d, scheduled_for: e.target.value })}
            />
          </div>
          <div className={`${field} sm:col-span-2`}>
            <Label>Subject line</Label>
            <Input value={d.subject} maxLength={240} onChange={(e) => setD({ ...d, subject: e.target.value })} />
          </div>
          <div className={`${field} sm:col-span-2`}>
            <Label>Body</Label>
            <Textarea
              rows={10}
              value={d.body}
              maxLength={8000}
              onChange={(e) => setD({ ...d, body: e.target.value })}
            />
            <p className="cite">Merge fields: {"{{first_name}}"}, {"{{company}}"}, {"{{cert_count}}"}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {campaign ? "Save campaign" : "Create campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
