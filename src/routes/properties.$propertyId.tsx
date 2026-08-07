import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Meter, Cite, StatusPill, Stat } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { PROPERTIES, FILES, riskBand } from "@/lib/demo-data";
import type { Property, CertFile } from "@/lib/demo-data";

export const Route = createFileRoute("/properties/$propertyId")({
  loader: ({ params }) => {
    const property = PROPERTIES.find((p) => p.id === params.propertyId);
    if (!property) throw notFound();
    return { property, files: FILES.filter((f) => f.propertyId === property.id) };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Property unavailable — CertivoIQ" }, { name: "robots", content: "noindex" }] };
    }
    const { property } = loaderData;
    const desc = `${property.name} in ${property.city}, ${property.state} — risk score ${property.risk}, ${property.openFindings} open findings across ${property.programs.join(", ")}.`;
    return {
      meta: [
        { title: `${property.name} — Compliance Risk — CertivoIQ` },
        { name: "description", content: desc },
        { property: "og:title", content: `${property.name} — CertivoIQ` },
        { property: "og:description", content: desc },
        { property: "og:url", content: `https://certivoiq.com/properties/${params.propertyId}` },
      ],
      links: [{ rel: "canonical", href: `https://certivoiq.com/properties/${params.propertyId}` }],
    };
  },
  notFoundComponent: () => (
    <AppShell title="Property not found" subtitle="This property is not in the demo portfolio">
      <Button asChild>
        <Link to="/properties">Back to properties</Link>
      </Button>
    </AppShell>
  ),
  component: PropertyDetail,
});

function PropertyDetail() {
  const { property, files } = Route.useLoaderData() as { property: Property; files: CertFile[] };
  const band = riskBand(property.risk);

  return (
    <AppShell
      title={property.name}
      subtitle={`${property.city}, ${property.state} · ${property.county} County · ${property.units} units`}
      actions={
        <>
          <Button variant="outline" size="sm">
            Generate agency report
          </Button>
          <Button size="sm" asChild>
            <Link to="/files">Open review queue</Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Risk score" value={property.risk} hint={band.label} tone={band.tone} />
        <Stat label="Open findings" value={property.openFindings} tone="flag" />
        <Stat label="Overdue recerts" value={property.overdueRecerts} tone={property.overdueRecerts > 0 ? "reject" : "seal"} />
        <Stat label="Next audit" value={<span className="font-mono text-[19px]">{property.nextAudit}</span>} hint="THDA / state agency monitoring" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Why this score" description="Deterministic risk factors, weighted by historical agency findings">
          <ul className="space-y-3">
            {property.riskReasons.map((r) => (
              <li key={r} className="flex items-start gap-3 border-b border-border pb-3 text-[13.5px] last:border-0 last:pb-0">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-flag" />
                {r}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Program designations">
          <div className="flex flex-wrap gap-1.5">
            {property.programs.map((p) => (
              <Pill key={p}>{p}</Pill>
            ))}
          </div>
          <div className="mt-5 space-y-4">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                <span>HOTMA readiness</span>
                <span className="font-mono">{property.hotmaReadiness}%</span>
              </div>
              <Meter value={property.hotmaReadiness} tone={property.hotmaReadiness >= 80 ? "seal" : "flag"} />
            </div>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                <span>NSPIRE readiness</span>
                <span className="font-mono">{property.nspireReadiness}%</span>
              </div>
              <Meter value={property.nspireReadiness} tone={property.nspireReadiness >= 80 ? "seal" : "flag"} />
            </div>
          </div>
          <p className="mt-5 border-t border-border pt-3 text-[12.5px] text-muted-foreground">
            Rule stack: core → <span className="cite">{property.state}</span> state pack → {property.county} County limits → property overrides.
          </p>
        </Panel>
      </div>

      <Panel className="mt-4" title="Certifications at this property" bodyClassName="p-0">
        {files.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">
            No certification files loaded in the demo dataset for this property.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {files.map((f) => (
              <li key={f.id}>
                <Link to="/files/$fileId" params={{ fileId: f.id }} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 hover:bg-muted/50">
                  <span className="cite w-[128px]">{f.id}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px]">{f.household}</span>
                    <Cite>
                      {f.unit} · {f.certType} · eff. {f.effective}
                    </Cite>
                  </span>
                  <StatusPill status={f.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
}
