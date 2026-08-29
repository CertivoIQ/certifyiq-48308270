import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHash, randomBytes } from "crypto";

const RECOVERY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_COUNT = 10;

function generateRawCode() {
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const idx = bytes[i]! % RECOVERY_CODE_ALPHABET.length;
    out += RECOVERY_CODE_ALPHABET[idx];
  }
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

/** Generate a fresh set of recovery codes for the authenticated user. */
export const generateRecoveryCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: deleteError } = await supabaseAdmin
      .from("user_recovery_codes")
      .delete()
      .eq("user_id", context.userId)
      .is("used_at", null);
    if (deleteError) throw deleteError;

    const codes = Array.from({ length: CODE_COUNT }, generateRawCode);
    const { error: insertError } = await supabaseAdmin.from("user_recovery_codes").insert(
      codes.map((code) => ({ user_id: context.userId, code_hash: hashCode(code) })),
    );
    if (insertError) throw insertError;

    return { codes };
  });

/**
 * Verify a recovery code for the currently authenticated user and disable their
 * MFA factors. Intended for sign-in recovery when a user loses their
 * authenticator app: the user is already signed in at AAL1, and this validates
 * the recovery code and removes the TOTP factor so they can proceed.
 */
export const verifyAndDisableRecoveryCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => {
    if (!data.code || typeof data.code !== "string" || data.code.length < 14) {
      throw new Error("Invalid recovery code");
    }
    return { code: data.code.replace(/\s+/g, "").toUpperCase() };
  })
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const targetHash = hashCode(data.code);

    const { data: rows, error: findError } = await supabaseAdmin
      .from("user_recovery_codes")
      .select("id, used_at")
      .eq("user_id", context.userId)
      .eq("code_hash", targetHash)
      .limit(1);
    if (findError) return { error: "Could not verify recovery code" };
    const row = rows?.[0];
    if (!row) return { error: "Invalid recovery code" };
    if (row.used_at) return { error: "Recovery code already used" };

    const { data: factorData, error: factorError } = await supabaseAdmin.auth.admin.mfa.listFactors({
      userId: context.userId,
    });
    if (factorError) return { error: "Could not list MFA factors" };

    for (const factor of factorData?.factors ?? []) {
      const { error } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
        id: factor.id,
        userId: context.userId,
      });
      if (error) return { error: "Could not disable MFA" };
    }

    const { error: updateError } = await supabaseAdmin
      .from("user_recovery_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id);
    if (updateError) return { error: "Could not mark recovery code as used" };

    return { ok: true };
  });

/** Count unused recovery codes for the authenticated user. */
export const countRecoveryCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await context.supabase
      .from("user_recovery_codes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("used_at", null);
    if (error) throw error;
    return { count: count ?? 0 };
  });
