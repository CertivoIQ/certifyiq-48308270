import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { CheckCircle2, LockKeyhole, Send } from 'lucide-react';
import { canSubmitCertification, createSubmissionRequest } from '@/lib/compliance-intelligence.mjs';

export const Route = createFileRoute('/_authenticated/submission-center')({ component: SubmissionCenterPage });

function SubmissionCenterPage() {
  const [approved, setApproved] = useState(false);
  const [message, setMessage] = useState('');
  const canSubmit = canSubmitCertification({ status: approved ? 'approved' : 'draft', approvedBy: approved ? 'current-reviewer' : null, approvedAt: approved ? new Date().toISOString() : null });
  function prepareSubmission() {
    try {
      const request = createSubmissionRequest({ status: 'approved', authorityName: 'Selected Housing Authority', approvedBy: 'current-reviewer', approvedAt: new Date().toISOString(), deliveryMethod: 'manual' });
      setMessage(`Submission package ${request.status}. Human approval recorded; delivery remains a controlled step.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Submission could not be prepared.');
    }
  }
  return <main className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
    <header className="rounded-2xl border bg-card p-6"><div className="flex items-center gap-2 text-sm font-medium text-primary"><Send className="h-4 w-4" /> Certification Submission Center™</div><h1 className="mt-2 text-3xl font-semibold">Submit only after human approval.</h1><p className="mt-2 text-muted-foreground">CertivoIQ prepares the submission package and preserves an auditable approval trail. Automated processing cannot bypass the human approval gate.</p></header>
    <section className="rounded-2xl border bg-card p-6"><div className="flex items-center gap-3"><LockKeyhole className="h-5 w-5 text-primary" /><div><h2 className="font-semibold">Compliance Approval Center™</h2><p className="text-sm text-muted-foreground">Review the certification before it can move to an authority submission state.</p></div></div><label className="mt-6 flex items-center gap-3 rounded-lg border p-4"><input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} /><span>I have completed the human final approval.</span></label><button disabled={!canSubmit} onClick={prepareSubmission} className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Prepare submission package</button>{message && <p className="mt-4 text-sm text-muted-foreground" role="status">{message}</p>}</section>
  </main>;
}
