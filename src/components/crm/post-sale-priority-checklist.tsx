import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleDollarSign, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel, Pill } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { POST_SALE_PRIORITIES } from "@/lib/post-sale-priorities";

export type PostSaleChecklistEvent = {
  id: string;
  account_id: string;
  status: "pending" | "acknowledged" | "completed" | "cancelled";
  trigger_reason: string;
  detected_at: string;
  surfaced_at: string | null;
  crm_accounts: {
    id: string;
    name: string;
    arr: number;
    closed_won_at: string | null;
  };
};

export function PostSalePriorityChecklist({ event }: { event: PostSaleChecklistEvent }) {
  const queryClient = useQueryClient();
  const contractValue = "$" + Math.round(Number(event.crm_accounts.arr)).toLocaleString();

  useEffect(() => {
    if (event.surfaced_at) return;
    void supabase
      .from("crm_post_sale_checklists")
      .update({ surfaced_at: new Date().toISOString() })
      .eq("id", event.id)
      .is("surfaced_at", null);
  }, [event.id, event.surfaced_at]);

  const updateStatus = useMutation({
    mutationFn: async (status: "acknowledged" | "completed") => {
      const now = new Date().toISOString();
      const changes = status === "acknowledged"
        ? { status, acknowledged_at: now }
        : { status, completed_at: now };
      const { error } = await supabase
        .from("crm_post_sale_checklists")
        .update(changes)
        .eq("id", event.id);
      if (error) throw error;
    },
    onSuccess: (_, status) => {
      toast.success(status === "completed" ? "Post-sale priorities completed" : "Checklist acknowledged");
      void queryClient.invalidateQueries({ queryKey: ["crm", "post-sale-checklists"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Panel className="border-emerald-400/40 bg-emerald-500/5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-300">
            <CircleDollarSign className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-white">Verified sale: activate post-sale priorities</h2>
              <Pill tone="seal">Verified Closed Won</Pill>
            </div>
            <p className="mt-1 text-sm text-white/65">
              {event.crm_accounts.name} · {contractValue} annual contract value
            </p>
            <p className="mt-1 text-xs text-white/45">
              This surfaced only after a real, non-demo account had a verified contract or payment.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {event.status === "pending" && (
            <Button
              variant="outline"
              onClick={() => updateStatus.mutate("acknowledged")}
              disabled={updateStatus.isPending}
            >
              Acknowledge
            </Button>
          )}
          <Button
            onClick={() => updateStatus.mutate("completed")}
            disabled={updateStatus.isPending}
            className="bg-emerald-500 text-black hover:bg-emerald-400"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Mark complete
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {POST_SALE_PRIORITIES.map((priority) => (
          <div key={priority.title} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              {priority.title}
            </div>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-white/60">
              {priority.items.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  );
}
