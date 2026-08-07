import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Meter, Cite } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { COURSES, type Course } from "@/lib/demo-data";
import { Award, CheckCircle2, ChevronDown, XCircle } from "lucide-react";

export const Route = createFileRoute("/academy/$courseId")({
  loader: ({ params }) => {
    const course = COURSES.find((c) => c.id === params.courseId);
    if (!course) throw notFound();
    return { course };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Course unavailable — CertifyIQ Academy" }, { name: "robots", content: "noindex" }] };
    }
    const c = loaderData.course as Course;
    return {
      meta: [
        { title: `${c.title} — CertifyIQ Academy | CertifyIQ` },
        { name: "description", content: c.summary },
        { property: "og:title", content: `${c.title} — CertifyIQ Academy` },
        { property: "og:description", content: c.summary },
      ],
    };
  },
  notFoundComponent: () => (
    <AppShell title="Course not found" subtitle="This course is not in the catalog">
      <Button asChild>
        <Link to="/academy">Back to CertifyIQ Academy</Link>
      </Button>
    </AppShell>
  ),
  component: CoursePage,
});

function Certificate({ course, score }: { course: Course; score: number }) {
  return (
    <div className="ledger-lines rounded-lg border-2 border-ink bg-card p-7 text-center shadow-raised">
      <p className="cite text-[10.5px] uppercase tracking-[0.24em]">CertifyIQ · CertifyIQ Academy</p>
      <h2 className="mt-4 font-display text-[26px] leading-tight">Certificate of Achievement</h2>
      <p className="mt-4 text-[13px] text-muted-foreground">awarded to</p>
      <p className="mt-1 font-display text-[21px]">Jordan Alvarez, Compliance Reviewer</p>
      <p className="mt-4 text-[13px] text-muted-foreground">for successful completion of</p>
      <p className="mt-1 font-display text-[17px]">{course.title}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <span className="stamp px-4 py-1.5 text-[12px] text-seal">Passed</span>
        <span className="font-mono text-[12.5px] text-muted-foreground">
          Score {score}% · {course.hours} CE hours · Aug 6, 2026
        </span>
      </div>
      <p className="mt-6 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
        Credential ID KIQ-{course.id.toUpperCase().slice(0, 6)}-2026-0841 · verifiable at certifyiq.app/verify
      </p>
    </div>
  );
}

function CoursePage() {
  const { course } = Route.useLoaderData() as { course: Course };
  const [openModule, setOpenModule] = useState<number | null>(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const correct = course.quiz.filter((q, i) => answers[i] === q.answer).length;
  const score = Math.round((correct / course.quiz.length) * 100);
  const passed = score >= 80;

  return (
    <AppShell
      title={course.title}
      subtitle={`${course.program} · ${course.level} · ${course.modules.length} modules · ${course.hours} hours`}
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link to="/academy">All courses</Link>
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
        <div className="min-w-0 space-y-4">
          <Panel title="Course modules" description={course.summary} bodyClassName="p-0">
            <ul className="divide-y divide-border">
              {course.modules.map((m, i) => (
                <li key={m.title}>
                  <button
                    onClick={() => setOpenModule(openModule === i ? null : i)}
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/40"
                  >
                    <span className="font-mono text-[12px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1 text-[14px]">{m.title}</span>
                    <span className="cite whitespace-nowrap">{m.minutes} min</span>
                    <ChevronDown className={`size-4 shrink-0 text-slate transition-transform ${openModule === i ? "rotate-180" : ""}`} />
                  </button>
                  {openModule === i && (
                    <div className="border-t border-border bg-muted/25 px-5 py-4">
                      <p className="cite text-[10.5px] uppercase tracking-[0.14em]">Topics covered</p>
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {m.topics.map((t) => (
                          <li key={t}>
                            <Pill>{t}</Pill>
                          </li>
                        ))}
                      </ul>
                      <Button size="sm" variant="outline" className="mt-4">
                        Open module
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Module assessment" description="80% or higher earns the certificate of achievement">
            <ol className="space-y-6">
              {course.quiz.map((q, qi) => (
                <li key={q.q}>
                  <p className="text-[14px] leading-snug">
                    <span className="font-mono text-[12px] text-muted-foreground">Q{qi + 1}. </span>
                    {q.q}
                  </p>
                  <div className="mt-2.5 space-y-1.5">
                    {q.options.map((opt, oi) => {
                      const chosen = answers[qi] === oi;
                      const isRight = q.answer === oi;
                      const tone = submitted
                        ? isRight
                          ? "border-seal bg-seal-soft"
                          : chosen
                            ? "border-reject bg-reject-soft"
                            : "border-border"
                        : chosen
                          ? "border-ink bg-muted"
                          : "border-border hover:bg-muted/50";
                      return (
                        <button
                          key={opt}
                          disabled={submitted}
                          onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                          className={`flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left text-[13px] transition-colors ${tone}`}
                        >
                          {submitted && isRight && <CheckCircle2 className="size-4 shrink-0 text-seal" />}
                          {submitted && chosen && !isRight && <XCircle className="size-4 shrink-0 text-reject" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                  {submitted && (
                    <p className="mt-2 border-l-2 border-border pl-3 text-[12.5px] text-muted-foreground">{q.explain}</p>
                  )}
                </li>
              ))}
            </ol>

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4">
              {!submitted ? (
                <Button size="sm" disabled={Object.keys(answers).length < course.quiz.length} onClick={() => setSubmitted(true)}>
                  Submit assessment
                </Button>
              ) : (
                <>
                  <Pill tone={passed ? "seal" : "reject"}>
                    {correct}/{course.quiz.length} correct · {score}%
                  </Pill>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSubmitted(false);
                      setAnswers({});
                    }}
                  >
                    Retake
                  </Button>
                </>
              )}
              {Object.keys(answers).length < course.quiz.length && !submitted && (
                <Cite>Answer every question to submit</Cite>
              )}
            </div>
          </Panel>

          {submitted && passed && <Certificate course={course} score={score} />}
        </div>

        <div className="space-y-4">
          <Panel title="Your progress">
            <div className="mb-1.5 flex items-baseline justify-between">
              <Cite>Course completion</Cite>
              <span className="font-mono text-[12.5px]">{course.progress}%</span>
            </div>
            <Meter value={course.progress} tone={course.progress === 100 ? "seal" : "flag"} />
            <ul className="mt-4 space-y-2 text-[12.5px] text-muted-foreground">
              <li className="flex items-center gap-2">
                <Award className="size-4 text-slate" />
                {course.hours} continuing-education hours
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-slate" />
                Assessment pass mark 80%
              </li>
            </ul>
          </Panel>

          <Panel title="What you'll be able to audit">
            <ul className="space-y-2 text-[12.5px] text-muted-foreground">
              <li>Read a TIC line by line and identify the version of record for each rule.</li>
              <li>Trace every certified value back to third-party evidence.</li>
              <li>Distinguish a calculation error from an eligibility failure.</li>
              <li>Write remediation instructions an agency reviewer will accept.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
