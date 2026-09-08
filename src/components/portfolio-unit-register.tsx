import { Fragment, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { assignPortfolioUnitTenant, listPortfolioUnitHistory, listPortfolioUnits } from "@/lib/portfolio-unit-tenants.functions";

function UnitHistory({ unitId }: { unitId: string }) {
  const listHistory = useServerFn(listPortfolioUnitHistory);
  const history = useQuery({ queryKey: ["portfolio-unit-history", unitId], queryFn: () => listHistory({ data: { unitId } }) });
  if (history.isPending) return <p role="status">Loading tenant history…</p>;
  if (history.error) return <p role="alert">Tenant history could not be loaded. <button type="button" className="underline" onClick={() => void history.refetch()}>Retry</button></p>;
  return <div><h4 className="font-medium">Tenant history</h4><p className="mt-1 text-xs text-muted-foreground">Latest 100 events. Records created before history tracking began are shown in the unit record above.</p>
    {history.data.length ? <ol className="mt-2 space-y-2">{history.data.map((event) => {
      const record = event.after_record ?? event.before_record;
      return <li key={event.id} className="rounded border bg-background p-3">
        <div className="font-medium">{String(record?.["household_name"] ?? "Tenant")} · {event.event_type}</div>
        <div>Tenant reference: {String(record?.["external_id"] ?? event.tenant_profile_id)}</div>
        <div>Move-in date: {String(record?.["move_in_date"] ?? "Not supplied")}</div>
        <div className="text-xs text-muted-foreground"><time dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleString()}</time> · Recorded by {event.actor_id ?? "system"}</div>
        {event.before_record && event.after_record ? <details className="mt-2"><summary className="cursor-pointer">Changed details</summary><ul>{Object.keys(event.after_record).filter((key) => key !== "updated_at" && key !== "source_data" && JSON.stringify(event.before_record?.[key]) !== JSON.stringify(event.after_record?.[key])).map((key) => <li key={key}>{key.replaceAll("_", " ")}: {String(event.before_record?.[key] ?? "Not supplied")} → {String(event.after_record?.[key] ?? "Not supplied")}</li>)}</ul></details> : null}
      </li>;
    })}</ol> : <p className="mt-2 text-muted-foreground">No tenant history recorded yet.</p>}
  </div>;
}

function AddTenant({ unitId, unitNumber, onSaved, onCancel }: { unitId: string; unitNumber: string; onSaved: () => void; onCancel: () => void }) {
  const assign = useServerFn(assignPortfolioUnitTenant);
  const [requestId] = useState(() => crypto.randomUUID());
  const [reference, setReference] = useState(() => `MANUAL-${requestId}`);
  const [name, setName] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <form className="space-y-3 rounded-lg border bg-background p-4" onSubmit={async (event) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try { await assign({ data: { unitId, requestId, tenantReference: reference, householdName: name, moveInDate } }); onSaved(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "The tenant could not be saved. Retry with the same details."); }
    finally { setBusy(false); }
  }}>
    <h4 className="font-semibold">Add tenant to unit {unitNumber}</h4>
    <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
      <label className="block">Household / primary tenant name<input required maxLength={240} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 block w-full rounded border bg-background p-2" /></label>
      <label className="block">Move-in date<input required type="date" max={new Date().toISOString().slice(0, 10)} value={moveInDate} onChange={(event) => setMoveInDate(event.target.value)} className="mt-1 block w-full rounded border bg-background p-2" /></label>
      <label className="block sm:col-span-2">Tenant reference<input required maxLength={160} value={reference} onChange={(event) => setReference(event.target.value)} className="mt-1 block w-full rounded border bg-background p-2" /><span className="mt-1 block text-xs text-muted-foreground">Keep this reference in future CSV uploads to update this tenant.</span></label>
    </fieldset>
    <p className="text-xs text-muted-foreground">Saving creates a tenant record and audit entry under this unit. Upload certification documents separately.</p>
    {error ? <p role="alert" className="text-destructive">{error}</p> : null}
    <div className="flex gap-2"><button type="submit" disabled={busy} className="rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">{busy ? "Saving…" : "Save tenant"}</button><button type="button" disabled={busy} onClick={onCancel} className="rounded border px-3 py-2">Cancel</button></div>
  </form>;
}

export function PortfolioUnitRegister({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const listUnits = useServerFn(listPortfolioUnits);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [adding, setAdding] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const result = useQuery({ queryKey: ["portfolio-units", propertyId, page], queryFn: () => listUnits({ data: { propertyId, page } }) });
  return <section className="mt-4 rounded-lg border p-4" aria-label={`Units at ${propertyName}`}>
    <h3 className="font-semibold">{propertyName} · Units & tenants</h3>
    <p className="mt-1 text-sm text-muted-foreground">Vacant units have no tenant profile. Add a tenant when they move in, then expand the unit to review the record and audit history.</p>
    {message ? <p role="status" className="mt-2">{message}</p> : null}
    {result.isPending ? <p role="status" className="mt-3">Loading units…</p> : result.error ? <p role="alert" className="mt-3">Units could not be loaded. <button type="button" className="underline" onClick={() => void result.refetch()}>Retry</button></p> : <>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Unit</th><th className="p-2">Bedrooms</th><th className="p-2">Occupancy</th><th className="p-2">Tenant</th><th className="p-2">Actions</th></tr></thead><tbody>
        {result.data.units.map((unit) => <Fragment key={unit.id}><tr className="border-b">
          <th scope="row" className="p-2">{unit.unit_number}</th><td className="p-2">{unit.bedrooms ?? "Not supplied"}</td><td className="p-2">{unit.tenants.length ? "Occupied" : "Vacant"}</td><td className="p-2">{unit.tenants.map((tenant) => tenant.household_name).join(", ") || "No tenant assigned"}</td>
          <td className="p-2"><div className="flex flex-wrap gap-2">{!unit.tenants.length ? <button type="button" className="rounded border px-2 py-1" disabled={adding !== null} onClick={() => { setAdding(unit.id); setExpanded(unit.id); setMessage(""); }} aria-label={`Add tenant to unit ${unit.unit_number}`}>Add tenant</button> : null}<button type="button" className="rounded border px-2 py-1" disabled={adding !== null} aria-expanded={expanded === unit.id} onClick={() => setExpanded(expanded === unit.id ? null : unit.id)}>Record & history</button></div></td>
        </tr>{expanded === unit.id ? <tr><td colSpan={5} className="bg-muted/30 p-4">
          {adding === unit.id ? <AddTenant unitId={unit.id} unitNumber={unit.unit_number} onCancel={() => setAdding(null)} onSaved={() => {
            setAdding(null); setMessage(`Tenant saved to unit ${unit.unit_number}.`);
            void Promise.all([queryClient.invalidateQueries({ queryKey: ["portfolio-units", propertyId] }), queryClient.invalidateQueries({ queryKey: ["portfolio-unit-history", unit.id] }), queryClient.invalidateQueries({ queryKey: ["portfolio-intake-summary"] })]).catch(() => setMessage("Tenant saved. Refresh to reload the unit record."));
          }} /> : null}
          {unit.tenants.map((tenant) => <div key={tenant.id} className="mb-3 rounded border bg-background p-3"><h4 className="font-semibold">{tenant.household_name}</h4><p>Tenant reference: {tenant.external_id}</p><p>Move-in date: {tenant.move_in_date ?? "Not supplied"}</p><p className="text-xs text-muted-foreground">Created {new Date(tenant.created_at).toLocaleString()}</p></div>)}
          <div className="mt-3"><UnitHistory unitId={unit.id} /></div>
        </td></tr> : null}</Fragment>)}
      </tbody></table></div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm"><span>{result.data.total} units · Page {page + 1} of {Math.max(1, Math.ceil(result.data.total / 50))}</span><div className="flex gap-2"><button type="button" disabled={page === 0 || adding !== null} className="rounded border px-3 py-1 disabled:opacity-50" onClick={() => { setPage(page - 1); setExpanded(null); }}>Previous</button><button type="button" disabled={(page + 1) * 50 >= result.data.total || adding !== null} className="rounded border px-3 py-1 disabled:opacity-50" onClick={() => { setPage(page + 1); setExpanded(null); }}>Next</button></div></div>
    </>}
  </section>;
}
