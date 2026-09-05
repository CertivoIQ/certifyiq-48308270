import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ExternalLink, FilePlus2, FileText, Printer, UploadCloud } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { uploadCertificationFile } from "@/lib/certification-upload";
import {
  SUPPORTING_DOCUMENT_DEFINITIONS,
  type SupportingDocumentType,
} from "@/lib/tic-supporting-document-registry";
import {
  listCertificationSupportingDocuments,
  markCertificationSupportingDocumentReviewed,
} from "@/utils/tic-certification-intake.functions";
import {
  attachStandaloneCertificationSupportingDocument,
  getCertificationSupportingUploadEligibility,
} from "@/utils/certification-supporting-upload.functions";

type CertificationSupportingDocumentsPanelProps = {
  itemId: string;
};

const ACCEPTED_SUPPORT_TYPES = ".pdf,.png,.jpg,.jpeg,.webp";
const MAX_SUPPORTING_UPLOAD_BYTES = 50 * 1024 * 1024;

async function sha256File(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function CertificationSupportingDocumentsPanel({ itemId }: CertificationSupportingDocumentsPanelProps) {
  const queryClient = useQueryClient();
  const listDocuments = useServerFn(listCertificationSupportingDocuments);
  const markReviewed = useServerFn(markCertificationSupportingDocumentReviewed);
  const getUploadEligibility = useServerFn(getCertificationSupportingUploadEligibility);
  const attachDocument = useServerFn(attachStandaloneCertificationSupportingDocument);
  const [supportFile, setSupportFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<SupportingDocumentType>("other_supporting_document");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  const documents = useQuery({
    queryKey: ["certification-supporting-documents", itemId],
    queryFn: () => listDocuments({ data: { itemId } }),
  });

  const eligibility = useQuery({
    queryKey: ["certification-supporting-upload-eligibility", itemId],
    queryFn: () => getUploadEligibility({ data: { itemId } }),
  });

  const reviewMutation = useMutation({
    mutationFn: (documentId: string) => markReviewed({ data: { documentId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["certification-supporting-documents", itemId] });
    },
  });

  async function uploadStandaloneSupportingDocument() {
    if (!supportFile || uploading || !eligibility.data?.eligible) return;
    setUploading(true);
    setUploadMessage("");
    let storagePath: string | null = null;
    try {
      if (supportFile.size > MAX_SUPPORTING_UPLOAD_BYTES) throw new Error("Supporting documents must be 50 MB or smaller.");
      if (!/^(application\/pdf|image\/(png|jpeg|webp))$/i.test(supportFile.type)) {
        throw new Error("Supporting documents must be PDF, PNG, JPEG, or WEBP files.");
      }
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) throw new Error("Please sign in before attaching a supporting document.");

      const safeName = supportFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      storagePath = `${user.id}/supporting/${itemId}/${crypto.randomUUID()}-${safeName}`;
      const sourceSha256 = await sha256File(supportFile);
      await uploadCertificationFile("certification-imports", storagePath, supportFile);
      await attachDocument({
        data: {
          itemId,
          documentType,
          storagePath,
          originalFileName: supportFile.name,
          mimeType: supportFile.type,
          sizeBytes: supportFile.size,
          sha256: sourceSha256,
        },
      });

      setSupportFile(null);
      setDocumentType("other_supporting_document");
      setUploadMessage("Supporting document attached to this tenant certification and placed in pending review.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["certification-supporting-documents", itemId] }),
        queryClient.invalidateQueries({ queryKey: ["certification-supporting-upload-eligibility", itemId] }),
        queryClient.invalidateQueries({ queryKey: ["certification-items"] }),
      ]);
    } catch (error) {
      if (storagePath) {
        await supabase.storage.from("certification-imports").remove([storagePath]).catch(() => undefined);
      }
      setUploadMessage(error instanceof Error ? error.message : "The supporting document could not be attached.");
    } finally {
      setUploading(false);
    }
  }

  if (documents.isLoading || eligibility.isLoading) {
    return <div className="mt-3 rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">Loading supporting tenant documents…</div>;
  }

  if (documents.error || eligibility.error) {
    return <div className="mt-3 rounded-lg border bg-background/70 p-3 text-xs text-destructive">Supporting tenant documents could not be loaded.</div>;
  }

  const rows = documents.data ?? [];

  return (
    <div className="mt-3 rounded-lg border bg-background/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preserved supporting tenant documents</span>
        </div>
        <span className="text-xs text-muted-foreground">{rows.length} document{rows.length === 1 ? "" : "s"}</span>
      </div>

      {eligibility.data?.eligible ? (
        <div className="mt-3 rounded-md border border-dashed bg-muted/20 p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FilePlus2 className="size-4" /> Add one supporting document to this pending certification
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]">
            <select
              value={documentType}
              disabled={uploading}
              onChange={(event) => setDocumentType(event.target.value as SupportingDocumentType)}
              className="rounded-md border bg-background px-3 py-2 text-sm"
              aria-label="Supporting document type"
            >
              {SUPPORTING_DOCUMENT_DEFINITIONS.map((definition) => (
                <option key={definition.type} value={definition.type}>{definition.label}</option>
              ))}
            </select>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
              <UploadCloud className="size-4 shrink-0" />
              <span className="truncate">{supportFile?.name ?? "Choose PDF, PNG, JPG, or WEBP"}</span>
              <input
                className="sr-only"
                type="file"
                accept={ACCEPTED_SUPPORT_TYPES}
                disabled={uploading}
                onChange={(event) => {
                  setSupportFile(event.target.files?.[0] ?? null);
                  setUploadMessage("");
                }}
              />
            </label>
            <button
              type="button"
              disabled={!supportFile || uploading}
              onClick={() => void uploadStandaloneSupportingDocument()}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {uploading ? "Attaching…" : "Attach to certification"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            The source file is preserved read-only under this tenant and certification. Attaching it does not change TIC fields or automatically start/restart review.
          </p>
        </div>
      ) : eligibility.data?.reason ? (
        <div className="mt-3 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">{eligibility.data.reason}</div>
      ) : null}

      {uploadMessage ? <div className="mt-2 rounded-md border p-2 text-xs" role="status">{uploadMessage}</div> : null}

      {rows.length ? (
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
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">No supporting documents are attached to this certification yet.</p>
      )}
    </div>
  );
}
