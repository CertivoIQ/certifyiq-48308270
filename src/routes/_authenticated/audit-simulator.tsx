import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClipboardCheck, ShieldAlert } from 'lucide-react';
import { summarizeAudit } from '@/lib/compliance-intelligence.mjs';

export const Route = createFileRoute('/_authenticated/audit-simulator')({ component: AuditSimulatorPage });

const sampleFindings = [
  { severity: 'critical', title: 'Required income evidence missing' },
  { severity: 'major', title: 'Recertification timing requires review' },
  { severity: 'major', title: 'Supporting document mismatch' },
  { severity: 'minor', title: 'File naming standard not met' },
] as const;

function AuditSimulatorPage() {
  const [framework, setFramework] = useState<'federal' | 'state'>('federal');
  const [jurisdiction, setJurisdiction] = useState('Federal baseline');
  const result = useMemo(() => summarizeAudit(sampleFindings, 0.92), []);
  return <main className="mx-auto max-w-6xl space-y-6 p-6 md:p-10">
    <header className="rounded-2xl border bg-card p-6"><div className="flex items-center gap-2 text-sm font-medium text-primary"><ClipboardCheck className="h-4 w-4" /> Audit Simulator™</div><h1 className="mt-2 text-3xl font-semibold">Practice before the auditor arrives.</h1><p className="mt-2 text-muted-foreground">Run a controlled, evidence-backed simulation against a federal baseline or a selected state framework. Results remain subject to authorized compliance review.</p></header>
    <section className="grid gap-4 md:grid-cols-2"><label className="rounded-xl border bg-card p-4"><span className="text-sm font-medium">Framework</span><select className="mt-2 w-full rounded-md border bg-background p-2" value={framework} onChange={(e) => { const value = e.target.value as 'federal' | 'state'; setFramework(value); setJurisdiction(value === 'federal' ? 'Federal baseline' : 'Tennessee'); }}><option value="federal">Federal</option><option value="state">State</option></select></label><label className="rounded-xl border bg-card p-4"><span className="text-sm font-medium">Jurisdiction</span><select className="mt-2 w-full rounded-md border bg-background p-2" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}><option>Federal baseline</option><option>Tennessee</option><option>Mississippi</option><option>Arkansas</option></select></label></section>
    <section className="grid gap-4 md:grid-cols-4">{[['Readiness', `${result.readinessScore}%`], ['Critical', result.critical], ['Major', result.major], ['Minor', result.minor]].map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-card p-5"><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>)}</section>
    <section className="rounded-2xl border bg-card p-6"><div className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-5 w-5 text-primary" /> Simulated findings • {framework} / {jurisdiction}</div><div className="mt-4 space-y-3">{sampleFindings.map((finding) => <div key={finding.title} className="flex items-center justify-between rounded-lg border p-3"><span>{finding.title}</span><span className="rounded-full bg-muted px-2 py-1 text-xs font-medium uppercase">{finding.severity}</span></div>)}</div></section>
  </main>;
}
