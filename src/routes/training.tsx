import { isInternalSegmentUser } from "@/lib/internal-segment-access";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, ExternalLink, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsStaff, useSession } from "@/hooks/use-session";
import { filterTrainingLessons, parseTrainingProgress } from "@/lib/training/catalog";

export const Route = createFileRoute("/training")({
  head: () => ({ meta: [{ title: "Training — CertivoIQ" }, { name: "description", content: "Step-by-step CertivoIQ training for every page, tab, and workspace." }] }),
  component: TrainingPage,
});

function TrainingPage() {
  const { isStaff } = useIsStaff();
  const { user, ready } = useSession();
  // Remount learning state on account changes; no progress can carry into another account.
  return <AppShell title="Training" subtitle="Learn CertivoIQ, one workflow at a time">
    <TrainingCenter key={ready ? user?.id ?? "visitor" : "loading"} accountId={user?.id ?? null} isStaff={isStaff} isInternal={isInternalSegmentUser(user)} />
  </AppShell>;
}

function TrainingCenter({ accountId, isStaff, isInternal }: { accountId: string | null; isStaff: boolean; isInternal: boolean }) {
  const [query, setQuery] = useState("");
  const [audience, setAudience] = useState("all");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState("training");
  const [completed, setCompleted] = useState<string[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const storageKey = accountId ? `certivoiq:training:v1:${accountId}` : null;
  const available = useMemo(() => filterTrainingLessons(isStaff, "", "all", "all", isInternal), [isStaff, isInternal]);
  const lessons = useMemo(() => filterTrainingLessons(isStaff, query, audience, category, isInternal), [isStaff, query, audience, category, isInternal]);
  const lesson = lessons.find((item) => item.id === selected) ?? lessons[0];
  const categories = [...new Set(available.map((item) => item.category))];
  const completeCount = available.filter((item) => completed.includes(item.id)).length;

  useEffect(() => {
    if (storageKey) {
      try { setCompleted(parseTrainingProgress(window.localStorage.getItem(storageKey))); }
      catch { setStorageError(true); }
    }
    setStorageReady(true);
  }, [storageKey]);

  function toggleComplete(id: string) {
    const next = completed.includes(id) ? completed.filter((value) => value !== id) : [...completed, id];
    setCompleted(next);
    if (storageKey) {
      try { window.localStorage.setItem(storageKey, JSON.stringify(next)); setStorageError(false); }
      catch { setStorageError(true); }
    }
  }

  const selectClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
  return <div className="space-y-5">
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6" aria-label="Learning overview">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl"><BookOpen className="mb-3 size-6 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-semibold">Your guide to staying audit ready</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Start with setup, then follow the pages and tabs used in your daily work. Open any lesson below. Page access still depends on your role, program, and subscription.</p>
        </div>
        <div className="min-w-48" aria-live="polite">
          <p className="text-sm font-medium">{completeCount} of {available.length} lessons complete</p>
          <progress className="mt-2 h-2 w-full accent-primary" aria-label="Training completion" value={completeCount} max={available.length} />
          <p className="mt-2 max-w-64 text-xs text-muted-foreground">{storageError ? "Device storage is unavailable. Progress is kept for this visit only." : accountId ? "Progress saved on this device for your account." : "Sign in to save progress on this device. Visitors can read every customer guide."}</p>
        </div>
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr]" aria-label="Find training">
      <label className="text-sm font-medium">Search pages, tabs, or tasks
        <div className="relative mt-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try Jobs & Pay, notices, or CSV" /></div>
      </label>
      <label className="text-sm font-medium">Workspace
        <select className={selectClass} value={audience} onChange={(event) => { setAudience(event.target.value); setCategory("all"); }}>
          <option value="all">All available guides</option><option value="multifamily">Multifamily</option>{isInternal ? <option value="pha">PHA</option> : null}{isStaff ? <option value="staff">Staff administration</option> : null}
        </select>
      </label>
      <label className="text-sm font-medium">Topic
        <select className={selectClass} value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All topics</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</select>
      </label>
    </section>

    <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <nav className="rounded-xl border border-border bg-card" aria-label="Training lessons">
        <p className="border-b border-border px-4 py-3 text-sm font-medium" aria-live="polite">{lessons.length} matching lessons</p>
        <div className="max-h-[45vh] overflow-y-auto p-2 lg:max-h-[70vh]">
          {lessons.map((item) => <button type="button" key={item.id} aria-current={lesson?.id === item.id ? "true" : undefined} onClick={() => setSelected(item.id)} className={`mb-1 flex w-full items-start gap-2 rounded-lg px-3 py-3 text-left text-sm transition-colors ${lesson?.id === item.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            {completed.includes(item.id) ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-label="Completed" /> : <BookOpen className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
            <span><span className="block font-medium">{item.title}</span><span className="mt-1 block text-xs opacity-75">{item.category}</span></span>
          </button>)}
        </div>
      </nav>

      {lesson ? <article key={lesson.id} className="min-w-0 rounded-xl border border-border bg-card p-5 sm:p-7" aria-label="Selected walkthrough">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{lesson.category} · {lesson.steps.length} steps</p>
        <h2 className="mt-2 text-2xl font-semibold">{lesson.title}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{lesson.summary}</p>
        {lesson.status !== "guide" ? <p className="mt-4 rounded-lg border border-border bg-muted p-3 text-sm"><strong>{lesson.status === "demonstration" ? "Demonstration page. " : "Setup only. "}</strong>{lesson.status === "demonstration" ? "This walkthrough describes sample data. Use the live workflow named in the steps for customer records." : "This page does not establish an active external integration."}</p> : null}
        {lesson.audience === "staff" ? <p className="mt-4 text-sm text-muted-foreground">Staff guide. The destination enforces its own administrator or staff permissions.</p> : null}
        <Button asChild variant="outline" className="mt-4"><a href={lesson.href} target="_blank" rel="noopener noreferrer">{lesson.coveredRoutes.some((route) => route.includes("$")) ? "Open starting page" : "Open page"}<ExternalLink className="size-4" /><span className="sr-only"> (new tab)</span></a></Button>
        <ol className="mt-7 space-y-6">
          {lesson.steps.map((step, index) => <li key={step.title} className="flex gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold" aria-hidden="true">{index + 1}</span><div className="min-w-0 pt-1"><h3 className="font-semibold">{step.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{step.instruction}</p></div></li>)}
        </ol>
        <div className="mt-7 border-t border-border pt-5">
          <Button disabled={!storageReady} aria-pressed={completed.includes(lesson.id)} onClick={() => toggleComplete(lesson.id)}><CheckCircle2 className="size-4" />{completed.includes(lesson.id) ? "Completed — mark incomplete" : "Mark lesson complete"}</Button>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Learning completion does not change customer records, clear validation gates, or approve a certification.</p>
        </div>
      </article> : <section className="rounded-xl border border-border bg-card p-7"><h2 className="text-lg font-semibold">No matching lessons</h2><p className="mt-2 text-sm text-muted-foreground">Try another page name or clear your filters.</p><Button variant="outline" className="mt-4" onClick={() => { setQuery(""); setCategory("all"); setAudience("all"); }}>Clear filters</Button></section>}
    </div>
    <p className="text-sm text-muted-foreground">Need help with an issue? <a className="font-medium text-primary underline underline-offset-4" href="/contact-support">Contact Tech Support</a>. Include the page and steps, without sensitive tenant information or authentication secrets.</p>
  </div>;
}
