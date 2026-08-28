import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

async function decide(approvalId: string, action: "approve" | "reject", reason: string) {
  const functionName = action === "approve" ? "operations_approve" : "operations_reject";
  const { error } = await supabase.rpc(
    functionName as never,
    { _approval_id: approvalId, _reason: reason } as never,
  );
  if (error) throw error;
}

export function OperationsApprovalActions({
  approvalId,
  actionType,
}: {
  approvalId: string;
  actionType: string;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ action, reason }: { action: "approve" | "reject"; reason: string }) =>
      decide(approvalId, action, reason),
    onSuccess: async (_, variables) => {
      toast.success(`${actionType} ${variables.action === "approve" ? "approved" : "rejected"}`);
      await Promise.all([\n        queryClient.invalidateQueries({ queryKey: ["crm", "operations-control-center"] }),\n        queryClient.invalidateQueries({ queryKey: ["governance-tasks"] }),\n      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Approval action failed"),
  });

  const act = (action: "approve" | "reject") => {
    const label = action === "approve" ? "approval reason" : "rejection reason";
    const reason = window.prompt(`Enter the required ${label} for “${actionType}”.`);
    if (!reason?.trim()) {
      toast.error("A written reason is required.");
      return;
    }
    mutation.mutate({ action, reason: reason.trim() });
  };

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button size="sm" disabled={mutation.isPending} onClick={() => act("approve")}>
        <Check className="size-3.5" /> Approve
      </Button>
      <Button size="sm" variant="destructive" disabled={mutation.isPending} onClick={() => act("reject")}>
        <X className="size-3.5" /> Reject
      </Button>
    </div>
  );
}
