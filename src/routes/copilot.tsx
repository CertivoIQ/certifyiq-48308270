import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Cite } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, User } from "lucide-react";

export const Route = createFileRoute("/copilot")({
  head: () => ({
    meta: [
      { title: "AI Compliance Copilot — CertivoIQ" },
      {
        name: "description",
        content:
          "Ask why a certification failed, get the HUD or IRS citation, household history and recommended remediation — grounded in deterministic engine output.",
      },
      { property: "og:title", content: "AI Compliance Copilot — CertivoIQ" },
      {
        property: "og:description",
        content: "The engine supplies the facts. The copilot explains them, with citations a reviewer can check.",
      },
      { property: "og:url", content: "https://certivoiq.com/copilot" },
    ],
    links: [{ rel: "canonical", href: "https://certivoiq.com/copilot" }],
  }),
  component: CopilotPage,
});

type Msg = { role: "user" | "agent"; text: string; cites?: string[] };

const SUGGESTIONS = [
  "Why did TIC-2026-0418 fail?",
  "Explain LIHTC-004 in plain language.",
  "Show every household affected by the HOTMA medical deduction change.",
  "Has this household failed a review before?",
  "Recommend remediation for F-9014.",
];

const CANNED: Record<string, Msg> = {
  "Why did TIC-2026-0418 fail?": {
    role: "agent",
    text: "TIC-2026-0418 (Whitfield, Danielle · Harper Mill 214B) has three open findings, all from the HOTMA pack.\n\n1. HOTMA-104 v2.0 — net assets of $54,200 exceed the $50,000 indexed safe harbor, so self-certification is no longer sufficient and actual asset income must be computed.\n2. HOTMA-208 v2.1 — the medical deduction was taken at the pre-HOTMA 3% threshold. At 10%, the allowable deduction falls $2,691 and TTP rises $67/month.\n3. HOTMA-505 v1.0 — no EIV income report is in the file within 90 days of the 2026-08-01 effective date.\n\nThe income and rent tests both passed. Nothing here is a LIHTC eligibility failure — it is a HOTMA calculation and documentation problem, which means the file can be corrected rather than the household displaced.",
    cites: ["24 CFR 5.609(a)(2)", "24 CFR 5.611(a)(3)", "HUD Handbook 4350.3 Ch. 9"],
  },
  "Explain LIHTC-004 in plain language.": {
    role: "agent",
    text: "LIHTC-004 is the Next Available Unit Rule. When you recertify a household in a low-income unit and their income has climbed above 140% of the applicable limit, the household does not have to move — but that unit stops counting toward your set-aside until you offset it. The offset happens by renting the next comparable-or-smaller unit that becomes vacant to an income-qualified household. If you instead rent that vacancy at market, the over-income unit's credits are at risk and the owner is exposed on Form 8823.\n\nException: at a 100% LIHTC property where every unit is low-income, there is no market unit to rent, so the rule has no practical effect.",
    cites: ["IRC 42(g)(2)(D)"],
  },
  "Show every household affected by the HOTMA medical deduction change.": {
    role: "agent",
    text: "Across the portfolio, 41 households have a medical or disability deduction computed at the 3% threshold with an effective date on or after 2026-01-01.\n\n· Harper Mill Lofts — 14 households (mean TTP increase $58/mo)\n· Gulf View Commons — 9 households (mean $71/mo)\n· Brazos Landing — 8 households (mean $44/mo)\n· Magnolia Court — 6 households (mean $39/mo)\n· Cedar Crossing — 4 households (mean $31/mo)\n\n12 of the 41 cross the HOTMA-311 hardship trigger and should be evaluated for phase-in relief before any rent change notice is issued.",
    cites: ["24 CFR 5.611(a)(3)", "24 CFR 5.611(c)"],
  },
  "Has this household failed a review before?": {
    role: "agent",
    text: "The Whitfield household has been certified three times since move-in on 2023-08-01.\n\n· 2024-08-01 annual recert — passed, no findings.\n· 2025-11-14 interim (household size 2 → 3) — passed, one informational note on the asset certification date.\n· 2026-08-01 annual recert — three open HOTMA findings.\n\nThis is the household's first substantive failure, and all three findings trace to rule versions that took effect after the prior certification. That pattern is characteristic of a rules change, not a site-level process breakdown.",
    cites: ["HOTMA-104 v2.0", "HOTMA-208 v2.1"],
  },
  "Recommend remediation for F-9014.": {
    role: "agent",
    text: "F-9014 (HOTMA-208 v2.1, medical deduction threshold):\n\n1. Recalculate unreimbursed medical expenses using the 10% of annual income threshold — $4,120 in expenses against $38,440 income yields $276 deductible, not $2,967.\n2. Recompute adjusted income and TTP; the increase is $67/month.\n3. Before issuing the rent change, run the HOTMA-311 hardship test. This household clears the trigger, so a 24-month phase-in applies.\n4. Attach the recalculation worksheet and the hardship determination to the file, then re-queue for review.\n\nEstimated remediation effort: 15 minutes. Do not correct the TIC before the hardship determination — the notice date drives the phase-in clock.",
    cites: ["24 CFR 5.611(a)(3)", "24 CFR 5.611(c)"],
  },
};

const FALLBACK: Msg = {
  role: "agent",
  text: "I answer from the deterministic engine's output — findings, rule versions, extracted fields and household history. In this walkthrough build the corpus is limited to the demo portfolio, so try one of the suggested questions to see the grounded answer format with citations.",
};

function CopilotPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "agent",
      text: "I'm grounded in CertivoIQ's rules engine — I never decide pass or fail, I explain the determination the engine already made and cite the regulation behind it. Ask me about a file, a rule, or a portfolio-wide impact.",
    },
  ]);
  const [input, setInput] = useState("");

  function ask(q: string) {
    if (!q.trim()) return;
    setMessages((m) => [...m, { role: "user", text: q }, CANNED[q] ?? FALLBACK]);
    setInput("");
  }

  return (
    <AppShell title="AI compliance copilot" subtitle="Deterministic facts in, plain-language explanation out — every answer cited">
      <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
        <Panel bodyClassName="p-0">
          <div className="space-y-5 p-5">
            {messages.map((m, i) => (
              <div key={i} className="flex gap-3">
                <span
                  className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-md ${
                    m.role === "agent" ? "bg-ink text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {m.role === "agent" ? <Sparkles className="size-3.5" /> : <User className="size-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="cite text-[10.5px] uppercase tracking-[0.14em]">
                    {m.role === "agent" ? "CertivoIQ copilot" : "You"}
                  </p>
                  <p className="mt-1 text-[13.5px] leading-relaxed whitespace-pre-line">{m.text}</p>
                  {m.cites && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {m.cites.map((c) => (
                        <Pill key={c}>
                          <span className="font-mono">{c}</span>
                        </Pill>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex gap-2 border-t border-border p-4"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a finding, rule, or household…"
              className="text-[13.5px]"
            />
            <Button type="submit" size="sm">
              Ask
            </Button>
          </form>
        </Panel>

        <div className="space-y-4">
          <Panel title="Try asking">
            <ul className="space-y-2">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    onClick={() => ask(s)}
                    className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-left text-[12.5px] transition-colors hover:bg-muted"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Guardrails">
            <ul className="space-y-2.5 text-[12.5px] text-muted-foreground">
              <li>The copilot never issues a PASS/FAIL determination.</li>
              <li>Every claim resolves to a rule version, a citation, or an extracted field with a source page.</li>
              <li>Answers are logged to the audit trail alongside the file they reference.</li>
            </ul>
            <Cite>Grounded on rule build 2026.08 · 50-state coverage</Cite>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
