import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Lightbulb, Send } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { useCrmStaffAuthority } from "@/hooks/use-crm-staff-authority";
import { useSession } from "@/hooks/use-session";
import { useWorkspaceProfile } from "@/hooks/use-workspace-profile";
import { supabase } from "@/integrations/supabase/client";
import { submitFeatureSuggestion } from "@/lib/feature-suggestions.functions";

export const Route = createFileRoute("/_authenticated/feature-suggestions")({
  head: () => ({
    meta: [
      { title: "Suggest a Feature — CertivoIQ" },
      {
        name: "description",
        content: "Submit role-aware product, workflow, reporting, integration, and accessibility suggestions to the CertivoIQ product team.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: FeatureSuggestionsPage,
});

type Category = "feature" | "workflow" | "integration" | "reporting" | "accessibility" | "other";
type Priority = "nice_to_have" | "important" | "critical";
type Suggestion = {
  id: string;
  category: Category;
  priority: Priority;
  title: string;
  status: "submitted" | "under_review" | "planned" | "declined" | "shipped";
  email_delivery_status: "pending" | "sent" | "suppressed" | "failed";
  created_at: string;
};

const inputClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const initialForm = {
  category: "feature" as Category,
  priority: "important" as Priority,
  title: "",
  description: "",
  expectedOutcome: "",
  currentPage: "",
};

function FeatureSuggestionsPage() {
  const { user } = useSession();
  const { profile, phaRole } = useWorkspaceProfile();
  const { accessLevel } = useCrmStaffAuthority();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initialForm);

  const roleLabel = profile.organization_type === "pha"
    ? (phaRole ?? "PHA user").replaceAll("_", " ")
    : accessLevel
      ? `CRM ${accessLevel}`
      : "workspace owner";

  const suggestions = useQuery<Suggestion[]>({
    queryKey: ["feature-suggestions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Generated types intentionally lag the release migration.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client
        .from("product_feature_suggestions")
        .select("id,category,priority,title,status,email_delivery_status,created_at")
        .eq("submitted_by", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const { data: sessionData, error } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (error || !accessToken) throw new Error("Refresh your CertivoIQ session before submitting.");
      return submitFeatureSuggestion({
        data: {
          accessToken,
          category: form.category,
          priority: form.priority,
          title: form.title,
          description: form.description,
          expectedOutcome: form.expectedOutcome || undefined,
          currentPage: form.currentPage || undefined,
        },
      });
    },
    onSuccess: async (result) => {
      setForm(initialForm);
      await queryClient.invalidateQueries({ queryKey: ["feature-suggestions", user?.id] });
      if (result.deliveryStatus === "sent") {
        toast.success("Suggestion sent to the CertivoIQ product team");
      } else {
        toast.success("Suggestion recorded", {
          description: "Your suggestion is safely stored for product review.",
        });
      }
    },
    onError: (error) => {
      toast.error("Suggestion could not be submitted", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  const rows = suggestions.data ?? [];
  return (
    <AppShell
      title="Suggest a Feature"
      subtitle="Help shape CertivoIQ from the perspective of your actual role and daily work"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Your role" value={roleLabel} hint="Attached automatically to every suggestion" />
        <Stat label="Your submissions" value={rows.length} hint="Most recent 20 suggestions" />
        <Stat label="Product channel" value="Direct" hint="Delivered privately to the CertivoIQ product team" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
        <Panel
          title="Share an idea"
          description="Tell us what would make your role faster, clearer, safer, or more effective. Your account, workspace, and role are attached automatically."
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-medium">
                Suggestion type
                <select
                  className={inputClass}
                  value={form.category}
                  onChange={(event) => setForm((value) => ({ ...value, category: event.target.value as Category }))}
                >
                  <option value="feature">New feature or function</option>
                  <option value="workflow">Workflow improvement</option>
                  <option value="integration">Integration</option>
                  <option value="reporting">Report or dashboard</option>
                  <option value="accessibility">Accessibility improvement</option>
                  <option value="other">Other idea</option>
                </select>
              </label>
              <label className="block text-xs font-medium">
                Importance to your work
                <select
                  className={inputClass}
                  value={form.priority}
                  onChange={(event) => setForm((value) => ({ ...value, priority: event.target.value as Priority }))}
                >
                  <option value="nice_to_have">Nice to have</option>
                  <option value="important">Important</option>
                  <option value="critical">Critical workflow blocker</option>
                </select>
              </label>
            </div>

            <div>
              <Label htmlFor="suggestion-title">Short title</Label>
              <Input
                id="suggestion-title"
                required
                minLength={5}
                maxLength={160}
                className="mt-1"
                value={form.title}
                onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))}
                placeholder="Example: Add a transfer aging report"
              />
            </div>

            <div>
              <Label htmlFor="suggestion-description">What should CertivoIQ do?</Label>
              <Textarea
                id="suggestion-description"
                required
                minLength={20}
                maxLength={5000}
                rows={7}
                className="mt-1"
                value={form.description}
                onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))}
                placeholder="Describe the current problem, the proposed function, and when your role would use it."
              />
            </div>

            <div>
              <Label htmlFor="suggestion-outcome">What result would improve?</Label>
              <Textarea
                id="suggestion-outcome"
                maxLength={2000}
                rows={3}
                className="mt-1"
                value={form.expectedOutcome}
                onChange={(event) => setForm((value) => ({ ...value, expectedOutcome: event.target.value }))}
                placeholder="Optional: time saved, risk reduced, clearer reporting, better accessibility…"
              />
            </div>

            <div>
              <Label htmlFor="suggestion-page">Module or page</Label>
              <Input
                id="suggestion-page"
                maxLength={300}
                className="mt-1"
                value={form.currentPage}
                onChange={(event) => setForm((value) => ({ ...value, currentPage: event.target.value }))}
                placeholder="Optional: Public Housing Occupancy, Findings, CRM…"
              />
            </div>

            <Button type="submit" disabled={submit.isPending} className="w-full sm:w-auto">
              <Send className="size-4" />
              {submit.isPending ? "Sending suggestion…" : "Send suggestion"}
            </Button>
          </form>
        </Panel>

        <Panel
          title="What happens next"
          description="Suggestions are evidence for product planning, not support tickets or compliance determinations."
        >
          <div className="space-y-3 text-sm">
            <div className="flex gap-3 rounded-lg border border-border p-3">
              <Lightbulb className="mt-0.5 size-5 shrink-0 text-primary" />
              <div><strong>Role context is preserved.</strong><p className="mt-1 text-xs text-muted-foreground">The product team sees which workspace and role would benefit.</p></div>
            </div>
            <div className="flex gap-3 rounded-lg border border-border p-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-seal" />
              <div><strong>Your history stays visible.</strong><p className="mt-1 text-xs text-muted-foreground">You can see whether an idea is submitted, under review, planned, declined, or shipped.</p></div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="mt-4" title="Your recent suggestions" description="Only you and authorized CertivoIQ staff can view these records.">
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div>
                <p className="font-medium">{row.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.category.replaceAll("_", " ")} · {row.priority.replaceAll("_", " ")} · {new Date(row.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Pill tone={row.status === "shipped" ? "seal" : undefined}>{row.status.replaceAll("_", " ")}</Pill>
                {row.email_delivery_status === "sent" ? <Pill tone="seal">Product team notified</Pill> : null}
              </div>
            </div>
          ))}
          {!suggestions.isLoading && rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">You have not submitted a product suggestion yet.</p>
          ) : null}
        </div>
      </Panel>
    </AppShell>
  );
}
