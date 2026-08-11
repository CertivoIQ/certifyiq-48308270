import { useMemo, useState } from 'react';
import { Archive, Building2, ClipboardCheck, FileCheck2, Gauge, History, Plug, Send, ShieldCheck, UploadCloud } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FEATURE_NAMES } from '@/lib/compliance-intelligence.mjs';
import { CertificationReviewPanel } from '@/components/certification-review-panel';
import { FreeReviewLeadGate } from '@/components/FreeReviewLeadGate';

/**
 * Narrow view of the Supabase client for the import tables, which are written
 * with loosely-shaped rows and are not part of the generated table types.
 */
type ImportRow = Record<string, string | number | null>;
interface SupabaseLike {
  from(table: string): {
    insert(row: ImportRow): {
      select(columns: string): { single(): Promise<{ data: { id: string } | null; error: Error | null }> };
      then: Promise<{ error: Error | null }>['then'];
    } & Promise<{ error: Error | null }>;
  };
}

const features: Array<{ name: string; description: string; icon: LucideIcon }> = [
  { name: FEATURE_NAMES.massReview, description: 'Upload certification files in bulk for classification, duplicate detection, historical comparison, and findings review.', icon: UploadCloud },
  { name: FEATURE_NAMES.auditSimulator, description: 'Run evidence-backed federal or state audit simulations before a real reviewer arrives.', icon: ClipboardCheck },
  { name: FEATURE_NAMES.portfolioCommandCenter, description: 'See property-by-property readiness, risk, findings, and open corrective actions.', icon: Building2 },
  { name: FEATURE_NAMES.submissionCenter, description: 'Prepare authority submission packages after mandatory human approval.', icon: Send },
  { name: FEATURE_NAMES.pmsHub, description: 'Connect normalized property and certification data from supported PMS providers.', icon: Plug },
  { name: FEATURE_NAMES.evidenceIntelligence, description: 'Keep findings tied to the evidence that supports the compliance decision.', icon: FileCheck2 },
];

const summaryCards: Array<{ label: string; icon: LucideIcon }> = [
  { label: 'Certification History Intelligence™', icon: History },
  { label: 'Audit Readiness Score™', icon: Gauge },
  { label: 'Compliance Approval Center™', icon: ShieldCheck },
];

export function ComplianceIntelligenceSuite() {
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const totalBytes = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  async function queueImport() {
    if (!files.length || uploading) return;
    setUploading(true);
    setMessage('Preparing your Mass Certification Review…');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in before importing certifications.');
      const userId = user.id;
      const db = supabase as unknown as SupabaseLike;
      const { data: job, error } = await db.from('certification_import_jobs').insert({
        user_id: userId,
        created_by: userId,
        source_name: files.length === 1 ? (files[0]?.name ?? 'certification file') : `${files.length} certification files`,
        total_files: files.length,
      }).select('id').single();
      if (error) throw error;
      if (!job) throw new Error('The certification import could not be created.');
      for (const file of files) {
        const path = `${userId}/${job.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: uploadError } = await supabase.storage.from('certification-imports').upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;
        const { error: itemError } = await db.from('certification_import_items').insert({
          job_id: job.id,
          user_id: userId,
          storage_path: path,
          original_file_name: file.name,
          mime_type: file.type || 'application/octet-stream',
          size_bytes: file.size,
        });
        if (itemError) throw itemError;
      }
      setFiles([]);
      setMessage(`Queued ${files.length} file${files.length === 1 ? '' : 's'} for Mass Certification Review.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The certification import could not be queued.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 p-6 md:p-10">
      <section className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary"><ShieldCheck className="h-4 w-4" /> CertivoIQ Compliance Intelligence Platform</div>
            <h1 className="text-3xl font-semibold tracking-tight">Compliance Intelligence Suite</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">Move from reactive file review to continuous audit readiness with Certification Intelligence™, Audit Simulator™, and portfolio-level compliance visibility.</p>
          </div>
          <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm"><div className="font-medium">Audit Readiness Score™</div><div className="mt-1 text-muted-foreground">Calculated from findings and evidence coverage.</div></div>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {features.map(({ name, description, icon: Icon }) => <article key={name} className="rounded-2xl border bg-card p-5 shadow-sm"><Icon className="mb-4 h-6 w-6 text-primary" /><h2 className="font-semibold">{name}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></article>)}
      </section>
      <FreeReviewLeadGate>
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3"><Archive className="h-5 w-5 text-primary" /><div><h2 className="font-semibold">Mass Certification Review™</h2><p className="text-sm text-muted-foreground">Bulk upload historical certifications for secure, tenant-scoped processing.</p></div></div>
          <label className="mt-6 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center hover:bg-muted/30"><UploadCloud className="h-8 w-8 text-muted-foreground" /><span className="mt-3 font-medium">Choose certification files</span><span className="mt-1 text-sm text-muted-foreground">PDF, PNG, JPEG, WEBP, or ZIP • up to 50 MB each</span><input className="sr-only" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.zip" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /></label>
          {files.length > 0 && <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/40 p-3 text-sm"><span>{files.length} file{files.length === 1 ? '' : 's'} selected • {(totalBytes / 1024 / 1024).toFixed(1)} MB</span><button className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50" disabled={uploading} onClick={queueImport}>{uploading ? 'Queueing…' : 'Start Review'}</button></div>}
          {message && <p className="mt-3 text-sm text-muted-foreground" role="status">{message}</p>}
        </section>
        <CertificationReviewPanel />
      </FreeReviewLeadGate>
      <section className="grid gap-4 md:grid-cols-3">
        {summaryCards.map(({ label, icon: Icon }) => <div key={label} className="rounded-2xl border bg-card p-5"><Icon className="mb-3 h-5 w-5 text-primary" /><div className="font-medium">{label}</div><p className="mt-1 text-sm text-muted-foreground">Built into the compliance workflow and preserved with the audit trail.</p></div>)}
      </section>
    </main>
  );
}
