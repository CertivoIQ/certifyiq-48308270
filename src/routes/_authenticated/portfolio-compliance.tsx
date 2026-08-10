import { useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Building2, CircleAlert, ShieldCheck } from 'lucide-react';
import { aggregatePortfolioReadiness } from '@/lib/compliance-intelligence.mjs';

export const Route = createFileRoute('/_authenticated/portfolio-compliance')({ component: PortfolioCompliancePage });

const properties = [
  { name: 'Oak Ridge Apartments', readinessScore: 96, critical: 0, findings: 2 },
  { name: 'Maple Gardens', readinessScore: 91, critical: 0, findings: 4 },
  { name: 'Riverbend Homes', readinessScore: 83, critical: 1, findings: 9 },
  { name: 'Pine Valley', readinessScore: 64, critical: 3, findings: 17 },
];

function PortfolioCompliancePage() {
  const summary = useMemo(() => aggregatePortfolioReadiness(properties), []);
  return <main className="mx-auto max-w-7xl space-y-6 p-6 md:p-10">
    <header className="rounded-2xl border bg-card p-6"><div className="flex items-center gap-2 text-sm font-medium text-primary"><Building2 className="h-4 w-4" /> Portfolio Compliance Command Center™</div><h1 className="mt-2 text-3xl font-semibold">Portfolio Audit Readiness</h1><p className="mt-2 text-muted-foreground">See which properties are ready, which are at risk, and where corrective action should start.</p></header>
    <section className="grid gap-4 md:grid-cols-4">{[['Overall readiness', `${summary.readinessScore}%`], ['Properties', summary.propertyCount], ['Audit ready', summary.auditReadyCount], ['At risk', summary.atRiskCount]].map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-card p-5"><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>)}</section>
    <section className="rounded-2xl border bg-card p-6"><div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5 text-primary" /> Property readiness</div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-3">Property</th><th className="p-3">Readiness</th><th className="p-3">Critical</th><th className="p-3">Open findings</th></tr></thead><tbody>{properties.map((property) => <tr key={property.name} className="border-b last:border-0"><td className="p-3 font-medium">{property.name}</td><td className="p-3">{property.readinessScore}%</td><td className="p-3">{property.critical ? <span className="inline-flex items-center gap-1 text-destructive"><CircleAlert className="h-4 w-4" /> {property.critical}</span> : '0'}</td><td className="p-3">{property.findings}</td></tr>)}</tbody></table></div></section>
  </main>;
}
