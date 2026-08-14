import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, LifeBuoy, Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui-kit";
import { triageSupportRequest } from "@/utils/supportiq.functions";

export const Route = createFileRoute("/_authenticated/supportiq")({
  head: () => ({
    meta: [
      { title: "SupportIQ — CertivoIQ Support" },
      {
        name: "description",
        content:
          "Self-service CertivoIQ product support with automatic escalation for billing, production, security, privacy, and compliance questions.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SupportIqPage,
});

const examples = [
  "How do I upload a certification?",
  "Where is my evidence manifest?",
  "What does NOT_DETERMINED mean?",
  "Where is my invoice?",
];

function SupportIqPage() {
  const runTriage = useServerFn(triageSupportRequest);
  const [message, setMessage] = useState("");

  const request = useMutation({
    mutationFn: () =>
      runTriage({
        data: {
          message,
          // This confidence applies only to the approved deterministic routine library.
          // Unknown or high-risk categories are still forced into human review.
          confidence: 0.95,
        },
      }),
  });

  const result = request.data;
  const isEscalated = result?.caseCreated === true;
  const isSecurity = result?.classification?.priority === "P0_SECURITY";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <LifeBuoy className="size-4" />
          SupportIQ
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          CertivoIQ virtual customer support
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Ask a product question. Routine usage questions can be answered immediately from approved CertivoIQ guidance. Billing, production, security, privacy, low-confidence, and compliance/legal questions are routed to a human rather than guessed.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_0.9fr]">
        <Panel
          title="How can SupportIQ help?"
          description="Do not include unnecessary resident PII, passwords, full payment-card numbers, or other secrets in your message."
          bodyClassName="p-5"
        >
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Example: How do I upload a certification?"
            rows={7}
            className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {examples.map((example) => (
              <button
                type="button"
                key={example}
                onClick={() => setMessage(example)}
                className="rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>

          <Button
            className="mt-5"
            onClick={() => request.mutate()}
            disabled={request.isPending || !message.trim()}
          >
            {request.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Reviewing request…
              </>
            ) : (
              "Ask SupportIQ"
            )}
          </Button>

          {request.isError ? (
            <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p>
                  {request.error instanceof Error
                    ? request.error.message
                    : "SupportIQ could not process the request."}
                </p>
              </div>
            </div>
          ) : null}

          {result ? (
            <div
              className={`mt-5 rounded-lg border p-4 ${
                isSecurity
                  ? "border-destructive/30 bg-destructive/5"
                  : isEscalated
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-primary/20 bg-primary/5"
              }`}
            >
              <div className="flex items-start gap-3">
                {isSecurity ? (
                  <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
                ) : isEscalated ? (
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
                ) : (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
                )}
                <div>
                  <p className="font-medium">
                    {isEscalated ? "Human review created" : "SupportIQ response"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{result.reply}</p>
                  {result.supportCase?.case_number ? (
                    <p className="mt-2 text-xs font-medium">
                      Case: {result.supportCase.case_number} · Priority: {result.classification.priority}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </Panel>

        <div className="space-y-5">
          <Panel
            title="Automatic resolution"
            description="Routine product-use questions only"
            bodyClassName="p-5"
          >
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Navigation and standard workflow guidance</li>
              <li>• Upload and property-setup guidance</li>
              <li>• Evidence-manifest and finding location guidance</li>
              <li>• Standard submission-state explanations</li>
              <li>• Standard billing-page navigation</li>
            </ul>
          </Panel>

          <Panel
            title="Human-required issues"
            description="SupportIQ creates or routes a case instead of taking sensitive action"
            bodyClassName="p-5"
          >
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Security/privacy: immediate escalation</li>
              <li>• Production/UI outage: human escalation</li>
              <li>• Billing disputes/refunds: human authorization</li>
              <li>• Compliance/legal interpretation: qualified human review</li>
              <li>• Unknown or low-confidence questions: support queue</li>
            </ul>
          </Panel>

          <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
            SupportIQ cannot override findings, approve certifications, change enterprise contract terms, issue material refunds, change permissions during a suspected security incident, or provide legal advice.
          </div>
        </div>
      </div>
    </main>
  );
}
