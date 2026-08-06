import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Meter, Cite } from "@/components/ui-kit";
import { PROPERTIES, riskBand } from "@/lib/demo-data";

export const Route = createFileRoute("/properties")({
  head: () => ({
    meta: [
      { title: "Properties & Risk Scores — CertifyIQ" },
      {
        name: "description",
        content:
          "Property-level compliance risk scoring across LIHTC, HOTMA, HOME and Section 8, with overdue recertifications and audit dates.",
      },
      { property: "og:title", content: "Properties & Risk Scores — CertifyIQ" },
      {
        property: "og:description",
        content: "Every property scored for agency-finding probability, with the specific reasons behind each score.",
      },
    ],
  }),
  component: PropertiesPage,
});

function PropertiesPage() {
  return (
    <AppShell
      title="Properties"
      subtitle="Risk-scored portfolio with layered program designations"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[...PROPERTIES]
          .sort((a, b) => b.risk - a.risk)
          .map((p) => {
            const band = riskBand(p.risk);
            return (
              <Panel key={p.id} bodyClassName="p-0">
                <Link to="/properties/$propertyId" params={{ propertyId: p.id }} className="block p-5 transition-colors hover:bg-muted/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-[17px] leading-tight">{p.name}</h2>
                      <Cite>
                        {p.city}, {p.state} · {p.county} County · {p.units} units
                      </Cite>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[24px] leading-none tabular-nums">{p.risk}</div>
                      <Cite>risk</Cite>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Pill tone={band.tone}>{band.label}</Pill>
                    {p.programs.map((prog) => (
                      <Pill key={prog}>{prog}</Pill>
                    ))}
                  </div>

                  <ul className="mt-4 space-y-1.5 border-t border-border pt-3">
                    {p.riskReasons.map((r) => (
                      <li key={r} className="flex gap-2 text-[12.5px] text-muted-foreground">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-flag" />
                        {r}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3">
                    <div>
                      <Cite>HOTMA readiness</Cite>
                      <div className="mt-1.5">
                        <Meter value={p.hotmaReadiness} tone={p.hotmaReadiness >= 80 ? "seal" : "flag"} />
                      </div>
                    </div>
                    <div>
                      <Cite>NSPIRE readiness</Cite>
                      <div className="mt-1.5">
                        <Meter value={p.nspireReadiness} tone={p.nspireReadiness >= 80 ? "seal" : "flag"} />
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 font-mono text-[11.5px] text-muted-foreground">Next audit {p.nextAudit}</p>
                </Link>
              </Panel>
            );
          })}
      </div>
    </AppShell>
  );
}
