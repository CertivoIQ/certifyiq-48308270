import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().min(1).max(120),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  locale: z.enum(["en", "es"]).optional(),
});

export const submitContactSupport = createServerFn({ method: "POST" })
  .inputValidator((data) => contactSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

    const { data: caseRow, error: caseError } = await supabaseAdmin
      .from("support_cases")
      .insert({
        subject: data.subject,
        description: data.message,
        source_email: data.email,
        channel: "web",
        status: "open",
        priority: "normal",
        tags: ["inbound", "contact-form"],
      })
      .select("id, case_number")
      .single();

    if (caseError || !caseRow) {
      console.error("Contact support insert error:", caseError);
      throw new Error("Could not create support case. Please try again.");
    }

    try {
      await sendTemplateEmail(
        "support-request-received",
        data.email,
        {
          templateData: {
            name: data.name,
            caseNumber: caseRow.case_number,
            subject: data.subject,
            locale: data.locale ?? "en",
          },
          idempotencyKey: `support-request-${caseRow.id}`,
        }
      );
    } catch (err) {
      console.error("Failed to send support confirmation email:", err);
      // Do not fail the submission if the confirmation email fails.
    }

    return {
      caseNumber: caseRow.case_number,
      message: "Your support request has been received. A specialist will review it shortly.",
    };
  });
