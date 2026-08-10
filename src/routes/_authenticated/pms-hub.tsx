import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { CheckCircle2, Plug, RefreshCw } from 'lucide-react';
import { PMS_PROVIDERS } from '@/lib/compliance-intelligence.mjs';

export const Route = createFileRoute('/_authenticated/pms-hub')({ component: PmsHubPage });

function PmsHubPage() {
  const [selected, setSelected] = useState('Yardi');
  const [message, setMessage] = useState('');
  function startConnection() { setMessage(`${selected} connection setup started. Credentials will be stored outside the application database.`); }
  return <main className="mx-auto max-w-6xl space-y-6 p-6 md:p-10">
    <header className="rounded-2xl border bg-card p-6"><div className="flex items-center gap-2 text-sm font-medium text-primary"><Plug className="h-4 w-4" /> PMS Integration Hub™</div><h1 className="mt-2 text-3xl font-semibold">Connect property-management data once.</h1><p className="mt-2 text-muted-foreground">CertivoIQ normalizes PMS records into the Compliance Data Hub™ so the compliance engine is provider-agnostic.</p></header>
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{PMS_PROVIDERS.map((provider) => <button key={provider} onClick={() => setSelected(provider)} className={`rounded-xl border bg-card p-5 text-left ${selected === provider ? 'ring-2 ring-primary' : ''}`}><div className="flex items-center justify-between"><span className="font-semibold">{provider}</span>{selected === provider && <CheckCircle2 className="h-5 w-5 text-primary" />}</div><p className="mt-2 text-sm text-muted-foreground">Connection contract ready; provider credentials and API scope are required before activation.</p></button>)}</section>
    <section className="rounded-2xl border bg-card p-6"><h2 className="font-semibold">Selected provider: {selected}</h2><p className="mt-2 text-sm text-muted-foreground">Sync health, reconciliation, cursors, and failures will be tracked without storing provider secrets in application tables.</p><button onClick={startConnection} className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"><RefreshCw className="h-4 w-4" /> Begin connection setup</button>{message && <p className="mt-3 text-sm text-muted-foreground" role="status">{message}</p>}</section>
  </main>;
}
