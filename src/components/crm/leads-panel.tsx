import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Loader2, Search, Send, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Panel, Pill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  STAGES,
  STAGE_TONE,
  TERRITORIES,
  csvToLeads,
  leadsToCsv,
  linkTo,
  money,
  scoreTone,
  type Account,
} from "@/lib/crm";

const th = "px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground";
const td = "px-3 py-2.5 align-top text-[12.5px]";

export function LeadsPanel({
  accounts,
  selected,
  onSelectedChange,
  onMailMerge,
}: {
  accounts: Account[];
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
  onMailMerge: () => void;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [territory, setTerritory] = useState<string>("all");
  const [program, setProgram] = useState<string>("all");
  const [stage, setStage] = useState<string>("all");

  const programs = useMemo(
    () => Array.from(new Set(accounts.flatMap((a) => a.programs ?? []))).sort(),
    [accounts],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return accounts
      .filter((a) => (territory === "all" ? true : a.territory === territory))
      .filter((a) => (program === "all" ? true : (a.programs ?? []).includes(program)))
      .filter((a) => (stage === "all" ? true : a.stage === stage))
      .filter((a) =>
        !needle
          ? true
          : [a.name, a.hq, (a.states ?? []).join(" "), (a.programs ?? []).join(" "), a.owner]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(needle)),
      )
      .sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0));
  }, [accounts, q, territory, program, stage]);

  const allShownSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));

  const importCsv = useMutation({
    mutationFn: async (file: File) => {
      const records = csvToLeads(await file.text());
      if (!records.length) throw new Error("No rows found in that file");
      const { error } = await supabase.from("crm_accounts").insert(records as never);
      if (error) throw error;
      return records.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["crm", "accounts"] });
      toast.success(`${n} leads imported`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Import failed"),
  });

  function exportCsv() {
    const source = selected.length ? rows.filter((r) => selected.includes(r.id)) : rows;
    const blob = new Blob([leadsToCsv(source)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `certivoiq-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${source.length} leads exported — ready for Google Sheets`);
  }

  return (
    <Panel
      title="Enterprise lead list"
      description="Owners and management companies with enterprise-scale affordable portfolios. Contact fields stay blank until your team verifies them."
      bodyClassName="p-0"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="size-4" /> Export CSV
          </Button>
          <Button size="sm" variant="outline" asChild disabled={importCsv.isPending}>
            <label className="cursor-pointer">
              {importCsv.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Import
              CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importCsv.mutate(f);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
          <Button size="sm" disabled={!selected.length} onClick={onMailMerge}>
            <Send className="size-4" /> Mail merge ({selected.length})
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company, state, program"
            className="h-9 w-64 pl-8 text-[13px]"
          />
        </div>
        <Select value={territory} onChange={setTerritory} options={["all", ...TERRITORIES]} label="Territory" />
        <Select value={program} onChange={setProgram} options={["all", ...programs]} label="Program" />
        <Select value={stage} onChange={setStage} options={["all", ...STAGES]} label="Stage" />
        <span className="cite ml-auto">
          {rows.length} of {accounts.length} leads
        </span>
      </div>

      <div className="max-h-[560px] overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border">
              <th className={th}>
                <Checkbox
                  checked={allShownSelected}
                  onCheckedChange={(v) =>
                    onSelectedChange(
                      v
                        ? Array.from(new Set([...selected, ...rows.map((r) => r.id)]))
                        : selected.filter((id) => !rows.some((r) => r.id === id)),
                    )
                  }
                  aria-label="Select all shown leads"
                />
              </th>
              <th className={th}>Company</th>
              <th className={th}>Headquarters</th>
              <th className={th}>Portfolio</th>
              <th className={th}>Programs</th>
              <th className={th}>Fit / ARR</th>
              <th className={th}>Score</th>
              <th className={th}>Stage</th>
              <th className={th}>Next follow-up</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-border/70 hover:bg-muted/40">
                <td className={td}>
                  <Checkbox
                    checked={selected.includes(a.id)}
                    onCheckedChange={(v) =>
                      onSelectedChange(v ? [...selected, a.id] : selected.filter((id) => id !== a.id))
                    }
                    aria-label={`Select ${a.name}`}
                  />
                </td>
                <td className={td}>
                  <p className="font-medium">{a.name}</p>
                  <p className="cite">
                    {a.role ?? "—"}
                    {linkTo(a.website) && (
                      <>
                        {" · "}
                        <a
                          href={linkTo(a.website)!}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-primary hover:underline"
                        >
                          {a.website}
                        </a>
                      </>
                    )}
                  </p>
                </td>
                <td className={td}>
                  <p>{a.hq ?? "—"}</p>
                  <p className="cite">{(a.states ?? []).slice(0, 6).join(", ")}{(a.states ?? []).length > 6 ? "…" : ""}</p>
                </td>
                <td className={`${td} font-mono`}>
                  <p>{Number(a.units ?? 0).toLocaleString()} units</p>
                  <p className="cite">{Number(a.properties ?? 0).toLocaleString()} properties</p>
                </td>
                <td className={td}>
                  <div className="flex flex-wrap gap-1">
                    {(a.programs ?? []).slice(0, 3).map((p) => (
                      <Pill key={p} tone="neutral">
                        {p}
                      </Pill>
                    ))}
                  </div>
                </td>
                <td className={`${td} font-mono`}>
                  <p>{a.plan ?? "—"}</p>
                  <p className="cite">{money(Number(a.arr ?? 0))}/yr</p>
                </td>
                <td className={td}>
                  <Pill tone={scoreTone(a.lead_score ?? 0)}>{a.lead_score ?? 0}</Pill>
                </td>
                <td className={td}>
                  <Pill tone={STAGE_TONE[a.stage]} className="capitalize">
                    {a.stage}
                  </Pill>
                </td>
                <td className={`${td} font-mono`}>
                  <p>{a.next_followup_on ?? "—"}</p>
                  <p className="cite">last {a.last_contact_on ?? "never"}</p>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="px-4 py-6 text-[13px] text-muted-foreground" colSpan={9}>
                  No leads match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  label: string;
}) {
  return (
    <label className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2 text-[13px] text-foreground capitalize"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === "all" ? "All" : o}
          </option>
        ))}
      </select>
    </label>
  );
}
