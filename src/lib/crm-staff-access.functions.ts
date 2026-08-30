import { supabase } from "@/integrations/supabase/client";

type AccessLevel = "employee" | "manager" | "admin";
type PhaAgencyRole =
  | "executive"
  | "agency_admin"
  | "compliance_admin"
  | "hcv_pbv_specialist"
  | "public_housing_specialist"
  | "inspection_staff";

type Member = {
  user_id: string;
  access_level: AccessLevel;
  status: "active" | "disabled";
  granted_at: string;
  disabled_at: string | null;
  email: string | null;
  fullName: string | null;
};

type Invitation = {
  id: string;
  invite_email: string;
  access_level: AccessLevel;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  accepted_at: string | null;
  delivery_status: "pending" | "sent" | "failed" | "suppressed";
  delivery_attempt_count: number;
  delivery_error: string | null;
  created_at: string;
};

type ListInput = { data: { accessToken: string } };
type ActionInput = {
  data:
    | { action: "invite"; accessToken: string; email: string; accessLevel: AccessLevel }
    | { action: "invitePha"; accessToken: string; email: string; agencyRole: PhaAgencyRole; workspaceUserId: string }
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
    members: Member[];
    invitations: Invitation[];
  }>({ action: "list" });
}

export async function manageCrmStaffAccess(input: ActionInput) {
  const { accessToken: _accessToken, ...body } = input.data;
  return invoke<{ status: "created" | "sent" | "activated" | "revoked" | "disabled" | "active"; invitationId?: string }>(body);
}
