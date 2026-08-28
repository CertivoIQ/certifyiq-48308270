import { supabase } from "@/integrations/supabase/client";

type AccessLevel = "employee" | "manager" | "admin";

type ListInput = { data: { accessToken: string } };
type ActionInput = {
  data:
    | { action: "invite"; accessToken: string; email: string; accessLevel: AccessLevel }
    | { action: "resend" | "revoke"; accessToken: string; invitationId: string }
    | { action: "disable" | "reactivate"; accessToken: string; targetUserId: string };
};

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("crm-staff-access", { body });
  if (error) throw new Error(error.message || "Staff Access request failed.");
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export async function listCrmStaffAccess(_input: ListInput) {
  return invoke<{
    requesterLevel: "manager" | "admin";
    members: Array<Record<string, unknown>>;
    invitations: Array<Record<string, unknown>>;
  }>({ action: "list" });
}

export async function manageCrmStaffAccess(input: ActionInput) {
  const { accessToken: _accessToken, ...body } = input.data;
  return invoke<{ status: "sent" | "activated" | "revoked" | "disabled" | "active"; invitationId?: string }>(body);
}
