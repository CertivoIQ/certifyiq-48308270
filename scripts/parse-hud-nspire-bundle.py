#!/usr/bin/env python3
import glob,json,os,re,subprocess,sys
from datetime import datetime

root=sys.argv[1] if len(sys.argv)>1 else "nspire-source/extracted/NSPIRE-Standards-ALL-STANDARDS"
out=sys.argv[2] if len(sys.argv)>2 else "nspire-source/nspire-deficiency-registry.json"
labels=['DEFICIENCY CRITERIA','HEALTH AND SAFETY DETERMINATION','CORRECTION TIMEFRAME','HCV PASS / FAIL','HCV CORRECTION TIMEFRAME','INSPECTION PROCESS','OBSERVATION','REQUEST FOR HELP','ACTION','MORE INFORMATION']

def clean(s): return re.sub(r'\s+',' ',s or '').strip()
def pdftext(path): return subprocess.check_output(['pdftotext',path,'-'],text=True,errors='replace')
def header(t,label):
    lines=t.splitlines()
    for i,l in enumerate(lines):
        if clean(l).upper()==label+':':
            for x in lines[i+1:]:
                if clean(x): return clean(x)
    return None

def section_field(sec,label):
    lines=sec.splitlines()
    for i,l in enumerate(lines):
        if clean(l).upper()==label+':':
            out=[]
            for x in lines[i+1:]:
                c=clean(x)
                if not c: continue
                if any(c.upper()==lab+':' for lab in labels): break
                if label=='HCV CORRECTION TIMEFRAME' and c.startswith('The '): break
                out.append(c)
            return clean(' '.join(out))
    return None

def hours_for_severity(sev):
    return {'life_threatening':24,'severe':24,'moderate':720,'low':1440}[sev]

def norm_severity(raw):
    x=clean(raw).lower()
    if x.startswith('life-threatening'): return 'life_threatening'
    if x.startswith('severe'): return 'severe'
    if x.startswith('moderate'): return 'moderate'
    if x.startswith('low'): return 'low'
    return None

def titlecase(s):
    return ' '.join(w.capitalize() for w in clean(s).lower().split())

def iso_date(filename,header_date):
    m=re.search(r'_(\d{8})\.pdf$',filename)
    if m: return datetime.strptime(m.group(1),'%Y%m%d').date().isoformat()
    return datetime.strptime(header_date,'%m/%d/%y').date().isoformat()

rows=[]; source_entries=0; excluded=[]
for path in sorted(glob.glob(os.path.join(root,'*.pdf'))):
    t=pdftext(path); title=header(t,'TITLE'); version=header(t,'VERSION'); published=iso_date(os.path.basename(path),header(t,'DATE PUBLISHED'))
    matches=list(re.finditer(r'(?mi)^\s*DEFICIENCY\s+(\d+)\s*[–—-]\s*(UNIT|INSIDE|OUTSIDE)\s*:\s*$',t))
    if not matches: raise SystemExit(f'No deficiency sections: {path}')
    for i,m in enumerate(matches):
        source_entries+=1
        sec=t[m.end():matches[i+1].start() if i+1<len(matches) else len(t)]
        desc=[]
        for line in sec.splitlines():
            c=clean(line)
            if not c: continue
            if c.upper()=='DEFICIENCY CRITERIA:': break
            desc.append(c)
        description=clean(' '.join(desc))
        sev=norm_severity(section_field(sec,'HEALTH AND SAFETY DETERMINATION'))
        hcv_blob=' '.join(filter(None,[section_field(sec,'HCV PASS / FAIL'),section_field(sec,'HCV CORRECTION TIMEFRAME')]))
        hcv_pass=('pass' in hcv_blob.lower() and 'fail' not in hcv_blob.lower()) or ('n/a' in hcv_blob.lower() and 'pass' in hcv_blob.lower())
        if sev is None:
            excluded.append({'standard':title,'deficiency':int(m.group(1)),'area':m.group(2).lower(),'reason':'HUD health/safety N/A'})
            continue
        general_hours=hours_for_severity(sev)
        hcv_pf='pass' if hcv_pass else 'fail'
        if hcv_pf=='pass': hcv_hours=None
        elif '24 hour' in hcv_blob.lower() or sev=='life_threatening': hcv_hours=24
        else: hcv_hours=720
        rows.append([
            titlecase(title),m.group(2).lower(),f'Deficiency {m.group(1)}',description,sev,general_hours,hcv_hours,hcv_pf,
            os.path.basename(path),version,published
        ])

standards=len(set(r[0] for r in rows))
if source_entries!=408 or len(rows)!=407 or standards!=63:
    raise SystemExit(f'Unexpected HUD manifest: source_entries={source_entries}, actionable_rows={len(rows)}, standards={standards}')
if sum(1 for r in rows if r[7]=='pass')!=32 or sum(1 for r in rows if r[7]=='fail')!=375:
    raise SystemExit('Unexpected HCV pass/fail reconciliation')
json.dump(rows,open(out,'w'),ensure_ascii=True,separators=(',',':'))
manifest={'source_entries':source_entries,'actionable_rows':len(rows),'distinct_standards':standards,'hcv_pass':sum(r[7]=='pass' for r in rows),'hcv_fail':sum(r[7]=='fail' for r in rows),'excluded':excluded}
json.dump(manifest,open(os.path.join(os.path.dirname(out),'nspire-parse-manifest.json'),'w'),indent=2)
print(json.dumps(manifest,indent=2))
