/** Bounded retry of public GETs while a just-published asset propagates.
 * Exact status, source identity and byte-integrity checks remain the caller's job.
 */
export async function fetchPublishedAsset(url, options, {fetcher=fetch,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),attempts=8,delayMs=1500}={}) {
 if(options?.method && options.method!=='GET')throw new Error('Release probe only supports GET');
 if(!Number.isInteger(attempts)||attempts<1||attempts>8)throw new Error('Invalid release probe retry bound');
 for(let attempt=0;attempt<attempts;attempt++){
  const response=await fetcher(url,{...options,signal:AbortSignal.timeout(30000)});
  if(![404,503].includes(response.status)||attempt===attempts-1)return response;
  await response.body?.cancel();
  await wait(delayMs);
 }
}
