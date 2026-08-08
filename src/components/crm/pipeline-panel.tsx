import { useMemo } from "react";
import { Panel, Pill, Stat, Meter } from "@/components/ui-kit";
import { money, TERRITORIES, type Account, type Activity } from "@/lib/crm";

export function PipelinePanel({ accounts, activities }: { accounts: Account[]; activities: Activity[] }) {
  const byState = useMemo(() => {
    const map = new Map<string, { units: number; leads: number; arr: number }>();
    for (const a of accounts) {
      const states = (a.states ?? []).length ? a.states! : ["—"];
      for (const s of states) {
        const e = map.get(s) ?? { units: 0, leads: 0, arr: 0 };
        e.leads += 1;
        e.units += Math.round(Number(a.units ?? 0) / states.length);
        e.arr += Number(a.arr ?? 0) / states.length;
        map.set(s, e);
      }
    }
    return Array.from(map.entries())
      .map(([state, v]) => ({ state, ...v }))
      .sort((a, b) => b.arr - a.arr)
      .slice(0, 12);
  }, [accounts]);

  const byTerritory = useMemo(
    () =>
      TERRITORIES.map((t) => {
        const group = accounts.filter((a) => a.territory === t);
        return {
          territory: t,
          leads: group.length,
          arr: group.reduce((n, a) => n + Number(a.arr ?? 0), 0),
          units: group.reduce((n, a) => n + Number(a.units ?? 0), 0),
        };
      }),
    [accounts],
  );

  const contacted = accounts.filter((a) => a.last_contact_on).length;
  const responded = accounts.filter((a) => a.responded).length;
  const responseRate = contacted ? Math.round((responded / contacted) * 100) : 0;
  const totalUnits = accounts.reduce((n, a) => n + Number(a.units ?? 0), 0);
  const totalArr = accounts.reduce((n, a) => n + Number(a.arr ?? 0), 0);
  const dueToday = accounts.filter(
    (a) => a.next_followup_on && a.next_followup_on <= new Date().toISOString().slice(0, 10),
  );
  const maxArr = Math.max(...byState.map((s) => s.arr), 1);
  const maxTerr = Math.max(...byTerritory.map((s) => s.arr), 1);

  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Addressable pipeline" value={money(totalArr)} hint={`${accounts.length} enterprise leads`} />
        <Stat label="Units in pipeline" value={totalUnits.toLocaleString()} hint="Across all tracked portfolios" />
        <Stat label="Response rate" value={`${responseRate}%`} hint={`${responded} replies · ${contacted} contacted`} />
        <Stat label="Follow-ups due" value={String(dueToday.length)} hint={`${activities.length} logged touches`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Leads by state" description="Top states by attributable pipeline value" bodyClassName="p-5">
          <ul className="space-y-3">
            {byState.map((s) => (
              <li key={s.state}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-medium">{s.state}</span>
                  <span className="font-mono text-[12px] text-muted-foreground">
                    {s.leads} leads · {s.units.toLocaleString()} units · {money(s.arr)}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Meter value={Math.round((s.arr / maxArr) * 100)} tone="seal" />
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-4">
          <Panel title="Territory coverage" description="Assign reps against pipeline weight" bodyClassName="p-5">
            <ul className="space-y-3">
              {byTerritory.map((t) => (
                <li key={t.territory}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-medium">{t.territory}</span>
                    <span className="font-mono text-[12px] text-muted-foreground">
                      {t.leads} leads · {money(t.arr)}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Meter value={Math.round((t.arr / maxTerr) * 100)} tone="flag" />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Recent contact activity" description="Every logged email and call" bodyClassName="p-0">
            <ul className="divide-y divide-border">
              {activities.slice(0, 8).map((a) => (
                <li key={a.id} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Pill tone={a.outcome === "sent" ? "seal" : "flag"}>{a.kind}</Pill>
                    <span className="truncate text-[13px]">{a.subject ?? "—"}</span>
                    <span className="cite ml-auto shrink-0">{new Date(a.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="cite mt-1">
                    {a.actor_email ?? "system"} · {a.outcome ?? "logged"}
                  </p>
                </li>
              ))}
              {!activities.length && (
                <li className="px-5 py-6 text-[13px] text-muted-foreground">
                  No outreach logged yet — send a mail merge to start the feed.
                </li>
              )}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
