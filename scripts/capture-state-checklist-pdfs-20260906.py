"""Read-only official-source discovery and exact-PDF capture.
No database credentials, validation decisions, rules or deployment writes.
Classification is a review hint, NEVER an approval or completeness assertion.
"""
import concurrent.futures as cf
import csv
import hashlib
import html
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import subprocess
import time
from urllib.parse import urljoin, urlsplit, urlunsplit, unquote
from urllib.request import Request, build_opener, HTTPRedirectHandler
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'/'state-checklist-pdf-evidence-20260906'
OUT.mkdir(parents=True,exist_ok=True)
STATES=set('AL AK AZ AR CA CO CT DE FL GA HI IA ID IL IN KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split())
MAX_BYTES=25*1024*1024
UA='CertivoIQ-Official-Compliance-Source-Research/2.0'
RELEVANT=re.compile(r'compliance|monitoring|asset.management|property.manag|lihtc|low.income.housing|tax.credit|housing.credit|income.{0,15}limit|rent.{0,15}limit|utility|training|workshop|hotma|notice|bulletin|forms?|qap|qualified.allocation',re.I)
PATTERNS={
 'Manual':r'(compliance|monitoring).{0,40}(manual|guide|handbook)|(manual|guide|handbook).{0,40}(compliance|monitoring)',
 'Rules':r'hotma|bulletin|notice|procedur|policy.update|rule.change|compliance.update|monitoring.change|memorandum|waiver',
 'Income':r'income.{0,30}limits?|mtsp|hera.special',
 'Rent':r'rent.{0,30}limits?|maximum.rent',
 'UA':r'utility.{0,30}allowance|utility.analysis|energy.consumption.model',
 'Forms':r'tenant.income.certification|\btic\b|verification.form|income.verification|asset.verification|certification.form|self.certification|affidavit|sample.lease|lease.addendum',
 'Training':r'training|workshop|webinar|presentation|slides|powerpoint',
 'QAP':r'qualified.allocation|\bqap\b|allocation.plan',
 'Passbook':r'passbook'
}
EXTRAS={
 'US':[
 'https://www.huduser.gov/portal/sites/default/files/datasets/inflationary-adjustments/CY2026-Revised-Amounts-And-Passbook-Rate.pdf',
 'https://www.huduser.gov/portal/datasets/inflationary-adjustments-notifications.html'],
 'AZ':['https://housing.az.gov/programs/rental-compliance','https://housing.az.gov/resources/2026-lihtc-rent-income-limits-post-1989-effective-512026','https://housing.az.gov/sites/default/files/2025-08/LIHTC-Compliance-Manual_2025.pdf','https://housing.az.gov/sites/default/files/2025-01/LIHTC-ADOH-TIC-Printable%20Version_Revised%2001_30_2025.pdf'],
 'WV':['https://www.wvhdf.com/programs/multi-family-programs-and-resources/'],
 'FL':['https://www.floridahousing.org/owners-and-managers/compliance/utility-allowance','https://www.floridahousing.org/owners-and-managers/compliance'],
 'LA':['https://www.lhc.la.gov/hubfs/Document%20Libraries/Housing%20Development/Funding%20Opportunities/LIHTC/LIHTC_Manual_2026.pdf','https://www.lhc.la.gov/resources-for-housing-development'],
 'WY':['https://www.wyomingcda.com/affordable-housing/']
}

def now():return datetime.now(timezone.utc).isoformat()
def normalize(u):
 p=urlsplit(html.unescape(u));return urlunsplit((p.scheme,p.netloc,p.path,p.query,''))
def allowed(u,domains):
 try:
  p=urlsplit(u);h=(p.hostname or '').lower()
  return p.scheme=='https' and not p.username and not p.password and p.port in (None,443) and any(h==d or h.endswith('.'+d) for d in domains)
 except Exception:return False
class Guard(HTTPRedirectHandler):
 def __init__(self,domains):self.domains=domains
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  if not allowed(newurl,self.domains):raise ValueError('redirect_to_unapproved_host:'+newurl)
  return super().redirect_request(req,fp,code,msg,headers,newurl)
def fetch(url,domains,timeout=16):
 if not allowed(url,domains):raise ValueError('unapproved_source_host')
 req=Request(url,headers={'User-Agent':UA,'Accept':'application/pdf,text/html,application/xhtml+xml;q=0.9,*/*;q=0.2','Accept-Language':'en-US,en;q=0.9'})
 with build_opener(Guard(domains)).open(req,timeout=timeout) as r:
  b=r.read(MAX_BYTES+1)
  if not b or len(b)>MAX_BYTES:raise ValueError('empty_or_oversize_response')
  return b,r.geturl(),dict(r.headers),r.status
class Links(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.links=[];self.href=None;self.text=[];self.head=[];self.heading='';self.inhead=False
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag in ('h1','h2','h3','h4'):self.inhead=True;self.head=[]
  if tag=='a':self.href=a.get('href');self.text=[]
  if tag in ('iframe','embed','object'):
   u=a.get('src') or a.get('data')
   if u:self.links.append((u,a.get('title',''),self.heading))
 def handle_data(self,data):
  if self.href:self.text.append(data)
  if self.inhead:self.head.append(data)
 def handle_endtag(self,tag):
  if tag=='a' and self.href:self.links.append((self.href,' '.join(self.text),self.heading));self.href=None
  if tag in ('h1','h2','h3','h4'):self.heading=' '.join(self.head).strip();self.inhead=False

def families(label):return [k for k,p in PATTERNS.items() if re.search(p,label,re.I)]
def score(c):
 s=unquote(c['label']+' '+c['url']);f=families(s)
 val=len(f)*15+sum(12 for x in ('Manual','Rules','Training','UA','QAP','Passbook') if x in f)
 years=[int(y) for y in re.findall(r'(?<!\d)(20[0123]\d)(?!\d)',s)]
 if years:
  y=max(years);val+=25 if y==2026 else 8 if y==2025 else -10 if y>2026 else -min(35,(2025-y)*6)
 if re.search(r'draft|proposed|comment',s,re.I):val-=30
 return val

def capture(state,c,domains,agency):
 b,final,headers,status=fetch(c['url'],domains,25)
 if b[:1024].find(b'%PDF-')<0:raise ValueError('not_an_original_pdf')
 sha=hashlib.sha256(b).hexdigest();folder=OUT/state;folder.mkdir(exist_ok=True)
 pdf=folder/(sha+'.pdf');pdf.write_bytes(b)
 txt=folder/(sha+'.txt')
 extraction_error=None
 try:
  subprocess.run(['pdftotext','-layout',str(pdf),str(txt)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=90)
  text=txt.read_text(errors='replace')
 except Exception as e:text='';extraction_error=str(e)[:200]
 pages=text.split('\f');hints=families(unquote(c['label']+' '+final));evidence={}
 for family,pattern in PATTERNS.items():
  hits=[]
  for n,page in enumerate(pages,1):
   for match in list(re.finditer(pattern,page,re.I))[:2]:
    hits.append({'pdf_page':n,'excerpt':' '.join(page[max(0,match.start()-90):match.end()+220].split())})
   if len(hits)>=3:break
  if hits:evidence[family]=hits[:3]
 rec={'state_code':state,'authority_name':agency,'source_url':c['url'],'final_url':final,'discovery_url':c.get('parent'),'link_label':c['label'],'link_context':c.get('context',''),'source_sha256':sha,'byte_size':len(b),'content_type':headers.get('Content-Type',headers.get('content-type','')),'retrieved_at':now(),'http_status':status,'tls_peer_verified':True,'last_modified':headers.get('Last-Modified'),'etag':headers.get('ETag'),'pdf_path':str(pdf.relative_to(OUT)),'text_path':str(txt.relative_to(OUT)) if txt.exists() else None,'extraction_error':extraction_error,'extracted_page_count':max(1,len(pages)-(1 if not pages[-1].strip() else 0)),'title_page_excerpt':' '.join(pages[0].split())[:1600],'family_hints':hints,'content_evidence':evidence,'review_status':'EXACT_BYTES_CAPTURED_CONTENT_REVIEW_REQUIRED','independent_validation_completed':False,'compliance_activation_allowed':False}
 return rec

def crawl(j):
 state=j['state_code'];agency=j['agency'];ds=j['official_domain'];domains=[ds] if isinstance(ds,str) else list(ds)
 domains=[d.lower() for d in domains];folder=OUT/state;folder.mkdir(exist_ok=True)
 seeds=[s['url'] for s in j.get('sources',[])]+EXTRAS.get(state,[])
 queue=[(u,0,'Configured official source',None,'') for u in dict.fromkeys(seeds)];seen=set();candidates={};failures=[];pages_read=[]
 def add_pdf(u,label,parent,context):
  item={'url':u,'label':label or unquote(urlsplit(u).path.rsplit('/',1)[-1]),'parent':parent,'context':context}
  old=candidates.get(u)
  if old is None or len(item['label'])>len(old['label']):candidates[u]=item
 while queue and len(pages_read)<24 and len(seen)<75:
  queue.sort(key=lambda q:score({'url':q[0],'label':q[2]})-q[1]*12,reverse=True)
  u,depth,label,parent,context=queue.pop(0);u=normalize(u)
  if u in seen or not allowed(u,domains):continue
  seen.add(u)
  if re.search(r'\.pdf(?:\?|$)',u,re.I):add_pdf(u,label,parent,context);continue
  try:
   b,final,headers,status=fetch(u,domains,12)
   if b[:1024].find(b'%PDF-')>=0:add_pdf(u,label,parent,context);continue
   ct=headers.get('Content-Type',headers.get('content-type','')).lower()
   if 'html' not in ct and not b.lstrip().startswith((b'<!DOCTYPE',b'<html',b'<HTML')):
    failures.append({'url':u,'reason':'non_pdf_non_html_source','content_type':ct});continue
   parser=Links();parser.feed(b.decode('utf-8',errors='replace'));pages_read.append({'url':u,'final_url':final,'retrieved_at':now()})
   for href,text,heading in parser.links:
    v=normalize(urljoin(final,href.strip()));text=' '.join(text.split());h=unquote(text+' '+v+' '+heading)
    if not allowed(v,domains) or v in seen:continue
    if re.search(r'\.pdf(?:\?|$)',v,re.I):
     if RELEVANT.search(h):add_pdf(v,text,final,heading)
    elif not re.search(r'\.(jpg|png|gif|svg|zip|mp4|mp3|xlsx?|docx?|pptx?)(?:\?|$)',v,re.I) and depth<2 and RELEVANT.search(unquote(text+' '+v)):
     queue.append((v,depth+1,text,final,heading))
  except Exception as e:failures.append({'url':u,'reason':str(e)[:240]})
  time.sleep(.12)
 ranked=sorted(candidates.values(),key=score,reverse=True)
 # Reserve space for every family rather than exhausting the budget on forms.
 selected={}
 for family in PATTERNS:
  for c in [c for c in ranked if family in families(unquote(c['label']+' '+c['url']))][:4]:selected[c['url']]=c
 for c in ranked:
  if len(selected)>=32:break
  selected[c['url']]=c
 records=[]
 for c in list(selected.values())[:40]:
  try:records.append(capture(state,c,domains,agency))
  except Exception as e:failures.append({'url':c['url'],'label':c['label'],'reason':str(e)[:240]})
  time.sleep(.15)
 result={'state_code':state,'authority_name':agency,'official_domains':domains,'discovery_pages':pages_read,'discovered_pdf_candidates':ranked,'captured_documents':records,'failures':failures}
 (folder/'result.json').write_text(json.dumps(result,indent=2))
 print(json.dumps({'state_code':state,'pages':len(pages_read),'candidate_pdfs':len(candidates),'captured_pdfs':len(records),'failure_count':len(failures)}),flush=True)
 return result

def main():
 inventory=json.loads((ROOT/'src/lib/nationwide-state-source-discovery.json').read_text())
 jurisdictions=[j for j in inventory['jurisdictions'] if j['state_code'] in STATES and j.get('scope')=='STATEWIDE']
 jurisdictions.append({'state_code':'US','agency':'U.S. Department of Housing and Urban Development','official_domain':['huduser.gov','hud.gov'],'sources':[]})
 seen=set();jurisdictions=[j for j in jurisdictions if not (j['state_code'] in seen or seen.add(j['state_code']))]
 result=[]
 with cf.ThreadPoolExecutor(max_workers=12) as pool:
  futs={pool.submit(crawl,j):j['state_code'] for j in jurisdictions}
  for fut in cf.as_completed(futs):
   try:result.append(fut.result())
   except Exception as e:result.append({'state_code':futs[fut],'fatal_error':str(e),'captured_documents':[]})
 result.sort(key=lambda r:r['state_code'])
 records=[d for r in result for d in r.get('captured_documents',[])]
 manifest={'capture_completed_at':now(),'run_id':os.getenv('GITHUB_RUN_ID'),'commit':os.getenv('GITHUB_SHA'),'policy':'Original PDF bytes only. Exact-byte capture is not checklist approval, source currency approval, independent validation, or rule activation. No database writes performed.','states_attempted':len(result),'pdfs_captured':len(records),'results':result}
 (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
 fields=['state_code','authority_name','link_label','source_url','final_url','discovery_url','source_sha256','byte_size','retrieved_at','last_modified','extracted_page_count','review_status','pdf_path']
 with (OUT/'sha256-manifest.csv').open('w',newline='') as f:
  w=csv.DictWriter(f,fields,extrasaction='ignore');w.writeheader();w.writerows(records)
 with (OUT/'SHA256SUMS').open('w') as f:
  for r in records:f.write(r['source_sha256']+'  '+r['pdf_path']+'\n')
 print('CAPTURE_COMPLETE '+json.dumps({'states_attempted':len(result),'pdfs_captured':len(records),'run_id':os.getenv('GITHUB_RUN_ID')}),flush=True)
 # Compact exact-byte evidence is also retained in logs if artifact delivery is unavailable.
 for r in records:print('PDF_EVIDENCE '+json.dumps({k:r[k] for k in fields if k in r}),flush=True)
if __name__=='__main__':main()
