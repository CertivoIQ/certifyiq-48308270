import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { submitContactSupport } from "@/lib/contact-support.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Panel, Pill } from "@/components/ui-kit";
import { Mail, MessageSquare, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/contact-support")({
  head: () => ({
    meta: [
      { title: "Contact Support — CertivoIQ" },
      {
        name: "description",
        content:
          "Reach the CertivoIQ support team for help with affordable housing compliance, platform questions, or account assistance.",
      },
      { property: "og:title", content: "Contact Support — CertivoIQ" },
      {
        property: "og:description",
        content:
          "Reach the CertivoIQ support team for help with affordable housing compliance, platform questions, or account assistance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactSupportPage,
});

const contactSchema = z.object({
  name: z.string().min(1, "Please enter your name").max(100),
  email: z.string().email("Please enter a valid email").max(120),
  subject: z.string().min(1, "Please enter a subject").max(200),
  message: z.string().min(1, "Please enter a message").max(5000),
});

type ContactForm = { name: string; email: string; subject: string; message: string };

function ContactSupportPage() {
  const [form, setForm] = useState<ContactForm>({ name: "", email: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof ContactForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ caseNumber: string; message: string } | null>(null);

  const update = (field: keyof ContactForm, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const path = issue.path[0];
        if (typeof path === "string") fieldErrors[path] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitContactSupport({ data: parsed.data });
      setSubmitted(result);
      setForm({ name: "", email: "", subject: "", message: "" });
      toast.success("Support request submitted", {
        description: `Case ${result.caseNumber} has been created.`,
      });
    } catch (err) {
      toast.error("Something went wrong", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="brand-gradient grid size-8 place-items-center rounded-[8px] font-mono text-[13px] font-bold text-gold">
              IQ
            </span>
            <span className="font-display text-lg leading-none">Certivo<span className="text-gold">IQ</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/welcome">Demo</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/pricing">Pricing</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/">Open the platform</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-12">
        <Pill tone="seal">Support</Pill>
        <h1 className="mt-4 font-display text-[34px] leading-tight sm:text-[42px]">
          How can we help?
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Submit a question, issue, or request and a CertivoIQ compliance specialist will respond as soon as possible.
        </p>

        <Panel className="mt-8" bodyClassName="p-6 sm:p-8">
          {submitted ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto size-12 text-seal" strokeWidth={1.5} />
              <h2 className="mt-4 font-display text-[22px]">Request received</h2>
              <p className="mt-2 text-[14px] text-muted-foreground">
                {submitted.message}
              </p>
              <p className="mt-4 font-mono text-[13px] font-medium">
                Case number: {submitted.caseNumber}
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Button variant="outline" asChild>
                  <Link to="/">
                    <ArrowLeft className="mr-1.5 size-4" /> Back to CertivoIQ
                  </Link>
                </Button>
                <Button variant="outline" onClick={() => setSubmitted(null)}>
                  Send another request
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                  {errors.name && <p className="text-[12px] text-reject">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                  />
                  {errors.email && <p className="text-[12px] text-reject">{errors.email}</p>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={(e) => update("subject", e.target.value)}
                  placeholder="What is your question about?"
                />
                {errors.subject && <p className="text-[12px] text-reject">{errors.subject}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                  placeholder="Describe your question or issue in detail..."
                  rows={6}
                />
                {errors.message && <p className="text-[12px] text-reject">{errors.message}</p>}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[12px] text-muted-foreground">
                  <MessageSquare className="mr-1 inline size-3.5" />
                  Typical first response time: within one business day.
                </p>
                <Button type="submit" disabled={submitting}>
                  <Mail className="mr-1.5 size-4" />
                  {submitting ? "Submitting..." : "Submit support request"}
                </Button>
              </div>
            </form>
          )}
        </Panel>
      </main>
    </div>
  );
}
