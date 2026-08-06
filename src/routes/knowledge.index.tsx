import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Meter, Cite, Stat } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { COURSES } from "@/lib/demo-data";
import { Award, Clock, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/knowledge/")({
  head: () => ({
    meta: [
      { title: "KnowledgeIQ — Affordable Housing Compliance Training" },
      {
        name: "description",
        content:
          "Train new compliance reviewers to audit certifications: LIHTC, HOTMA, Section 8 and HOME course modules with assessments and certificates of achievement.",
      },
      { property: "og:title", content: "KnowledgeIQ — Compliance Training Academy" },
      {
        property: "og:description",
        content: "Structured modules on auditing a certification, with a graded assessment and a printable certificate.",
      },
    ],
  }),
  component: KnowledgePage,
});

function KnowledgePage() {
  return (
    <AppShell
      title="KnowledgeIQ"
      subtitle="The compliance academy — how to audit a certification, program by program"
      actions={
        <Button variant="outline" size="sm">
          My transcript
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Courses" value={COURSES.length} hint="LIHTC · HOTMA · Section 8 · HOME" />
        <Stat label="Modules" value={COURSES.reduce((n, c) => n + c.modules.length, 0)} />
        <Stat label="Certificates earned" value={COURSES.filter((c) => c.progress === 100).length} tone="seal" />
        <Stat label="Learning hours" value={COURSES.reduce((n, c) => n + c.hours, 0)} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {COURSES.map((c) => (
          <Panel key={c.id} bodyClassName="p-0">
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill>{c.program}</Pill>
                <Pill>{c.level}</Pill>
                {c.progress === 100 && (
                  <Pill tone="seal">
                    <Award className="size-3" /> Certified
                  </Pill>
                )}
              </div>
              <h2 className="mt-2.5 font-display text-[18px] leading-tight">{c.title}</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{c.summary}</p>

              <div className="mt-4">
                <div className="mb-1.5 flex items-baseline justify-between">
                  <Cite>
                    {c.modules.length} modules · {c.hours} hours
                  </Cite>
                  <span className="font-mono text-[12px]">{c.progress}%</span>
                </div>
                <Meter value={c.progress} tone={c.progress === 100 ? "seal" : "flag"} />
              </div>

              <ul className="mt-4 space-y-1.5 border-t border-border pt-3">
                {c.modules.slice(0, 3).map((m) => (
                  <li key={m.title} className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                    <Clock className="size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{m.title}</span>
                    <span className="font-mono">{m.minutes}m</span>
                  </li>
                ))}
                {c.modules.length > 3 && <li className="cite">+{c.modules.length - 3} more modules</li>}
              </ul>

              <Button className="mt-4 w-full" size="sm" asChild>
                <Link to="/knowledge/$courseId" params={{ courseId: c.id }}>
                  <PlayCircle className="size-4" />
                  {c.progress === 100 ? "Review course" : c.progress > 0 ? "Continue" : "Start course"}
                </Link>
              </Button>
            </div>
          </Panel>
        ))}
      </div>
    </AppShell>
  );
}
