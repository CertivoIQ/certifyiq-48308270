import { calculateTicWorksheet, newTicWorksheetSettings, type TicWorksheetSettings } from "@/lib/tic-calculations";
import { TicIncomeWorksheet } from "@/components/tic-income-worksheet";
import { CertificationIncomeCalculator } from "@/components/certification-income-calculator";
import { calculateIncomePreparation, type IncomeDraft, type IncomePreparation } from "@/lib/certification-income-evidence";
import { ticCompletenessFindings } from "@/lib/tic-completeness";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { FileSearch, FileText, FileUp, UploadCloud } from "lucide-react";

import { handwritingReader } from "@/lib/tic-handwriting";
import { TicPacketOrganizer } from "@/components/tic-packet-organizer";
import { initialPageChoices, packetInventory, validatePageChoices, type PacketPageChoice, type PacketPageInventory } from "@/lib/tic-packet-selection";
import { CertivoIqTicReviewForm } from "@/components/certivoiq-tic-review-form";
import { supabase } from "@/integrations/supabase/client";
import { MAX_UPLOAD_BYTES, sidecarPathFor } from "@/lib/ocr-sidecar.mjs";
import { isOcrSupportedFile, inspectCertificationPacket, identifyCertificationPageLabels, prepareCertificationForReview } from "@/lib/pdf-ocr";
import { uploadCertificationFile } from "@/lib/certification-upload";
import { TIC_FIELD_DEFINITIONS } from "@/lib/tic-field-registry";
import {
  SUPPORTING_DOCUMENT_DEFINITIONS,
  type SupportingDocumentType,
} from "@/lib/tic-supporting-document-registry";
import {
  cancelCertificationTicPreview,
  confirmCertificationTicPreview,
  extractCertificationTicPreview,
  listCertificationTenantDestinations,
} from "@/utils/tic-certification-intake.functions";

type Db = any;
type SupportingClassificationChoice = SupportingDocumentType | "tic_page";

type PreviewFact = {
  field: string;
  value: unknown;
  page: number | null;
  snippet: string | null;
  confidence: number;
  provider: string;
};

type DraftSource = {
  jobId: string;
  storagePath: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadDurationMs: number;
  extractionDurationMs: number;
  totalIntakeDurationMs: number;
  uploadTransport: string;
};

type SupportingPreviewGroup = {
  id: string;
  documentType: SupportingDocumentType;
  label: string;
  pageStart: number;
  pageEnd: number;
  pageNumbers: number[];
  confidence: number;
  classificationBasis: string;
};

type ExtractionDraft = {
  source: DraftSource;
  facts: PreviewFact[];
  missingFields: string[];
  confidence: number;
  extractionProvider: string;
  sourcePreviewUrl: string | null;
  supportingDocuments: SupportingPreviewGroup[];
  pageClassifications: PacketPageInventory[];
  selectionDigest: string | null;
  ticPages: number[];
  omittedPages: number[];
  incomePreparation: IncomePreparation | null;
};

const ACCEPTED_DOCUMENT_TYPES = ".pdf,.png,.jpg,.jpeg,.webp";
const OCR_SIDECAR_STORAGE_MIME = "application/octet-stream";

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function fieldText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function isPdfSource(source: DraftSource) {
  return /application\/pdf/i.test(source.mimeType) || /\.pdf$/i.test(source.originalFileName);
}

function sourcePageUrl(baseUrl: string | null, source: DraftSource, page: number) {
  if (!baseUrl) return null;
  return isPdfSource(source) ? `${baseUrl}#page=${page}` : baseUrl;
}

export function CertificationUploadPanel() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const extractPreview = useServerFn(extractCertificationTicPreview);
  const confirmPreview = useServerFn(confirmCertificationTicPreview);
  const cancelPreview = useServerFn(cancelCertificationTicPreview);
  const listTenantDestinations = useServerFn(listCertificationTenantDestinations);

  const tenantDestinations = useQuery({
    queryKey: ["certification-tenant-destinations"],
    queryFn: () => listTenantDestinations(),
  });

  const reviewAccess=useQuery({queryKey:["certification-review-access"],queryFn:async()=>{const {data,error}=await (supabase as unknown as Db).rpc("income_calculator_access");if(error)throw error;return data as {allowed:boolean;mode:string;remaining:number|null;reason:string};}});
  const stagedFile = useRef<File | null>(null);
  const labelAbort = useRef<AbortController | null>(null);
  const labelTask = useRef<Promise<void> | null>(null);
  const [identifyingPages, setIdentifyingPages] = useState(false);
  const [useHandwriting, setUseHandwriting] = useState(false);
  useEffect(() => () => { labelAbort.current?.abort(); stagedFile.current = null; }, []);
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<ExtractionDraft | null>(null);
  const [rawFieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [worksheetSettings, setWorksheetSettings] = useState<TicWorksheetSettings>(newTicWorksheetSettings);
  const worksheet = useMemo(() => {try{return calculateTicWorksheet(rawFieldValues,worksheetSettings);}catch(error){return {...calculateTicWorksheet(rawFieldValues),issues:[error instanceof Error?error.message:"Correct the worksheet settings."]};}},[rawFieldValues,worksheetSettings]);
  const fieldValues = worksheet.values;
  const [reviewState, setReviewState] = useState("");
  const [pageChoices, setPageChoices] = useState<PacketPageChoice[]>([]);
  const [stage, setStage] = useState<"organize" | "income" | "tic" | "ready">("organize");
  const [incomeDraft, setIncomeDraft] = useState<IncomeDraft | null>(null);
  const incomeResult = useMemo(() => {if(!incomeDraft||!draft?.incomePreparation)return null;try{return calculateIncomePreparation(incomeDraft,draft.incomePreparation.pages,true);}catch(error){return {version:'certification-income/1',annualIncome:null,rows:[],issues:[error instanceof Error?error.message:'Correct the worksheet inputs.'],status:'Pending full certification review' as const};}},[incomeDraft,draft]);
  const [viewTicPage, setViewTicPage] = useState(1);
  const [otherReviewAction, setOtherReviewAction] = useState<"" | "INITIAL" | "ANNUAL" | "INTERIM">("");
  const [tenantProfileId, setTenantProfileId] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveAction, setSaveAction] = useState<"save" | "review" | null>(null);
  const [message, setMessage] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Choose a certification to begin.");

  useEffect(() => {
    const url = draft?.sourcePreviewUrl;
    return () => { if (url?.startsWith("blob:")) URL.revokeObjectURL(url); };
  }, [draft?.sourcePreviewUrl]);

  const factsByField = useMemo(
    () => new Map((draft?.facts ?? []).map((fact) => [fact.field, fact])),
    [draft],
  );



  async function uploadCertification() {
    if (!file || busy || draft) return;
    setBusy(true);
    setMessage("");
    setProgressPercent(1);
    setProgressLabel("Starting secure certification intake…");
    setWorksheetSettings(newTicWorksheetSettings());

    let jobId: string | null = null;
    let storagePath: string | null = null;

    try {
      if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name} exceeds the 50 MB per-file limit.`);
      if (!isOcrSupportedFile(file)) throw new Error("Certification intake accepts PDF, PNG, JPEG, or WEBP files only.");

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) throw new Error("Please sign in before uploading a certification document.");
      const db = supabase as unknown as Db;

      setProgressPercent(5);
      setProgressLabel("Creating a temporary intake workspace…");
      const { data: job, error: jobError } = await db.from("certification_import_jobs").insert({
        user_id: user.id,
        created_by: user.id,
        status: "processing",
        source_name: file.name,
        total_files: 1,
        intake_type: "certification_documents",
      }).select("id").single();
      if (jobError) throw jobError;
      jobId = job.id;

      storagePath = `${user.id}/${job.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const pipelineStartedAt = performance.now();
      const preparationStartedAt = performance.now();
      let extractionDurationMs = 0;
      let uploadPercent = 0;
      let preparationPercent = 0;

      const updateConcurrentProgress = (label: string) => {
        setProgressPercent(clampPercent(8 + (uploadPercent * 0.35 + preparationPercent * 0.65) * 0.82));
        setProgressLabel(label);
      };

      const uploadPromise = uploadCertificationFile("certification-imports", storagePath, file, (uploadedBytes, total) => {
        uploadPercent = total ? (uploadedBytes / total) * 100 : 0;
        updateConcurrentProgress(`Staging ${file.name}: ${clampPercent(uploadPercent)}%…`);
      });

      const preparePromise = inspectCertificationPacket(file, (status, nextPreparationPercent) => {
        preparationPercent = clampPercent(nextPreparationPercent);
        updateConcurrentProgress(status);
      }).then((result) => {
        extractionDurationMs = performance.now() - preparationStartedAt;
        return result;
      });

      const [uploadOutcome, prepareOutcome] = await Promise.allSettled([uploadPromise, preparePromise]);
      if (uploadOutcome.status === "rejected") throw uploadOutcome.reason;
      if (prepareOutcome.status === "rejected") throw prepareOutcome.reason;
      const prepared = prepareOutcome.value;

      const source: DraftSource = {
        jobId: job.id,
        storagePath,
        originalFileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        sha256: prepared.sourceSha256,
        uploadDurationMs: Math.round(uploadOutcome.value.durationMs),
        extractionDurationMs: Math.round(extractionDurationMs),
        totalIntakeDurationMs: Math.round(performance.now() - pipelineStartedAt),
        uploadTransport: uploadOutcome.value.transport,
      };

      const inventory = packetInventory(prepared.pages);
      stagedFile.current = file;
      const sourcePreviewUrl = URL.createObjectURL(file);
      setFieldValues({});
      setPageChoices(initialPageChoices(inventory));
      setStage("organize");
      setOtherReviewAction("");
      setDraft({
        source, facts: [], missingFields: [], confidence: 0, extractionProvider: "pending",
        sourcePreviewUrl, supportingDocuments: [], pageClassifications: inventory,
        selectionDigest: null, ticPages: [], omittedPages: [], incomePreparation: null,
      });
      setFile(null);
      setProgressPercent(100);
      setProgressLabel("File uploaded — choose documents while page labels are identified.");
      setMessage("Select the TIC and supporting pages to include. Full extraction runs on included pages after you confirm the selection.");
      const abort = new AbortController();
      labelAbort.current = abort;
      setIdentifyingPages(true);
      labelTask.current = identifyCertificationPageLabels(file, prepared, page => {
        const identified = packetInventory([page])[0];
        if (!identified || abort.signal.aborted) return;
        setDraft(current => current?.source.sha256 === source.sha256 ? {...current, pageClassifications: current.pageClassifications.map(p => p.page === page.page ? identified : p)} : current);
        if (identified.kind === "tic") setPageChoices(current => current.map(c => c.page === page.page && c.role === "pending" ? {...c, role: "tic_page"} : c));
      }, abort.signal).catch(() => undefined).finally(() => {
        if (labelAbort.current === abort) setIdentifyingPages(false);
      });
    } catch (error) {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (storagePath) {
        await supabase.storage.from("certification-imports").remove([storagePath, sidecarPathFor(storagePath)]).catch(() => undefined);
      }
      if (jobId && userId) {
        const db = supabase as unknown as Db;
        await db.from("certification_import_jobs").delete().eq("id", jobId).eq("user_id", userId);
      }
      setProgressLabel("Certification preparation stopped before staging.");
      setMessage(error instanceof Error ? error.message : "The certification document could not be prepared for review.");
    } finally {
      setBusy(false);
    }
  }

  function changePageChoices(choices: PacketPageChoice[]) {
    setPageChoices(choices);
    setIncomeDraft(null);
    setFieldValues({});
    setOtherReviewAction("");
    setDraft(current => current ? { ...current, facts: [], selectionDigest: null, ticPages: [], supportingDocuments: [], incomePreparation: null } : null);
  }

  async function extractSelectedPages() {
    if (!draft || busy) return;
    setBusy(true);
    setMessage("");
    try {
      validatePageChoices(pageChoices, draft.pageClassifications.length, true);
      const localFile = stagedFile.current;
      if (!localFile) throw new Error("The original packet is no longer available in this tab. Reopen the upload before extracting.");
      labelAbort.current?.abort();
      await labelTask.current;
      setIdentifyingPages(false);
      const startedAt = performance.now();
      const prepared = await prepareCertificationForReview(localFile, (status, percent) => {
        setProgressLabel(status); setProgressPercent(percent);
      }, {pageNumbers: pageChoices.filter(choice => choice.role !== "omit").map(choice => choice.page), ...(useHandwriting ? {visualTicPages: pageChoices.filter(choice => choice.role === "tic_page").map(choice => choice.page), readVisualTicPage: handwritingReader(draft.source, setProgressLabel)} : {})});
      if (prepared.sourceSha256 !== draft.source.sha256) throw new Error("The local file no longer matches this staged packet.");
      setProgressLabel("Saving selected-page extraction…");
      const sidecarBytes = new Blob([JSON.stringify(prepared.sidecar)], {type: OCR_SIDECAR_STORAGE_MIME});
      const {error: sidecarError} = await supabase.storage.from("certification-imports").upload(sidecarPathFor(draft.source.storagePath), sidecarBytes, {upsert: true, contentType: OCR_SIDECAR_STORAGE_MIME});
      if (sidecarError) throw sidecarError;
      const source = {...draft.source, extractionDurationMs: Math.round(performance.now() - startedAt), totalIntakeDurationMs: draft.source.totalIntakeDurationMs + Math.round(performance.now() - startedAt)};
      const preview = await extractPreview({ data: { source, pageSelections: pageChoices } });
      if ("error" in preview) throw new Error(preview.error || "The selected TIC pages could not be extracted.");
      const facts = preview.facts as PreviewFact[];
      const extracted = new Map(facts.map(fact => [fact.field, fieldText(fact.value)]));
      setFieldValues(Object.fromEntries(TIC_FIELD_DEFINITIONS.map(definition => [definition.key, extracted.get(definition.key) ?? ""])));
      setDraft({ ...draft, source, facts, missingFields: [...preview.missingFields], confidence: preview.confidence, extractionProvider: preview.extractionProvider,
        sourcePreviewUrl: preview.sourcePreviewUrl, supportingDocuments: preview.supportingDocuments, pageClassifications: preview.pageClassifications.map(page => page.excerpt ? page : draft.pageClassifications.find(previous => previous.page === page.page) ?? page),
        selectionDigest: preview.selectionDigest, ticPages: [...preview.ticPages], omittedPages: [...preview.omittedPages], incomePreparation: preview.incomePreparation });
      setPageChoices(preview.pageSelections);
      setViewTicPage(preview.ticPages[0] ?? 1);
      if (!preview.incomePreparation) throw new Error("The selected income evidence could not be prepared.");
      setIncomeDraft(preview.incomePreparation.draft);
      setWorksheetSettings({...newTicWorksheetSettings(),passbookRatePercent:extracted.get("worksheet_passbook_rate_percent")||""});
      setStage("tic");
      setProgressPercent(100);
      setProgressLabel("TIC ready. Check its fields, then continue to the Income Calculator.");
      setMessage("Check the extracted TIC fields first. Selected supporting pages will populate the Income Calculator next.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Selected-page extraction failed.");
    } finally { setBusy(false); }
  }

  async function confirmAndSave(startReview: boolean) {
    if (!draft || busy) return;
    if (!incomeDraft || !incomeResult || incomeResult.annualIncome === null || incomeResult.issues.length) { setMessage("Complete the Income Calculator before saving or starting review."); setStage("income"); return; }
    if (startReview && ticCompletenessFindings(fieldValues).length) { setMessage("Complete the yellow findings before starting another review. You can still save your changes."); return; }
    if (stage !== "ready" || !draft.selectionDigest) { setMessage("Confirm document selection and rebuild the TIC before saving."); return; }

    setBusy(true);
    setSaveAction(startReview ? "review" : "save");
    setMessage("");
    setProgressPercent(98);
    setProgressLabel(startReview ? "Saving TIC and supporting documents, then starting review…" : "Saving TIC and supporting documents…");
    try {
      const result = await confirmPreview({
        data: {
          source: draft.source,
          tenantProfileId: tenantProfileId || null,
          ...(reviewState ? {standaloneJurisdiction:reviewState} : {}),
          worksheetSettings,
          sourceTicFields: rawFieldValues,
          fields: TIC_FIELD_DEFINITIONS.map((definition) => ({
            field: definition.key,
            value: fieldValues[definition.key] ?? "",
          })),
          pageSelections: pageChoices,
          selectionDigest: draft.selectionDigest,
          ...(otherReviewAction ? { otherReviewAction } : {}),
          startReview,
          incomeDraft,
        },
      });
      const changes = result.correctionCount + result.reviewerSuppliedCount;
      const changeText = changes
        ? ` ${result.correctionCount} OCR correction${result.correctionCount === 1 ? "" : "s"} and ${result.reviewerSuppliedCount} previously missed TIC field${result.reviewerSuppliedCount === 1 ? "" : "s"} were recorded.`
        : " No TIC field changes were needed.";
      const supportText = ` ${result.supportingDocumentCount} selected supporting page(s) preserved; ${result.omittedPageCount} page(s) omitted from review and retained only in the original packet.`;
      labelAbort.current?.abort();
      stagedFile.current = null;
      setIdentifyingPages(false);
      setDraft(null);
      setIncomeDraft(null);
      setFieldValues({});
      setPageChoices([]);
      setStage("organize");
      setOtherReviewAction("");
      setTenantProfileId("");
      setProgressPercent(100);
      if (result.queuedForReview) {
        setProgressLabel("Certification packet saved and queued for review.");
        setMessage(`Certification saved.${changeText}${supportText} It is now in the Compliance Review Queue.`);
      } else {
        setProgressLabel("Certification packet saved.");
        setMessage(`Certification saved${tenantProfileId ? " to the tenant file" : " as a standalone review"}.${changeText}${supportText} It has not been queued for compliance review.`);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["certification-items"] }),
        queryClient.invalidateQueries({ queryKey: ["certification-review"] }),
        queryClient.invalidateQueries({ queryKey: ["certification-supporting-documents"] }),
      ]);
      if (result.queuedForReview) {
        await navigate({ to: "/files", search: { item: result.itemId } });
      }
    } catch (error) {
      setProgressPercent(100);
      setProgressLabel("TIC review is still open — document not saved.");
      setMessage(error instanceof Error ? error.message : "The confirmed certification packet could not be saved.");
    } finally {
      setBusy(false);
      setSaveAction(null);
    }
  }

  async function cancelStagedUpload() {
    if (!draft || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await cancelPreview({ data: { source: draft.source } });
      labelAbort.current?.abort();
      stagedFile.current = null;
      setIdentifyingPages(false);
      setDraft(null);
      setIncomeDraft(null);
      setFieldValues({});
      setPageChoices([]);
      setStage("organize");
      setOtherReviewAction("");
      setTenantProfileId("");
      setProgressPercent(0);
      setProgressLabel("Choose a certification to begin.");
      setMessage("Staged upload cancelled. No certification or supporting document was saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The staged upload could not be cancelled.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <FileUp className="mt-0.5 size-5 text-primary" />
        <div>
          <h2 className="font-semibold">Certification document intake</h2>
          <p className="mt-1 max-w-5xl text-sm text-muted-foreground">
            Upload the full Tenant Income Certification packet. First choose the TIC pages and which supporting documents to include or omit. Check the extracted TIC first. Next, calculate annual income from selected paystubs, bank statements and other income before starting the full certification review.
          </p>
        </div>
      </div>

      {!draft ? (
        <>
          <label className="mt-5 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center hover:bg-muted/30">
            <UploadCloud className="size-8 text-muted-foreground" />
            <span className="mt-3 font-medium">Choose certification packet</span>
            <span className="mt-1 text-xs text-muted-foreground">PDF, PNG, JPEG, or WEBP · up to 50 scanned pages · 50 MB</span>
            <span className="mt-2 text-xs font-medium text-foreground">{file?.name ?? "No certification selected"}</span>
            <input
              className="sr-only"
              type="file"
              accept={ACCEPTED_DOCUMENT_TYPES}
              disabled={busy}
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
                setMessage("");
                setProgressPercent(0);
                setProgressLabel(selected ? "Ready to extract selected certification packet." : "Choose a certification to begin.");
              }}
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3 text-sm">
            <span>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB selected` : "One certification packet per upload"}</span>
            <button type="button" disabled={!file || busy} onClick={() => void uploadCertification()} className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">
              {busy ? "Identifying documents…" : "Upload & identify documents"}
            </button>
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{stage === "organize" ? "1. Organize the uploaded packet" : stage === "income" ? "3. Income Calculator" : stage === "ready" ? "4. Ready for full certification review" : "2. Check extracted TIC fields"}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{draft.source.originalFileName} is temporarily staged only. Nothing appears in Documents or the Compliance Review Queue until you confirm it.</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>{draft.pageClassifications.length} original packet pages</div>
              {stage === "tic" && <div className="mt-1">{draft.facts.length} proposed fields · confirm cell accuracy, not just OCR confidence</div>}
            </div>
          </div>

          {stage === "organize" ? (
            <><label className="mb-3 flex items-start gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" className="mt-1" checked={useHandwriting} disabled={busy} onChange={event => setUseHandwriting(event.target.checked)} /><span><strong>Handwritten or mixed TIC</strong><span className="mt-1 block text-muted-foreground">Read handwriting on the TIC pages with AI. Check proposed values against the source before continuing; unclear cells remain for confirmation.</span></span></label><TicPacketOrganizer inventory={draft.pageClassifications} choices={pageChoices} sourceUrl={draft.sourcePreviewUrl} isPdf={isPdfSource(draft.source)} busy={busy} identifying={identifyingPages} onChange={changePageChoices} onConfirm={() => void extractSelectedPages()} /></>
          ) : stage === "income" && incomeDraft && draft.incomePreparation ? (
            <CertificationIncomeCalculator value={incomeDraft} pages={draft.incomePreparation.pages} sourceUrl={draft.sourcePreviewUrl} busy={busy} onChange={next=>{setIncomeDraft(next);if(next.ticWorksheet)setWorksheetSettings(next.ticWorksheet.settings);}} onBack={() => setStage("tic")} onContinue={() => {
              if (!incomeResult || incomeResult.annualIncome === null || incomeResult.issues.length) return;
              setFieldValues(current => ({ ...current, certification_effective_date: incomeDraft.effectiveDate }));
              setStage("ready"); setMessage("Calculated income has been added. The certification is ready to save for full review.");
            }} />
          ) : stage === "ready" ? (
            <div className="mt-4 space-y-3 rounded-xl border bg-background p-4"><h3 className="font-semibold">TIC and income calculation prepared</h3><p>Calculated projected annual income: <strong>${incomeResult?.annualIncome ?? "Needs recalculation"}</strong></p><p className="text-sm">Source TIC annual income: {rawFieldValues["household_annual_income"] || "Not extracted"}. Differences will be flagged during full review.</p><p className="text-sm">{draft.supportingDocuments.length} supporting page(s) included. Income sources and calculation details will be saved with this certification.</p><div className="flex gap-4 text-sm"><button type="button" disabled={busy} className="underline" onClick={() => { setIncomeDraft(current => current ? { ...current, confirmed: false } : null); setStage("tic"); }}>Edit TIC</button><button type="button" disabled={busy} className="underline" onClick={() => setStage("income")}>Edit income calculation</button></div></div>
          ) : <>
          <div className="mt-4 rounded border bg-background p-3 text-sm">
            <strong>TIC pages: {draft.ticPages.join(", ")}</strong> · {draft.supportingDocuments.length} included supporting page(s) · omitted pages: {draft.omittedPages.join(", ") || "None"}.
            <button type="button" disabled={busy} className="ml-3 underline" onClick={() => setStage("organize")}>Change document selection</button>
            <p className="mt-1 text-xs text-muted-foreground">Changing page roles clears unsaved field corrections and requires a fresh extraction. The original file is not altered.</p>
          </div>
          <div className="mt-4 rounded-xl border bg-background p-4">
            <label className="text-sm font-semibold" htmlFor="tenant-destination">Certification destination (optional)</label>
            <p className="mt-1 text-xs text-muted-foreground">Review any certification on its own, or optionally link it to an existing tenant file.</p>
            <select id="tenant-destination" className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm" value={tenantProfileId} disabled={busy || tenantDestinations.isLoading} onChange={(event) => setTenantProfileId(event.target.value)}>
              <option value="">Standalone certification — no property CSV required</option>
              {(tenantDestinations.data ?? []).map((tenant) => (
                <option key={tenant.id} value={tenant.id}>{tenant.householdName}{tenant.propertyName ? ` · ${tenant.propertyName}` : ""}{tenant.unitNumber ? ` · Unit ${tenant.unitNumber}` : ""}</option>
              ))}
            </select>
            {tenantDestinations.data?.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">Your certification will be saved on its own. Property and tenant onboarding can be completed later.</p> : null}
          </div>

          {incomeResult && <div className="mt-4 rounded-xl border bg-background p-4 text-sm"><strong>Calculated projected annual income: ${incomeResult.annualIncome ?? "Needs recalculation"}</strong><p className="mt-1">Source TIC annual income: {rawFieldValues["household_annual_income"] || "Not extracted"}. The calculated amount accompanies the source TIC for program-specific review.</p><button type="button" className="mt-2 underline" disabled={busy} onClick={() => setStage("income")}>Return to Income Calculator</button></div>}
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-xl border bg-background p-3 min-w-0 lg:sticky lg:top-4 lg:self-start">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium"><FileSearch className="size-4" /> Selected TIC source</div>
              <div className="mb-2 flex flex-wrap gap-2">{draft.ticPages.map(page => <button type="button" key={page} disabled={busy} aria-pressed={viewTicPage === page} className="rounded border px-2 py-1 text-xs" onClick={() => setViewTicPage(page)}>TIC page {page}</button>)}</div>
              {draft.sourcePreviewUrl ? (
                isPdfSource(draft.source) ? (
                  <iframe key={viewTicPage} title={`Source certification page ${viewTicPage}`} src={sourcePageUrl(draft.sourcePreviewUrl, draft.source, viewTicPage) ?? undefined} className="h-[78vh] min-h-[720px] w-full rounded-lg border bg-white" />
                ) : (
                  <div className="max-h-[78vh] overflow-auto rounded-lg border bg-white p-2"><img src={draft.sourcePreviewUrl} alt="Staged certification source" className="mx-auto max-w-full" /></div>
                )
              ) : <p className="rounded-lg border p-4 text-sm text-muted-foreground">Source preview is temporarily unavailable. The packet remains staged and unsaved.</p>}
            </div>

            <div className="min-w-0 max-h-[84vh] overflow-auto pr-1">
              <div className="mb-3 rounded-lg border bg-background p-3 text-sm">
                <strong>CertivoIQ TIC Review Form.</strong> Values are placed into the same logical sections and tables as the source TIC. A blank source field stays blank rather than inheriting nearby labels.
              </div>
              <TicIncomeWorksheet worksheet={worksheet} settings={worksheetSettings} busy={busy} onSettings={setWorksheetSettings} />
              {!tenantProfileId && <label className="mb-3 block text-sm">Certification state (for program rules)<input aria-label="Certification state" maxLength={2} className="ml-2 w-20 rounded border bg-background p-2" value={reviewState} disabled={busy} onChange={e=>setReviewState(e.target.value.toUpperCase().replace(/[^A-Z]/g,''))}/></label>}
              <CertivoIqTicReviewForm
                values={fieldValues}
                factsByField={factsByField}
                calculatedFields={worksheet.formulas}
                busy={busy}
                onChange={(field, value) => { setFieldValues((current) => ({ ...current, [field]: value })); if (field === "certification_effective_date" && incomeDraft) setIncomeDraft({ ...incomeDraft, effectiveDate: value, confirmed: false }); }}
              />
            </div>
          </div>

          <div className="mt-4 rounded-xl border bg-background p-4">
            <h4 className="text-sm font-semibold">Included supporting documents</h4>
            <p className="mt-1 text-xs text-muted-foreground">Only these selected pages are included beneath the TIC. Source contents are preserved read-only.</p>
            {draft.supportingDocuments.map(document => <p className="mt-2 text-sm" key={document.id}>{document.label} · original page {document.pageStart} {draft.sourcePreviewUrl && <a className="underline" href={sourcePageUrl(draft.sourcePreviewUrl, draft.source, document.pageStart) ?? undefined} target="_blank" rel="noreferrer">Open source page</a>}</p>)}
            {!draft.supportingDocuments.length && <p className="mt-2 text-sm">No supporting documents selected. Required-evidence checks still apply.</p>}
          </div>
          {(fieldValues["certification_type"] ?? "").toLowerCase() === "other" && <label className="mt-4 block text-sm">Review action for Other certification
            <select className="ml-2 rounded border bg-background p-2" value={otherReviewAction} disabled={busy} onChange={e => setOtherReviewAction(e.target.value as typeof otherReviewAction)}><option value="">Select before starting review</option><option value="INITIAL">Initial</option><option value="ANNUAL">Annual recertification</option><option value="INTERIM">Interim</option></select>
          </label>}
          </>}

          {stage === "tic" && <div className="mt-4 flex justify-end"><button type="button" disabled={busy || !draft.selectionDigest} className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50" onClick={() => { setIncomeDraft(current => current ? { ...current, effectiveDate: fieldValues["certification_effective_date"] || current.effectiveDate, confirmed: false } : null); setIncomeDraft(current => current ? {...current,basis:current.rows.length?'EVIDENCE':'TIC',ticWorksheet:{values:rawFieldValues,settings:worksheetSettings},confirmed:false} : null); setStage("income"); }}>Continue to Income Calculator</button></div>}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" disabled={busy} onClick={() => void cancelStagedUpload()} className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50">Cancel Upload</button>
            <button type="button" disabled={busy || stage !== "ready" || !draft.selectionDigest || incomeResult?.annualIncome == null} onClick={() => void confirmAndSave(false)} className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50">{saveAction === "save" ? "Saving…" : "Save Document"}</button>
            <button type="button" disabled={busy || stage !== "ready" || !draft.selectionDigest || incomeResult?.annualIncome == null || ticCompletenessFindings(fieldValues).length > 0} onClick={() => void confirmAndSave(true)} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{saveAction === "review" ? "Saving & queuing…" : "Save & Start Review"}</button>
          </div>
        </div>
      )}

      {reviewAccess.data?.mode==="trial" && <p className="mt-3 text-sm">{reviewAccess.data.remaining} of 3 free certification reviews remaining. Uploading, calculating, and adjusting the passbook rate do not use a review.</p>}
      <div className="mt-3 rounded-lg border bg-background p-3" aria-live="polite">
        <div className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-muted-foreground">{progressLabel}</span><span className="font-semibold tabular-nums text-foreground">{progressPercent}%</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Certification intake progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}><div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${progressPercent}%` }} /></div>
      </div>
      {message ? <p className="mt-3 rounded-lg border bg-background p-3 text-sm" role="status">{message}</p> : null}
    </section>
  );
}


