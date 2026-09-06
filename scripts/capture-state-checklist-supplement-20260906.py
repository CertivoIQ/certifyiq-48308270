"""Supplemental read-only capture. Approved delegated hosts are evidenced by links on agency pages. No database writes or approvals."""
import concurrent.futures as cf
import importlib.util
import json
import os
from pathlib import Path
spec=importlib.util.spec_from_file_location('capture',Path(__file__).with_name('capture-state-checklist-pdfs-20260906.py'))
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
c.OUT=c.ROOT/'artifacts'/'state-checklist-supplement-20260906';c.OUT.mkdir(parents=True,exist_ok=True)
c.UA='Mozilla/5.0 (compatible; CertivoIQ-Source-Research/2.0)'
# These exact host transitions were confirmed from the named agencies' public links.
config={
 'MS':(['mshomecorp.com','archivemhc.com'],['https://www.mshomecorp.com/property-managers/htc-compliance-forms-and-resources/','https://www.mshomecorp.com/property-managers/housing-tax-credit-compliance/']),
 'NE':(['nifa.org','www-nifa-org-files.s3.amazonaws.com'],['https://www.nifa.org/developers-property-managers/forms-docs','https://www.nifa.org/developers-property-managers/education-training']),
 'NJ':(['nj.gov','njhousing.gov'],['https://www.nj.gov/dca/hmfa/developers/lihtc/compliance/','https://www.nj.gov/dca/hmfa/developers/lihtc/compliance/incomelimits.shtml']),
 'SC':(['schousing.sc.gov','schousing.com'],['https://schousing.sc.gov/development/housing-tax-credit-lihtc','https://schousing.sc.gov/sites/schousing/files/Documents/Development/Manuals%20and%20Forms/LIHTC%20Compliance%20Manual%20-%20Revised%202.12.2026.pdf']),
 'SD':(['sdhousing.org','sdhda.org','static1.squarespace.com','images.squarespace-cdn.com'],['https://www.sdhousing.org/forms/housing-tax-credit-compliance-manual','https://www.sdhousing.org/s/2025HTC.pdf','https://www.sdhousing.org/manage-housing']),
 'TN':(['thda.org','dogvxws799i6n.cloudfront.net'],['https://thda.org/business-partners/compliance-and-asset-management','https://thda.org/','https://thda.org/business-partners/lihtc-compliance']),
 'VA':(['virginiahousing.com','mc-7eaf08cc-3802-4bab-9abf-a732-cdn-endpoint.azureedge.net','mc-0e9acafd-48f4-4c49-b478-6257-cdn-endpoint.azureedge.net'],['https://www.virginiahousing.com/partners/rental-housing/compliance-monitoring','https://www.virginiahousing.com/partners/rental-housing/rental-housing-tax-credits']),
 'OR':(['oregon.gov','ohcs.oregon.gov'],['https://www.oregon.gov/ohcs/compliance-monitoring/Pages/index.aspx','https://www.oregon.gov/ohcs/compliance-monitoring/Pages/rent-income-limits.aspx']),
 'AZ':(['housing.az.gov'],['https://housing.az.gov/programs/rental-compliance']),
 'AL':(['ahfa.com'],['https://www.ahfa.com/programs/rental-housing/compliance','https://www.ahfa.com/programs/rental-housing/multifamily-notices']),
 'UT':(['utahhousingcorp.org'],['https://utahhousingcorp.org/','https://www.utahhousingcorp.org/']),
 'US':(['huduser.gov','hud.gov'],['https://www.huduser.gov/portal/datasets/inflationary-adjustments-notifications.html']),
 'FL':(['floridahousing.org'],['https://www.floridahousing.org/owners-and-managers/compliance/utility-allowance','https://www.floridahousing.org/owners-and-managers/compliance-rule'])
}
# Avoid application/QAP pages crowding out documents on the compliance index.
oldscore=c.score
def score(item):
 value=oldscore(item)
 s=(item.get('label','')+' '+item.get('url','')).lower()
 if 'compliance' in s:value+=40
 if 'tenant' in s:value+=15
 if any(x in s for x in ['application','reservation list','ranking','scoresheet','board presentation']):value-=60
 return value
c.score=score
inventory=json.loads((c.ROOT/'src/lib/nationwide-state-source-discovery.json').read_text())
agency={j['state_code']:j['agency'] for j in inventory['jurisdictions']}
jobs=[{'state_code':s,'agency':agency.get(s,'U.S. Department of Housing and Urban Development'),'official_domain':ds,'sources':[{'url':u} for u in urls]} for s,(ds,urls) in config.items()]
results=[]
with cf.ThreadPoolExecutor(max_workers=10) as pool:
 for result in pool.map(c.crawl,jobs):results.append(result)
manifest={'capture_completed_at':c.now(),'run_id':os.getenv('GITHUB_RUN_ID'),'policy':'Original HTTPS PDF capture only; no source approvals, no current-applicability assumption, no rule activation. Delegated hosts require agency-link provenance.','results':results,'pdfs_captured':sum(len(r['captured_documents']) for r in results)}
(c.OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('SUPPLEMENT_COMPLETE '+str(manifest['pdfs_captured']),flush=True)
