import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, FileSearch, ShieldCheck, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, Pill } from "@/components/ui-kit";
import { capturePhaCampaignLead, PHA_PERSONAS, type PhaPersona } from "@/lib/pha-campaign-lead.functions";

interface PersonaPage {
  eyebrow: string;
  headline: string;
  subhead: string;
  cta: string;
  risks: string[];
  outcomes: { title: string; detail: string }[];
  demo: string[];
  commercialHook: string;
}

const pages: Record<PhaPersona, PersonaPage> = {
  executive: {
    eyebrow: "Executive Director / CEO",
    headline: "See Compliance Risk Before the Audit",
    subhead:
      "Gain an agency-level view of certification risk, unresolved evidence, and recurring exceptions before they become leadership surprises.",
    cta: "Book an Executive Briefing",
    commercialHook: "Your software processed the certification. Can you see the risk across the agency?",
    risks: ["Audit findings reaching leadership too late", "Inconsistent review quality across programs and teams", "Limited visibility into unresolved certification exceptions"],
    outcomes: [
      { title: "See exposure earlier", detail: "Surface patterns and unresolved risks while the agency still has time to act." },
      { title: "Lead with evidence", detail: "Connect every finding to the document, rule version, and resolution trail." },
      { title: "Standardize oversight", detail: "Create one defensible review standard across HCV and Public Housing workflows." },
    ],
    demo: ["Agency-level risk view", "Escalation and exception queue", "Traceable finding and resolution record"],
  },
  compliance: {
    eyebrow: "Compliance / QA Director",
    headline: "Give Your Review Team an Independent Review Layer",
    subhead:
      "Prioritize the certifications that need human attention and keep every finding connected to its evidence and governing rule.",
    cta: "Request a Compliance Demo",
    commercialHook: "Your team reviews the files. CertivoIQ helps them focus on the exceptions that matter.",
    risks: ["Manual sampling that misses isolated errors", "Evidence conflicts buried across documents", "Review standards varying by reviewer or office"],
    outcomes: [
      { title: "Prioritize exceptions", detail: "Move unresolved evidence and rule conflicts to the front of the queue." },
      { title: "Review consistently", detail: "Apply the same deterministic logic across every supported certification." },
      { title: "Defend the result", detail: "Preserve the source, rule, reviewer action, and final resolution." },
    ],
    demo: ["Certification finding workflow", "Conflicting-evidence handling", "Reviewer action and audit trail"],
  },
  hcv: {
    eyebrow: "HCV Director",
    headline: "Reduce HCV Certification Risk Before HUD Review",
    subhead:
      "Strengthen income, asset, household, reexamination, and documentation review without replacing your current HCV platform.",
    cta: "See the HCV Review Workflow",
    commercialHook: "HCV volume moves fast. Compliance risk should not move unseen.",
    risks: ["High certification volume and uneven review capacity", "Incorrect income, asset, or household inputs", "Missing documentation discovered during monitoring"],
    outcomes: [
      { title: "Find calculation risk", detail: "Surface inconsistent inputs and unresolved evidence before final review." },
      { title: "Strengthen HOTMA readiness", detail: "Keep rule versions, effective dates, and policy selections visible." },
      { title: "Escalate precisely", detail: "Send only unresolved or high-risk cases to senior staff." },
    ],
    demo: ["HCV certification walkthrough", "HOTMA rule and policy routing", "Targeted escalation workflow"],
  },
  "public-housing": {
    eyebrow: "Public Housing Director",
    headline: "Strengthen Public Housing Certification Quality",
    subhead:
      "Create a consistent review path for income, assets, household changes, tenant notices, and supporting evidence across your portfolio.",
    cta: "See Public Housing Review",
    commercialHook: "Strong communities start with certification decisions your team can explain.",
    risks: ["Inconsistent files across properties", "Household and income changes handled differently", "Missing evidence creating avoidable corrective work"],
    outcomes: [
      { title: "Apply one review standard", detail: "Use consistent evidence and exception handling across sites." },
      { title: "Catch missing support", detail: "Identify absent and conflicting documents before monitoring." },
      { title: "Make findings explainable", detail: "Show why a certification was flagged and what remains unresolved." },
    ],
    demo: ["Public Housing review path", "Household-change exceptions", "Portfolio consistency view"],
  },
  "finance-operations": {
    eyebrow: "CFO / COO",
    headline: "Protect Revenue. Reduce Audit Exposure.",
    subhead:
      "See the operational and financial consequences of certification risk before repayment, corrective action, or avoidable rework reaches your team.",
    cta: "Schedule a Leadership Demo",
    commercialHook: "A certification error is not only a compliance problem. It can become a financial one.",
    risks: ["Repayment and corrective-action exposure", "Staff time consumed by preventable rework", "No shared view of operational compliance risk"],
    outcomes: [
      { title: "Protect revenue", detail: "Identify risk before it becomes a repayment or corrective-action issue." },
      { title: "Reduce rework", detail: "Give teams clearer exceptions and evidence requirements earlier." },
      { title: "Measure operations", detail: "Track review volume, unresolved cases, and recurring risk patterns." },
    ],
    demo: ["Risk and workload summary", "Escalation aging and ownership", "Financially relevant exception examples"],
  },
  technology: {
    eyebrow: "CIO / IT Director",
    headline: "Add Independent Review Without Replacing Your System",
    subhead:
      "Layer traceable compliance review alongside Yardi Voyager PHA, Emphasys, MRI PHA Pro, and your existing technology environment.",
    cta: "See How It Fits Your Stack",
    commercialHook: "Keep your system of record. Add an independent compliance intelligence layer.",
    risks: ["Pressure to replace stable core systems", "Opaque review tools with weak traceability", "New integrations expanding security and support burden"],
    outcomes: [
      { title: "No rip-and-replace", detail: "Preserve the operating platform your agency already uses." },
      { title: "Traceable by design", detail: "Keep inputs, rule versions, findings, and actions visible." },
      { title: "Fail closed", detail: "Missing or conflicting evidence is escalated, never silently resolved." },
    ],
    demo: ["Architecture and data flow", "Security and access boundaries", "Integration and deployment model"],
  },
};

function isPersona(value: string): value is PhaPersona {
  return (PHA_PERSONAS as readonly string[]).includes(value);
}

export const Route = createFileRoute("/pha/$persona")({
  head: ({ params }) => {
    const page = isPersona(params.persona) ? pages[params.persona] : null;
    const title = page ? `${page.headline} | CertivoIQ` : "CertivoIQ for PHA Leadership";
    const description = page?.subhead ?? "Role-specific compliance intelligence for public housing agencies.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: `https://certivoiq.com/pha/${params.persona}` },
        { name: "robots", content: page ? "index,follow" : "noindex" },
      ],
      links: page ? [{ rel: "canonical", href: `https://certivoiq.com/pha/${params.persona}` }] : [],
    };
  },
  component: PhaPersonaPage,
});

function PhaPersonaPage() {
  const { persona } = Route.useParams();
  const page = isPersona(persona) ? pages[persona] : null;
  const captureLead = useServerFn(capturePhaCampaignLead);
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [form, setForm] = useState({
    agencyName: "",
    name: "",
    title: "",
    email: "",
    phone: "",
    currentPlatform: "",
    units: "",
    note: "",
    marketingConsent: false,
    website: "",
  });

  const utm = useMemo(() => {
    if (typeof window === "undefined") return {};
    const params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get("utm_source") || undefined,
      utmMedium: params.get("utm_medium") || undefined,
      utmCampaign: params.get("utm_campaign") || undefined,
    };
  }, []);

  if (!page || !isPersona(persona)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5 text-center">
        <div>
          <h1 className="font-display text-4xl">Choose a PHA leadership role</h1>
          <Button className="mt-6" asChild><Link to="/pha">View role options</Link></Button>
        </div>
      </main>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await captureLead({
        data: {
          agencyName: form.agencyName,
          name: form.name,
          title: form.title,
          email: form.email,
          phone: form.phone || undefined,
          currentPlatform: form.currentPlatform || undefined,
          persona,
          cta: page.cta,
          units: form.units ? Number(form.units) : undefined,
          note: form.note || undefined,
          marketingConsent: form.marketingConsent,
          website: form.website,
          ...utm,
        },
      });
      setComplete(true);
      toast.success("Your role-specific demonstration request is confirmed", { description: result.message });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your request could not be submitted.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-background/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link to="/welcome"><img src="/certivoiq-logo.png" alt="CertivoIQ" className="h-11 w-auto object-contain dark:hidden" /><img src="/certivoiq-logo-dark.png" alt="" aria-hidden="true" className="hidden h-11 w-auto object-contain dark:block" /></Link>
          <div className="flex items-center gap-3">
            <Button variant="outline" asChild><Link to="/pha">PHA roles</Link></Button>
            <Button asChild><a href="#request">{page.cta}</a></Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-28">
          <div>
            <Pill tone="neutral">{page.eyebrow}</Pill>
            <h1 className="mt-6 max-w-4xl font-display text-[48px] leading-[1.02] tracking-[-0.035em] sm:text-[68px]">{page.headline}</h1>
            <p className="mt-6 max-w-2xl text-[18px] leading-8 text-muted-foreground">{page.subhead}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild><a href="#request">{page.cta} <ArrowRight className="ml-2 size-4" /></a></Button>
              <Button size="lg" variant="outline" asChild><a href="#workflow">See your workflow</a></Button>
            </div>
            <p className="mt-7 text-sm font-semibold text-gold">Processed by your software. Independently reviewed by CertivoIQ.</p>
          </div>

          <Panel className="border-gold/25 shadow-xl" bodyClassName="p-7">
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-gold">The commercial question</p>
            <p className="mt-5 font-display text-3xl leading-tight">{page.commercialHook}</p>
            <div className="mt-7 space-y-3">
              {page.risks.map((risk) => (
                <div key={risk} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3 text-sm">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gold" /> {risk}
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="border-y border-border bg-muted/20">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-gold">What changes for {page.eyebrow}</p>
            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {page.outcomes.map((outcome) => (
                <Panel key={outcome.title} bodyClassName="p-6">
                  <Check className="size-5 text-gold" />
                  <h2 className="mt-5 font-display text-2xl">{outcome.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{outcome.detail}</p>
                </Panel>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <Pill tone="neutral">Your tailored demonstration</Pill>
              <h2 className="mt-5 font-display text-4xl leading-tight">See only the workflow relevant to your role.</h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                The demonstration is routed by role, agency context, current platform, and campaign source. You will not be sent through an unrelated generic product tour.
              </p>
            </div>
            <div className="grid gap-3">
              {page.demo.map((item, index) => (
                <div key={item} className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
                  {index === 0 ? <FileSearch className="size-5 text-gold" /> : index === 1 ? <Workflow className="size-5 text-gold" /> : <ShieldCheck className="size-5 text-gold" />}
                  <div><p className="font-mono text-[10px] text-muted-foreground">0{index + 1}</p><p className="mt-1 font-display text-xl">{item}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="request" className="bg-foreground text-background">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
            <div>
              <Pill tone="neutral">{page.cta}</Pill>
              <h2 className="mt-5 font-display text-4xl leading-tight">A demonstration built around your responsibilities.</h2>
              <p className="mt-4 text-sm leading-6 text-background/65">
                Tell us your role and current platform. CertivoIQ will preserve that context in the CRM and route the request to the correct experience.
              </p>
            </div>

            <div className="rounded-2xl border border-background/15 bg-background p-6 text-foreground">
              {complete ? (
                <div className="py-12 text-center">
                  <ShieldCheck className="mx-auto size-10 text-gold" />
                  <h3 className="mt-5 font-display text-3xl">Your request is confirmed.</h3>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">Your role, agency, platform, and campaign source were preserved for the tailored demonstration.</p>
                </div>
              ) : (
                <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><Label>Housing agency *</Label><Input required value={form.agencyName} onChange={(e) => setForm({ ...form, agencyName: e.target.value })} /></div>
                  <div><Label>Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div><Label>Title *</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                  <div><Label>Agency email *</Label><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div><Label>Current platform</Label><Input placeholder="Yardi, Emphasys, MRI…" value={form.currentPlatform} onChange={(e) => setForm({ ...form, currentPlatform: e.target.value })} /></div>
                  <div><Label>Units / vouchers</Label><Input type="number" min="0" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} /></div>
                  <div className="sm:col-span-2"><Label>What should the demonstration address?</Label><textarea className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
                  <div className="hidden" aria-hidden="true"><Label>Website</Label><Input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
                  <label className="sm:col-span-2 flex items-start gap-3 rounded-lg border border-border p-4 text-sm leading-5">
                    <input type="checkbox" className="mt-1 size-4" checked={form.marketingConsent} onChange={(e) => setForm({ ...form, marketingConsent: e.target.checked })} />
                    I agree to receive this demonstration and relevant CertivoIQ compliance communications. I can unsubscribe from marketing communications.
                  </label>
                  <div className="sm:col-span-2">
                    <Button type="submit" size="lg" disabled={pending}>{pending ? "Submitting…" : page.cta}</Button>
                    <p className="mt-3 text-xs text-muted-foreground">Agency email required. No Lovable-managed email is sent by this form.</p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
