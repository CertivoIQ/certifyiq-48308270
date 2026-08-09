import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  ExternalLink,
  FileArchive,
  FileText,
  FolderOpen,
  Mail,
  Search,
  Send,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { CrmShell } from "@/components/crm/crm-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "@/components/ui-kit";
import { useIsStaff } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { NewsItem, Template } from "@/lib/crm";

type CrmDocument = Database["public"]["Tables"]["crm_documents"]["Row"];

const BUCKET = "crm-marketing-documents";
const MAX_BYTES = 25 * 1024 * 1024;
const CATEGORIES = [
  { value: "one-pager", label: "One-pager" },
  { value: "sales-deck", label: "Sales deck" },
  { value: "case-study", label: "Case study" },
  { value: "brand-asset", label: "Brand asset" },
  { value: "worksheet", label: "Worksheet" },
  { value: "other", label: "Other" },
] as const;
const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/csv",
]);

export const Route = createFileRoute("/_authenticated/crm-documents")({
  head: () => ({
    meta: [
      { title: "Marketing Documents — CertivoIQ CRM" },
      {
        name: "description",
        content:
          "Staff-only CertivoIQ marketing document and outreach template library.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CrmDocumentsPage,
});

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function categoryLabel(value: string) {
  return (
    CATEGORIES.find((category) => category.value === value)?.label ?? "Other"
  );
}

function CrmDocumentsPage() {
  const { isStaff, loading, email } = useIsStaff();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    name: "",
    description: "",
    category: "other",
  });

  const documents = useQuery({
    queryKey: ["crm", "documents"],
    enabled: isStaff,
    queryFn: async (): Promise<CrmDocument[]> => {
      const { data, error } = await supabase
        .from("crm_documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const templates = useQuery({
    queryKey: ["crm", "templates"],
    enabled: isStaff,
    queryFn: async (): Promise<Template[]> => {
      const { data, error } = await supabase
        .from("crm_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const news = useQuery({
    queryKey: ["crm", "news"],
    enabled: isStaff,
    queryFn: async (): Promise<NewsItem[]> => {
      const { data, error } = await supabase
        .from("crm_news")
        .select("*")
        .order("published_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error("Choose a file to upload");
      if (!uploadForm.name.trim()) throw new Error("Document name is required");
      if (uploadFile.size > MAX_BYTES)
        throw new Error("Files must be 25 MB or smaller");
      if (!ACCEPTED_TYPES.has(uploadFile.type)) {
        throw new Error(
          "Use PDF, PowerPoint, Word, Excel, CSV, text, PNG, JPG, or WebP",
        );
      }

      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      if (authError || !authData.user)
        throw new Error("Your session has expired");

      const safeFileName = uploadFile.name
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .slice(-120);
      const storagePath = `${authData.user.id}/${crypto.randomUUID()}-${safeFileName}`;
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, uploadFile, {
          cacheControl: "3600",
          contentType: uploadFile.type,
          upsert: false,
        });
      if (storageError) throw storageError;

      const { error: insertError } = await supabase
        .from("crm_documents")
        .insert({
          name: uploadForm.name.trim(),
          description: uploadForm.description.trim() || null,
          category: uploadForm.category,
          storage_path: storagePath,
          file_name: uploadFile.name,
          mime_type: uploadFile.type,
          size_bytes: uploadFile.size,
          created_by: authData.user.id,
        });

      if (insertError) {
        await supabase.storage.from(BUCKET).remove([storagePath]);
        throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm", "documents"] });
      setUploadOpen(false);
      setUploadFile(null);
      setUploadForm({ name: "", description: "", category: "other" });
      toast.success("Marketing document added");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Upload failed"),
  });

  const filteredDocuments = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (documents.data ?? []).filter((document) => {
      const matchesCategory =
        category === "all" || document.category === category;
      const matchesSearch =
        !needle ||
        document.name.toLowerCase().includes(needle) ||
        document.file_name.toLowerCase().includes(needle) ||
        document.description?.toLowerCase().includes(needle);
      return matchesCategory && matchesSearch;
    });
  }, [category, documents.data, search]);

  const filteredTemplates = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (templates.data ?? []).filter(
      (template) =>
        !needle ||
        template.name.toLowerCase().includes(needle) ||
        template.subject.toLowerCase().includes(needle) ||
        template.body.toLowerCase().includes(needle),
    );
  }, [search, templates.data]);

  const downloadDocument = async (document: CrmDocument) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(document.storage_path, 60, {
        download: document.file_name,
      });
    if (error || !data?.signedUrl) {
      toast.error("Could not create a secure download link");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <CrmShell
      email={email}
      isStaff={isStaff}
      loading={loading}
      newsItems={news.data ?? []}
    >
      <section className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-gradient-to-br from-emerald-950 via-emerald-900 to-green-700 p-6 text-white shadow-xl shadow-emerald-950/10 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-200">
              Marketing library
            </p>
            <h2 className="mt-2 font-sans text-3xl font-semibold tracking-tight sm:text-4xl">
              Documents, templates, and outreach in one place.
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-emerald-100/80">
              Uploaded files stay private. Staff downloads use short-lived
              links, while email templates connect directly to the CRM composer.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-white text-emerald-950 hover:bg-emerald-50"
              asChild
            >
              <Link to="/crm">
                <Mail className="size-4" /> Compose from CRM
              </Link>
            </Button>
            <Button
              className="border border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={() => setUploadOpen(true)}
            >
              <Upload className="size-4" /> Upload document
            </Button>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <LibraryStat
          label="Stored documents"
          value={String(documents.data?.length ?? 0)}
          icon={<FolderOpen className="size-5" />}
        />
        <LibraryStat
          label="Email templates"
          value={String(templates.data?.length ?? 0)}
          icon={<Mail className="size-5" />}
        />
        <LibraryStat
          label="Maximum file size"
          value="25 MB"
          icon={<FileArchive className="size-5" />}
        />
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-emerald-900/10 bg-white p-4 shadow-sm dark:bg-emerald-950/20 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search documents and templates"
          />
        </label>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-[13px]"
          aria-label="Filter document category"
        >
          <option value="all">All document categories</option>
          {CATEGORIES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel
          title="Marketing documents"
          description="Private files available only to verified CertivoIQ staff"
          bodyClassName="p-0"
          actions={
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="size-4" /> Add file
            </Button>
          }
        >
          <ul className="grid gap-3 p-4 sm:grid-cols-2">
            <li className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/50">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-700 text-white">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-[14px] font-semibold">
                    CertivoIQ intro one-pager
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Built-in · printable / save as PDF
                  </p>
                  <Button className="mt-3" size="sm" variant="outline" asChild>
                    <Link to="/marketing-kit">
                      <ExternalLink className="size-3.5" /> Open
                    </Link>
                  </Button>
                </div>
              </div>
            </li>

            {filteredDocuments.map((document) => (
              <li
                key={document.id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
                    <FileText className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sans text-[14px] font-semibold">
                      {document.name}
                    </p>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                      {categoryLabel(document.category)}
                    </p>
                    {document.description && (
                      <p className="mt-2 line-clamp-2 text-[12.5px] text-muted-foreground">
                        {document.description}
                      </p>
                    )}
                    <p className="mt-2 text-[11.5px] text-muted-foreground">
                      {formatBytes(document.size_bytes)} ·{" "}
                      {formatDate(document.created_at)}
                    </p>
                    <Button
                      className="mt-3"
                      size="sm"
                      variant="outline"
                      onClick={() => downloadDocument(document)}
                    >
                      <Download className="size-3.5" /> Secure download
                    </Button>
                  </div>
                </div>
              </li>
            ))}

            {!documents.isLoading && !filteredDocuments.length && (
              <li className="rounded-xl border border-dashed border-emerald-300 p-6 text-center text-[13px] text-muted-foreground sm:col-span-2">
                No uploaded documents match this view. The built-in one-pager
                remains available above.
              </li>
            )}
          </ul>
        </Panel>

        <Panel
          title="Email templates"
          description="Use approved copy in personalized staff outreach"
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border">
            {filteredTemplates.map((template) => (
              <li key={template.id} className="p-4">
                <p className="font-sans text-[14px] font-semibold">
                  {template.name}
                </p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                  {template.category} ·{" "}
                  {template.compliance_event ?? "evergreen"}
                </p>
                <p className="mt-2 line-clamp-2 text-[12.5px] text-muted-foreground">
                  {template.subject}
                </p>
                <Button className="mt-3" size="sm" variant="outline" asChild>
                  <Link to="/crm">
                    <Send className="size-3.5" /> Use in CRM
                  </Link>
                </Button>
              </li>
            ))}
            {!templates.isLoading && !filteredTemplates.length && (
              <li className="p-6 text-center text-[13px] text-muted-foreground">
                No email templates match your search.
              </li>
            )}
          </ul>
        </Panel>
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a marketing document</DialogTitle>
            <DialogDescription>
              Files are stored in a private bucket and downloaded through a
              60-second signed link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="crm-document-file">File</Label>
              <Input
                id="crm-document-file"
                type="file"
                accept=".pdf,.pptx,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setUploadFile(file);
                  if (file && !uploadForm.name) {
                    setUploadForm((current) => ({
                      ...current,
                      name: file.name.replace(/\.[^.]+$/, ""),
                    }));
                  }
                }}
              />
              <p className="text-[11.5px] text-muted-foreground">
                PDF, Office, CSV, text, or image · 25 MB maximum
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="crm-document-name">Display name</Label>
              <Input
                id="crm-document-name"
                value={uploadForm.name}
                maxLength={160}
                onChange={(event) =>
                  setUploadForm({ ...uploadForm, name: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="crm-document-category">Category</Label>
              <select
                id="crm-document-category"
                value={uploadForm.category}
                onChange={(event) =>
                  setUploadForm({ ...uploadForm, category: event.target.value })
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px]"
              >
                {CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="crm-document-description">Description</Label>
              <Textarea
                id="crm-document-description"
                rows={3}
                value={uploadForm.description}
                onChange={(event) =>
                  setUploadForm({
                    ...uploadForm,
                    description: event.target.value,
                  })
                }
                placeholder="When staff should use this file"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => upload.mutate()} disabled={upload.isPending}>
              <Upload className="size-4" />{" "}
              {upload.isPending ? "Uploading..." : "Upload document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CrmShell>
  );
}

function LibraryStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm dark:bg-emerald-950/20">
      <div className="flex items-center justify-between text-emerald-700">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em]">
          {label}
        </p>
        {icon}
      </div>
      <p className="mt-3 font-sans text-2xl font-semibold text-emerald-950 dark:text-emerald-50">
        {value}
      </p>
    </div>
  );
}
