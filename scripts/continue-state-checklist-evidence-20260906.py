"""Continuation of existing evidence research. No database writes or approvals.
Only scoped agency URLs are fetched; HTTPS/TLS checks remain enabled.
Original PDF bytes, hashes, text and discovery records are retained for review.
"""
import importlib.util, json, os, re, concurrent.futures as cf, hashlib, time
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, quote, urljoin, unquote
spec=importlib.util.spec_from_file_location('cap',Path('scripts/capture-state-checklist-pdfs-20260906.py'))
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
c.OUT=Path('artifacts/checklist-continuation-20260906');c.OUT.mkdir(parents=True,exist_ok=True)
c.UA='Mozilla/5.0 (compatible; CertivoIQ-Official-Source-Research/2.3)'
def norm(u):
 p=urlsplit(u);return urlunsplit((p.scheme,p.netloc,quote(p.path,safe='/%:@-._~!$&\'()*+,;='),quote(p.query,safe='=&%:@/?+[]'),''))
inv=json.loads(Path('src/lib/nationwide-state-source-discovery.json').read_text())
names={j['state_code']:j['agency'] for j in inv['jurisdictions']}
config={
 'NY':(['hcr.ny.gov'],['https://hcr.ny.gov/asset-management','https://hcr.ny.gov/asset-management-forms-documents']+['https://hcr.ny.gov/asset-management-forms-documents?page='+str(n) for n in range(1,7)]+['https://hcr.ny.gov/capital-programs-manual-2026']),
 'NH':(['nhhousing.org','nhhfa.org'],['https://www.nhhousing.org/developer-financing/asset-management/low-income-housing-tax-credit/']),
 'AK':(['ahfc.us'],['https://www.ahfc.us/pros/compliance-audit/affordable-housing-compliance-reference-manual/section-ii-forms-introduction-forms/21-lihtc-tax-exempt-bond-program-specific-forms','https://www.ahfc.us/pros/compliance-audit/affordable-housing-compliance-reference-manual','https://www.ahfc.us/tenants/resources/utility-allowances']),
 'IL':(['ihda.org'],['https://www.ihda.org/wp-content/uploads/2026/07/MB-634-Guidance-on-Compliance-Document-Submission-7.21.26.pdf','https://www.ihda.org/wp-content/uploads/2026/07/MB-632-Updated-Scheduling-Procedures-Scoring-for-On-Site-Physical-Inspections.pdf']),
 'WA':(['wshfc.org'],['https://wshfc.org/sites/default/files/2026-04/130Zb_Post-Year15MonitoringProceduresOverview.pdf']),
 'KS':(['kshousingcorp.org'],['https://kshousingcorp.org/wp-content/uploads/2024/02/Compliance-Update-February-2024.pdf']),
 'PA':(['phfa.org'],['https://www.phfa.org/mhp/propertymanagement/','https://www.phfa.org/forms/property_management/hotma_resources/']),
 'WI':(['wheda.com'],['https://www.wheda.com/property-managers/htc','https://www.wheda.com/property-managers','https://www.wheda.com/globalassets/documents/forms-manuals-resources/htc-forms/monitoring/htc-monitoring-manual.pdf']),
 'MI':(['michigan.gov'],['https://www.michigan.gov/mshda/compliance/lihtc','https://www.michigan.gov/mshda/developers/lihtc']),
 'MA':(['mass.gov'],['https://www.mass.gov/info-details/low-income-housing-tax-credit-lihtc']),
 'MT':(['commerce.mt.gov'],['https://commerce.mt.gov/Housing/Developers/Compliance/']),
 'OR':(['oregon.gov'],['https://www.oregon.gov/ohcs/compliance-monitoring/Pages/index.aspx']),
 'AZ':(['housing.az.gov'],['https://housing.az.gov/sites/default/files/2025-08/LIHTC-Compliance-Manual_2025.pdf','https://housing.az.gov/sites/default/files/2025-01/LIHTC-ADOH-TIC-Printable%20Version_Revised%2001_30_2025.pdf']),
 'FL':(['floridahousing.org'],['https://www.floridahousing.org/owners-and-managers/compliance/utility-allowance']),
 'AL':(['ahfa.com'],['https://www.ahfa.com/programs/rental-housing/compliance']),
 'ME':(['mainehousing.org'],['https://www.mainehousing.org/programs-services/development/developmentdetail/low-income-housing-tax-credit-program','https://www.mainehousing.org/partners/partner-type/property-owners-managers']),
 'CA':(['treasurer.ca.gov'],['https://www.treasurer.ca.gov/ctcac/programreg/regulations']),
 'TN':(['thda.org'],['https://thda.org/business-partners/compliance-and-asset-management']),
 'TX':(['tdhca.texas.gov'],['https://www.tdhca.texas.gov/compliance-division','https://www.tdhca.texas.gov/hotma']),
 'NE':(['nifa.org'],['https://www.nifa.org/compliance']),
 'SD':(['sdhousing.org'],['https://www.sdhousing.org/ready-to-partner/compliance'])
}
PDF_EXCLUDE=re.compile(r'\.((doc|xls|ppt)x?|zip|jpe?g|png|gif|svg|mp[34])(?:\?|$)',re.I)
TOPIC=re.compile(r'compliance|monitor|manual|guide|tenant|certification|hotma|utility|income.{0,20}limit|rent.{0,20}limit|bulletin|notice|training|workshop|qualified.allocation|qap',re.I)
def task(state):
 domains,seeds=config[state];folder=c.OUT/state;folder.mkdir(exist_ok=True)
 queue=[(u,0,'Configured official source',None) for u in seeds];seen=set();docs=[];failures=[];discovery=[];pdfseen=set()
 while queue and len(seen)<120 and len(docs)<55:
  u,depth,label,parent=queue.pop(0);u=norm(u)
  if u in seen or not c.allowed(u,domains) or PDF_EXCLUDE.search(u):continue
  seen.add(u)
  try:
   b,final,headers,status=c.fetch(u,domains,18)
   if b[:1024].find(b'%PDF-')>=0:
    sha=hashlib.sha256(b).hexdigest()
    if sha in pdfseen:continue
    # Capture method refetches and hashes the exact preserved bytes independently.
    r=c.capture(state,{'url':u,'label':label if label!='Configured official source' else unquote(urlsplit(final).path.rsplit('/',1)[-1]),'parent':parent},domains,names[state]);docs.append(r);pdfseen.add(r['source_sha256']);continue
   ct=headers.get('Content-Type',headers.get('content-type','')).lower()
   if 'html' not in ct:failures.append({'url':u,'reason':'official_source_not_pdf','content_type':ct});continue
   parser=c.Links();parser.feed(b.decode('utf-8',errors='replace'));sh=hashlib.sha256(b).hexdigest();(folder/(sh+'.html')).write_bytes(b);discovery.append({'url':u,'final_url':final,'retrieved_at':c.now(),'html_sha256':sh,'purpose':'provenance_only_not_validation_evidence'})
   for href,text,heading in parser.links:
    v=norm(urljoin(final,href));full=unquote(text+' '+v+' '+heading)
    if not c.allowed(v,domains) or v in seen or PDF_EXCLUDE.search(v):continue
    ispdf='.pdf' in v.lower() or '/download_file/' in v or text.strip().lower() in ('pdf','download','download pdf')
    if ispdf:
     if state=='AK' and '/download_file/' in v and '/utility-allowances' in u and not '2026' in full:continue
     if state=='NY' or state=='AK' or TOPIC.search(full):queue.insert(0,(v,depth+1,text,u))
    elif depth<2 and TOPIC.search(text+' '+v):
     if state=='NY' and '/asset-management-forms-documents' in u and depth==0 and not re.search(r'/news/|\?|/events/|/search|/hcv|/hfa$',v):queue.append((v,depth+1,text,u))
     elif state!='NY' and not re.search(r'/news/|/events/|/calendar|/lender|/homebuyer|/homeowner|/mortgage-lending|\?page=',v):queue.append((v,depth+1,text,u))
  except Exception as e:failures.append({'url':u,'reason':str(e)[:250]})
  time.sleep(.12)
 print(json.dumps({'state':state,'pdfs':len(docs),'pages':len(discovery),'failures':len(failures)}),flush=True)
 return {'state_code':state,'authority_name':names[state],'official_domains':domains,'captured_documents':docs,'discovery_pages':discovery,'failures':failures}
with cf.ThreadPoolExecutor(max_workers=10) as pool:results=list(pool.map(task,config))
manifest={'capture_completed_at':c.now(),'run_id':os.getenv('GITHUB_RUN_ID'),'commit':os.getenv('GITHUB_SHA'),'results':results,'policy':'Continuation of the unresolved live database checklist only; original PDF bytes retained. No database writes. No independent approval or rule activation. All content/date/program classifications require review.'}
(c.OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
for r in results:
 for d in r['captured_documents']:
  print('PDF_CAPTURE '+json.dumps({k:d[k] for k in ['state_code','source_url','source_sha256','byte_size','retrieved_at','extracted_page_count']}),flush=True)
