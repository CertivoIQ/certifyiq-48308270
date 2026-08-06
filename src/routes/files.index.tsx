import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, StatusPill, Cite, Stat } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { FILES, PROPERTIES, money, type Status } from "@/lib/demo-data";

export const Route = createFileRoute("/files/")({
  head: () => ({
    meta: [
      { title: "Certification Review Queue — CertifyIQ" },
      {
        name: "description",
        content:
          "AI-assisted review queue for Tenant Income Certifications: extraction confidence, deterministic findings, and soft approval by program.",
      },
      { property: "og:title", content: "Certification Review Queue — CertifyIQ" },
      {
        property: "og:description",
        content: "Every TIC scored, every finding cited to a versioned rule, ready for reviewer soft approval.",
      },
    ],
  }),
  component: FilesPage,
});

const FILTERS: { id: Status | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "In review" },
  { id: "remediation", label: "Needs remediation" },
  { id: "rejected", label: "Failed" },
  { id: "approved", label: "Approved" },
];

function FilesPage() {
  const [filter, setFilter] = useState<Status | "all">("all");
  const visible = filter === "all" ? FILES : FILES.filter((f) => f.status === filter);

  return (
    <AppShell
      title="Certification review queue"
      subtitle="Deterministic rule evaluation with AI extraction — reviewer soft-approves by program"
      actions={
        <Button size="sm" variant="outline">
          Import documents
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Files reviewed YTD" value="4,128" hint="Across 14 states" />
        <Stat label="Awaiting soft approval" value="38" tone="flag" />
        <Stat label="Mean extraction confidence" value="97.1%" tone="seal" />
        <Stat label="Mean review time" value="4.2 min" hint="Down from 41 min manual" tone="seal" />
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${
              filter === f.id ? "border-ink bg-ink text-primary-foreground" : "border-border bg-card hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Panel className="mt-4" bodyClassName="p-0">
        <ul className="divide-y divide-border">
          {visible.map((f) => {
            const property = PROPERTIES.find((p) => p.id === f.propertyId);
            return (
              <li key={f.id}>
                <Link
                  to="/files/$fileId"
                  params={{ fileId: f.id }}
                  className="grid gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-muted/50 sm:grid-cols-[150px_1fr_auto]"
                >
                  <div>
                    <Cite>{f.id}</Cite>
                    <p className="mt-1 text-[12px] text-muted-foreground">{f.certType}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-display text-[15.5px] leading-tight">{f.household}</p>
                    <Cite>
                      {f.unit} · {property?.state} · HH {f.hhSize} · {f.amiTier} · {money(f.annualIncome)}
                    </Cite>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {f.programs.map((p) => (
                        <Pill key={p}>{p}</Pill>
                      ))}
                      {f.findings.length > 0 && (
                        <Pill tone={f.status === "rejected" ? "reject" : "flag"}>{f.findings.length} findings</Pill>
                      )}
                      {f.findings.length === 0 && <Pill tone="seal">All rules passed</Pill>}
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <StatusPill status={f.status} />
                    <span className="cite">eff. {f.effective}</span>
                    <span className="cite">AI {f.aiScore}%</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </Panel>
    </AppShell>
  );
}
