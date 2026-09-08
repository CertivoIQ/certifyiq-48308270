import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileSearch, Library, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { StateDocumentLibrary } from "@/components/state-document-library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { recognizeCertificationDocument } from "@/lib/compliance-document-recognition.functions";

export const Route = createFileRoute("/_authenticated/document-intelligence")({
  head: () => ({
    meta: [
      { title: "Document Intelligence — CertivoIQ" },
      {
        name: "description",
        content:
          "Versioned compliance forms, effective dates, recognition status, signatures, required fields, and source validation controls.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DocumentIntelligencePage,
});

type RegistryForm = {
  id: string;
  form_code: string;
  form_name: string;
  form_family: string;
  issuing_authority: string;
  program_codes: string[];
  revision_label: string;
  effective_from: string | null;
  effective_to: string | null;
  source_url: string | null;
  source_sha256: string | null;
  required_fields: unknown[];
  required_signatures: unknown[];
  support_status: string;
  validation_support: Record<string, unknown>;
  notes: string | null;
};

type ImportItem = {
  id: string;
  original_file_name: string;
  jurisdiction: string | null;
  certification_type: string | null;
  created_at: string;
};

type DocumentInstance = {
  id: string;
  certification_item_id: string;
  registry_form_id: string | null;
  detected_form_code: string | null;
  recognition_status: string;
  confidence: number | null;
  review_status: string;
  created_at: string;
};

type DynamicQueryResult = {
  data: unknown[] | null;
  error: unknown;
};

type DynamicQuery = PromiseLike<DynamicQueryResult> & {
  select: (columns: string) => DynamicQuery;
  order: (column: string, options?: { ascending?: boolean }) => DynamicQuery;
  limit: (count: number) => DynamicQuery;
};

type DynamicSupabaseClient = {
  from: (relation: string) => DynamicQuery;
};

const STATUS_LABELS: Record<string, string> = {
  source_validation_required: "Source validation required",
  validated_supported: "Validated supported",
  limited_support: "Limited support",
  unsupported: "Unsupported",
  superseded: "Superseded",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function DocumentIntelligencePage() {
  const client = supabase as unknown as DynamicSupabaseClient;
  const queryClient = useQueryClient();
  const recognizeDocument = useServerFn(recognizeCertificationDocument);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const registry = useQuery({
    queryKey: ["compliance-form-registry"],
    queryFn: async (): Promise<RegistryForm[]> => {
      const { data, error } = await client
        .from("compliance_form_registry")
        .select("id,form_code,form_name,form_family,issuing_authority,program_codes,revision_label,effective_from,effective_to,source_url,source_sha256,required_fields,required_signatures,support_status,validation_support,notes")
        .order("form_code");
      if (error) throw error;
      return (data ?? []) as RegistryForm[];
    },
  });

  const recentImports = useQuery({
    queryKey: ["document-intelligence", "recent-imports"],
    queryFn: async (): Promise<ImportItem[]> => {
      const { data, error } = await client
        .from("certification_import_items")
        .select("id,original_file_name,jurisdiction,certification_type,created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as ImportItem[];
    },
  });

  const instances = useQuery({
    queryKey: ["document-intelligence", "instances"],
    queryFn: async (): Promise<DocumentInstance[]> => {
      const { data, error } = await client
        .from("certification_document_instances")
        .select("id,certification_item_id,registry_form_id,detected_form_code,recognition_status,confidence,review_status,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as DocumentInstance[];
    },
  });

  const recognition = useMutation({
    mutationFn: async (itemId: string) => recognizeDocument({ data: { itemId } }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["document-intelligence", "instances"] });
      if (result.instance.recognition_status === "recognized") {
        toast.success(`${result.instance.detected_form_code ?? "Document"} recognized`);
      } else if (result.instance.recognition_status === "ambiguous") {
        toast.warning("Multiple regulated form identifiers were found. Analyst verification is required.");
      } else {
        toast.message("Document recorded; no supported form identifier was confirmed.");
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Document recognition failed"),
  });

  const instanceByItem = useMemo(
    () => new Map((instances.data ?? []).map((item) => [item.certification_item_id, item])),
    [instances.data],
  );

  const filteredRegistry = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (registry.data ?? []).filter((form) => {
      const matchesStatus = status === "all" || form.support_status === status;
      const matchesSearch = !needle || [
        form.form_code,
        form.form_name,
        form.form_family,
        form.issuing_authority,
        ...form.program_codes,
      ].some((value) => String(value).toLowerCase().includes(needle));
      return matchesStatus && matchesSearch;
    });
  }, [registry.data, search, status]);

  const validatedCount = (registry.data ?? []).filter((form) => form.support_status === "validated_supported").length;
  const recognizedCount = (instances.data ?? []).filter((item) => item.recognition_status === "recognized").length;

  return (
    <AppShell
      title="Document Intelligence"
      subtitle="Versioned forms, effective periods, required evidence, signatures, and recognition controls"
    >
      <StateDocumentLibrary />
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Registry forms" value={registry.data?.length ?? 0} hint="Controlled form families and revisions" />
        <Stat label="Validated supported" value={validatedCount} hint="Source and validation controls complete" />
        <Stat label="Needs source validation" value={(registry.data?.length ?? 0) - validatedCount} hint="Not authorized for decision use" />
        <Stat label="Recognized files" value={recognizedCount} hint="Recent certification documents" />
      </div>

      <Panel
        className="mt-4"
        title="Compliance document registry"
        description="Recognition and organization are separate from compliance decision authority. A form becomes supported only after its official source, revision, effective period, required fields, signatures, and validation fixtures are controlled."
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <FileSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search form, program, family, or authority" />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-[13px]"
            aria-label="Filter registry support status"
          >
            <option value="all">All support states</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-3">Form</th>
                <th className="pb-3">Programs</th>
                <th className="pb-3">Revision / effective period</th>
                <th className="pb-3">Required controls</th>
                <th className="pb-3">Support status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRegistry.map((form) => (
                <tr key={form.id} className="border-t border-border align-top">
                  <td className="py-3 pr-4">
                    <div className="font-medium">{form.form_code}</div>
                    <div className="text-xs text-muted-foreground">{form.form_name}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{form.form_family.replaceAll("_", " ")}</div>
                  </td>
                  <td className="py-3 pr-4 text-xs">{form.program_codes.length ? form.program_codes.join(" · ") : "Program mapping pending"}</td>
                  <td className="py-3 pr-4 text-xs">
                    <div>{form.revision_label}</div>
                    <div className="mt-1 text-muted-foreground">{formatDate(form.effective_from)} → {formatDate(form.effective_to)}</div>
                  </td>
                  <td className="py-3 pr-4 text-xs">
                    <div>Fields: {Array.isArray(form.required_fields) ? form.required_fields.length : 0}</div>
                    <div>Signatures: {Array.isArray(form.required_signatures) ? form.required_signatures.length : 0}</div>
                    <div className="mt-1 text-muted-foreground">Source SHA: {form.source_sha256 ? "recorded" : "required"}</div>
                  </td>
                  <td className="py-3"><Pill>{STATUS_LABELS[form.support_status] ?? form.support_status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        className="mt-4"
        title="Recent certification documents"
        description="Run deterministic form recognition against uploaded certification files. Uncertain, unsupported, or not-yet-validated forms remain pending analyst verification."
      >
        <div className="grid gap-3 md:grid-cols-2">
          {(recentImports.data ?? []).map((item) => {
            const instance = instanceByItem.get(item.id);
            return (
              <div key={item.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{item.original_file_name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.jurisdiction ?? "US"} · {item.certification_type ?? "Certification type pending"}
                    </div>
                  </div>
                  <Library className="size-5 shrink-0 text-muted-foreground" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  {instance ? (
                    <>
                      <Pill>{instance.detected_form_code ?? instance.recognition_status}</Pill>
                      <span className="text-muted-foreground">{instance.recognition_status.replaceAll("_", " ")}</span>
                      {instance.confidence != null ? <span className="text-muted-foreground">{Math.round(instance.confidence * 100)}% identifier confidence</span> : null}
                    </>
                  ) : <span className="text-muted-foreground">Not yet checked against the form registry</span>}
                </div>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="outline"
                  disabled={recognition.isPending}
                  onClick={() => recognition.mutate(item.id)}
                >
                  <ShieldCheck className="size-4" />
                  {instance ? "Recheck form identity" : "Check form identity"}
                </Button>
              </div>
            );
          })}
          {!recentImports.isLoading && !(recentImports.data?.length ?? 0) ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground md:col-span-2">
              No certification documents are available yet. Uploaded certification files will appear here for controlled form recognition.
            </div>
          ) : null}
        </div>
      </Panel>
    </AppShell>
  );
}
