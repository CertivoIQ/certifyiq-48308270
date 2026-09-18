
export function allowedSourceUrl(value, officialDomains) {
 const url = new URL(value);
 const hosts = String(officialDomains).split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('SOURCE_URL_NOT_ALLOWED');
 if (!hosts.some(host => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) && (url.hostname===host || url.hostname.endsWith('.'+host)))) throw new Error('SOURCE_HOST_NOT_ALLOWED');
 return url;
}
export async function downloadPdf(sourceUrl, domains, fetcher=fetch) {
 let url=allowedSourceUrl(sourceUrl,domains);
 const signal=AbortSignal.timeout(30000);
 for(let redirects=0;redirects<=3;redirects++) {
  const response=await fetcher(url.href,{redirect:'manual',signal,headers:{'user-agent':'CertivoIQ-Merlin/2.0 (+https://certivoiq.com)'}});
  if ([301,302,303,307,308].includes(response.status)) {
   await response.body?.cancel();
   if(redirects===3 || !response.headers.get('location')) throw new Error('SOURCE_REDIRECT_LIMIT');
   url=allowedSourceUrl(new URL(response.headers.get('location'),url).href,domains); continue;
  }
  if(!response.ok) { await response.body?.cancel(); throw new Error('SOURCE_HTTP_'+response.status); }
  const cap=5*1024*1024;
  if(Number(response.headers.get('content-length')??0)>cap) { await response.body?.cancel(); throw new Error('SOURCE_TOO_LARGE'); }
  const reader=response.body?.getReader(); if(!reader) throw new Error('SOURCE_EMPTY');
  let size=0; const chunks=[];
  try {
   while(true) { const {done,value}=await reader.read(); if(done) break; size+=value.length;
    if(size>cap) throw new Error('SOURCE_TOO_LARGE'); chunks.push(value);
   }
  } finally { await reader.cancel(); reader.releaseLock(); }
  const bytes=new Uint8Array(size); let offset=0;
  for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-') throw new Error('SOURCE_NOT_PDF');
  return {bytes,finalUrl:url.href};
 }
 throw new Error('SOURCE_REDIRECT_LIMIT');
}
export function validateExtraction(value) {
 if(!value || !Array.isArray(value.procedures) || !Array.isArray(value.document_ambiguity_flags)) throw new Error('INVALID_EXTRACTION');
 if(!value.procedures.length || value.procedures.length>100) throw new Error('EMPTY_OR_EXCESSIVE_EXTRACTION');
 const keys=new Set();
 for(const p of value.procedures) {
  for(const field of ['procedure_key','category','title','summary']) if(typeof p[field]!=='string'||!p[field].trim()||p[field].length>8000) throw new Error('INVALID_PROCEDURE_FIELD');
  if(!/^[a-z0-9_-]+$/.test(p.procedure_key)||keys.has(p.procedure_key)) throw new Error('DUPLICATE_OR_INVALID_KEY'); keys.add(p.procedure_key);
  for(const field of ['steps','responsible_roles','triggering_events','required_inputs','required_evidence','deadlines','exceptions','ambiguity_flags'])
   if(!Array.isArray(p[field])||p[field].some(x=>typeof x!=='string'||x.length>8000)) throw new Error('INVALID_LIST');
  if(!Number.isFinite(p.extraction_confidence)||p.extraction_confidence<0||p.extraction_confidence>1) throw new Error('INVALID_CONFIDENCE');
  if(!Array.isArray(p.citations)||!p.citations.length) throw new Error('CITATION_REQUIRED');
  for(const c of p.citations) if(typeof c.page_or_locator!=='string'||!c.page_or_locator.trim()||typeof c.section!=='string'||typeof c.excerpt!=='string'||c.excerpt.trim().split(/\s+/).length>20) throw new Error('INVALID_CITATION');
 }
 return value;
}
export function outputText(response) {
 return (response.output??[]).flatMap(x=>x.content??[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
}
export const hex = bytes=>Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,'0')).join('');
export function base64(bytes) {
 let binary=''; for(let offset=0;offset<bytes.length;offset+=0x8000) binary+=String.fromCharCode(...bytes.subarray(offset,offset+0x8000));
 return btoa(binary);
}
