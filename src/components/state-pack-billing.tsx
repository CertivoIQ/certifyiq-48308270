import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/hooks/use-session';
import { Panel } from '@/components/ui-kit';
import { Button } from '@/components/ui/button';
import { getStripeEnvironment } from '@/lib/stripe';
import { getStatePackBilling, purchaseStatePack } from '@/lib/state-pack-billing.functions';
import { STATE_DOCUMENT_LIBRARIES } from '@/lib/certification-document-library';
import { toast } from 'sonner';

export function useStatePackBilling() {
  const { user } = useSession();
  const environment = getStripeEnvironment();
  const sessionId = typeof window === 'undefined' ? undefined : new URLSearchParams(window.location.search).get('state_checkout') ?? undefined;
  return useQuery({ queryKey: ['state-pack-billing',user?.id,environment,sessionId], enabled: !!user, queryFn: () => getStatePackBilling({data:{environment,sessionId}}), refetchInterval: query => sessionId && query.state.data?.checkoutPending ? 5000 : false });
}

export function StatePackBilling({ query }: { query: ReturnType<typeof useStatePackBilling> }) {
  const [busy,setBusy] = useState<string|null>(null);
  const environment = getStripeEnvironment();
  const money = (cents: number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
  if (query.isError) return <Panel title="State packs"><p role="alert">{query.error.message}</p><Button onClick={()=>void query.refetch()}>Retry</Button></Panel>;
  if (!query.data?.administrator) return null;
  const buy = async (licenseId:string,stateCode:string) => {
    setBusy(`${licenseId}:${stateCode}`);
    try { const {url} = await purchaseStatePack({data:{licenseId,stateCode,environment}}); window.location.assign(url); }
    catch(error) { toast.error(error instanceof Error ? error.message : 'Could not start checkout.'); }
    finally {setBusy(null);}
  };
  return <Panel title="Add a state pack" description="Purchase directly here. Access begins automatically after payment is confirmed.">
    <p className="mb-4 text-sm text-muted-foreground">Each additional state is $65,000 annually, prorated through your existing annual renewal date. The addition is paid now, ends with the current contract, and does not renew separately. Bank payments unlock access after settlement.</p>
    {query.data.availableStates.length===0 && <p className="mb-4 text-sm">No additional state packs are available for purchase yet. States appear here when their release is approved.</p>}
    {query.data.licenses.map(license=><section key={license.id} className="mb-5">
      <h3 className="font-medium">License {license.number}</h3>
      {license.unavailableReason ? <p className="text-sm text-muted-foreground">{license.unavailableReason}</p> : <>
        <p className="my-2 text-sm">Licensed states: {license.states.join(', ')}. Renewal: {new Date(license.quote!.termEnd*1000).toLocaleDateString()}.</p>
        <div className="grid gap-2 sm:grid-cols-2">{query.data!.availableStates.filter(code=>!license.states.includes(code)).map(code=><div key={code} className="flex items-center justify-between gap-3 rounded border p-3"><div><strong>{STATE_DOCUMENT_LIBRARIES.find(state=>state.code===code)?.name??code}</strong><p className="text-sm">Approximately {money(license.quote!.amountCents)} through renewal</p></div><Button disabled={!!busy} onClick={()=>void buy(license.id,code)}>{busy===`${license.id}:${code}`?'Opening…':'Review & pay'}</Button></div>)}</div>
        {license.orders.map((order,index)=><p key={`${order.state}:${index}`} className="mt-2 text-sm">{order.state}: {order.status==='paid' && Date.parse(order.termEnd)>Date.now() && query.data!.availableStates.includes(order.state)?<><a className="underline" href={`/document-intelligence#state-library-${order.state}`}>Open state pack</a> — paid {money(order.amountCents)}</>:order.status==='pending'?'Awaiting payment confirmation':order.status==='paid'?'Paid — current availability or contract term does not permit access':order.status}</p>)}
      </>}
    </section>)}
  </Panel>;
}
