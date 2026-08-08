import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Building2, CheckCircle2, ClipboardCheck, FileSearch, Scale, ShieldCheck } from "lucide-react";
import type { CorrectionCase, HfaAgency, HfaMetric, HfaSubmission, RulePackRelease } from "./hfaRegulatoryTypes";

type Tab = "overview" | "submissions" | "rules" | "sampling" | "corrections";

type Props = {
  agency: HfaAgency;
  metrics: HfaMetric[];
  submissions: HfaSubmission[];
  releases: RulePackRelease[];
  corrections: CorrectionCase[];
  canManageRules: boolean;
  canRunSampling: boolean;
};

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "submissions", label: "Submissions" },
  { id: "rules", label: "Rule packs" },
  { id: "sampling", label: "Sampling" },
  { id: "corrections", label: "Corrective actions" },
];

const badge = "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset";

export default function HfaRegulatoryConsole({ agency, metrics, submissions, releases, corrections, canManageRules, canRunSampling }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const openCorrections = useMemo(() => corrections.filter((item) => !["accepted"].includes(item.status)).length, [corrections]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-7 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="flex items-center gap-2 text-cyan-700"><ShieldCheck className="h-5 w-5" /><span className="text-sm font-semibold uppercase tracking-[.16em]">HFA Regulatory Console</span></div><h1 className="mt-2 text-3xl font-semibold tracking-tight">{agency.name}</h1><p className="mt-2 text-sm text-slate-600">{agency.stateCode} · {agency.authorityScope.join(" · ")}</p></div>
          <div className="rounded-xl bg-slate-950 px-4 py-3 text-sm text-white"><span className="font-semibold">Agency workspace</span><span className="ml-2 text-slate-300">Only explicitly submitted records are visible.</span></div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 sm:px-8" aria-label="Regulatory console sections">{tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap ${tab === item.id ? "border-cyan-600 text-cyan-800" : "border-transparent text-slate-500 hover:text-slate-900"}`}>{item.label}</button>)}</nav>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        {tab === "overview" && <section aria-labelledby="overview-title"><h2 id="overview-title" className="sr-only">Overview</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">{metric.label}</p><p className="mt-2 text-3xl font-semibold">{metric.value}</p><p className="mt-2 text-sm text-slate-600">{metric.detail}</p></article>)}</div><div className="mt-7 grid gap-6 lg:grid-cols-2"><Panel title="Submission readiness" icon={<ClipboardCheck className="h-5 w-5" />}><SubmissionList items={submissions.slice(0, 5)} /></Panel><Panel title="Attention required" icon={<AlertTriangle className="h-5 w-5" />}><p className="text-4xl font-semibold">{openCorrections}</p><p className="mt-2 text-sm text-slate-600">Open or reopened corrective-action cases</p><button onClick={() => setTab("corrections")} className="mt-5 text-sm font-semibold text-cyan-700">Review corrective actions →</button></Panel></div></section>}

        {tab === "submissions" && <section><SectionTitle icon={<FileSearch className="h-6 w-6" />} title="Owner submissions" description="Preflight results, evidence manifests and monitoring packages explicitly submitted to this agency." /><div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4"><SubmissionList items={submissions} /></div></section>}

        {tab === "rules" && <section><SectionTitle icon={<Scale className="h-6 w-6" />} title="Rule-pack governance" description="Source, validate, test, approve, activate and suspend effective-dated state rules." />{canManageRules && <button className="mt-5 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Propose rule release</button>}<div className="mt-6 grid gap-4">{releases.map((release) => <article key={release.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{release.stateCode} · {release.program} · {release.version}</p><p className="mt-1 text-sm text-slate-600">Effective {release.effectiveFrom} · {release.sourceCount} controlling sources · {release.testCount} tests</p></div><span className={`${badge} bg-cyan-50 text-cyan-800 ring-cyan-200`}>{release.status.replaceAll("_", " ")}</span></div></article>)}</div></section>}

        {tab === "sampling" && <section><SectionTitle icon={<Building2 className="h-6 w-6" />} title="Risk-based monitoring sample" description="Create transparent random or risk-weighted samples without using protected characteristics." />{canRunSampling ? <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6"><h3 className="font-semibold">New sampling run</h3><p className="mt-2 text-sm text-slate-600">Lovable should connect this control to a server-side, seeded and reproducible sampling job with an exported selection rationale.</p><button className="mt-5 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Configure sample</button></div> : <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Your role cannot create monitoring samples.</p>}</section>}

        {tab === "corrections" && <section><SectionTitle icon={<CheckCircle2 className="h-6 w-6" />} title="Corrective Action Exchange" description="Track findings, owner responses, correction evidence, re-review and agency disposition." /><div className="mt-6 grid gap-4">{corrections.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{item.title}</p><p className="mt-1 text-sm text-slate-600">{item.organizationName} · {item.propertyName} · due {item.dueAt} · {item.evidenceCount} evidence item(s)</p></div><span className={`${badge} bg-amber-50 text-amber-900 ring-amber-200`}>{item.status.replaceAll("_", " ")}</span></div></article>)}</div></section>}
      </div>
    </main>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2 font-semibold">{icon}{title}</div>{children}</section>; }
function SectionTitle({ icon, title, description }: { icon: ReactNode; title: string; description: string }) { return <div className="max-w-3xl"><div className="flex items-center gap-3">{icon}<h2 className="text-2xl font-semibold">{title}</h2></div><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></div>; }
function SubmissionList({ items }: { items: HfaSubmission[] }) { return <div className="divide-y divide-slate-200">{items.map((item) => <article key={item.id} className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-semibold">{item.propertyName}</p><p className="mt-1 text-sm text-slate-600">{item.organizationName} · {item.program} · {item.reportingPeriod} · {item.unresolvedFindings} unresolved</p></div><div className="flex items-center gap-3"><span className="text-sm font-semibold">{item.readinessScore}% ready</span><span className={`${badge} bg-slate-50 text-slate-700 ring-slate-200`}>{item.status.replaceAll("_", " ")}</span></div></article>)}</div>; }
