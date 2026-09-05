import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ExternalLink, FileText, Printer } from "lucide-react";

import {
  listCertificationSupportingDocuments,
  markCertificationSupportingDocumentReviewed,
} from "@/utils/tic-certification-intake.functions";

type CertificationSupportingDocumentsPanelProps = {
  itemId: string;
};

export function CertificationSupportingDocumentsPanel({ itemId }: CertificationSupportingDocumentsPanelProps) {
  const queryClient = useQueryClient();
  const listDocuments = useServerFn(listCertificationSupportingDocuments);
  const markReviewed = useServerFn(markCertificationSupportingDocumentReviewed);

  const documents = useQuery({
    queryKey: ["certification-supporting-documents", itemId],
    queryFn: () => listDocuments({ data: { itemId } }),
  });

  const reviewMutation = useMutation({
    mutationFn: (documentId: string) => markReviewed({ data: { documentId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["certification-supporting-documents", itemId] });
    },
  });

  if (documents.isLoading) {
    return <div className="mt-3 rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">Loading supporting tenant documents…</div>;
  }

  if (documents.error) {
    return <div className="mt-3 rounded-lg border bg-background/70 p-3 text-xs text-destructive">Supporting tenant documents could not be loaded.</div>;
  }

  const rows = documents.data ?? [];
  if (!rows.length) return null;

  return (
    <div className="mt-3 rounded-lg border bg-background/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preserved supporting tenant documents</span>
        </div>
        <span className="text-xs text-muted-foreground">{rows.length} document{rows.length === 1 ? "" : "s"}</span>
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {rows.map((document) => (
          <article key={document.id} className="rounded-md border bg-background p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{document.display_name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {document.page_range_label} · read-only · {document.review_status === "reviewed" ? "reviewed" : "pending review"}
                </div>
              </div>
              {document.review_status === "reviewed" ? <CheckCircle2 className="size-4 shrink-0 text-compliant" /> : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {document.open_url ? (
                <a
                  href={document.open_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium"
                >
                  <ExternalLink className="size-3" /> Open
                </a>
              ) : null}
              {document.open_url && document.printable ? (
                <a
                  href={document.open_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium"
                  title="Open the preserved source pages, then use the browser or PDF viewer Print command."
                >
                  <Printer className="size-3" /> Open / Print
                </a>
              ) : null}
              {document.review_status !== "reviewed" ? (
                <button
                  type="button"
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate(document.id)}
                  className="rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  Mark reviewed
                </button>
              ) : null}
            </div>

            <div className="mt-2 text-[11px] text-muted-foreground">
              Source preserved from {document.original_file_name}. Classification confidence {Math.round(Number(document.classification_confidence ?? 0) * 100)}%.
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
