import {readFileSync,writeFileSync} from 'node:fs';
const edits=new Map(), marker='// TIC_RECOGNITION_HARDENING_V1';
function replace(path,before,after,count=1){let e=edits.get(path);if(!e){e={original:readFileSync(path,'utf8'),next:readFileSync(path,'utf8')};edits.set(path,e);}if(e.original.startsWith(marker))return;const n=e.next.split(before).length-1;if(n!==count)throw new Error(`${path}: ${n} anchors, expected ${count}. No files written.`);e.next=e.next.split(before).join(after);}
const core='src/lib/tic-cell-repair.mjs';
replace(core,'  if (/tenant\\s+income\\s+certification/i.test(normalized)) return true;', `  const headingLines = String(text ?? '').split(/\\r?\\n/).map(compact);
  if (headingLines.slice(0, 8).some(line => /^(?:instructions\\s+(?:for\\s+)?(?:completing|to\\s+complete)|tenant\\s+income\\s+certification\\s*[-:–—]?\\s*instructions)\\b/i.test(line))) return false;
  if (headingLines.some(line => /^tenant\\s+income\\s+certification\\b/i.test(line))) return true;`);
replace(core,'/type\\s+of\\s+asset.*cash\\s+value/i];', `/type\\s+of\\s+asset.*cash\\s+value/i,
    /part\\s+vi\\b.*determination\\s+of\\s+income\\s+eligibility/i,
    /part\\s+vii\\b.*rent/i, /part\\s+viii\\b.*student/i, /part\\s+ix\\b.*program\\s+type/i];`);
const spatial='src/lib/tic-spatial-extraction.mjs';
replace(spatial,'function householdLines(', `function householdHeaderBoundaries(table, extent, profile) {
  const words = table?.header?.words ?? [];
  const patterns = profile === 'phfa'
    ? [/^hh\\s+mbr$/, /^last\\s+name$/, /^first\\s+name$/, /^(?:rel\\s+hh|relationship)$/, /^race$/, /^(?:ethn|ethnicity)$/, /^(?:dsbs|disability)$/, /^(?:gndr|gender)$/, /^date\\s+(?:of\\s+)?birth$/, /^(?:f\\/?t\\s+)?student$/, /^social\\s+security$/]
    : [/^hh\\s+mbr$/, /^last\\s+name$/, /^first\\s+name$/, /^(?:rel\\s+hh|relationship)$/, /^date\\s+(?:of\\s+)?birth$/, /^(?:f\\/?t\\s+)?student$/, /^social(?:\\s+security)?$/];
  const centers = [];
  for (const pattern of patterns) {
    let center = null;
    for (let start=0; start<words.length && center === null; start++) {
      for (let end=start+1; end<=Math.min(words.length,start+4); end++) {
        const span=words.slice(start,end);
        if (pattern.test(normalizedText(span.map(word=>word.text).join(' ')))) { center=(span[0].x0+span.at(-1).x1)/2; break; }
      }
    }
    if (center === null || (centers.length && center <= centers.at(-1))) return null;
    centers.push(center);
  }
  const width=extent.x1-extent.x0;
  const edges=[0,...centers.slice(1).map((center,index)=>((center+centers[index])/2-extent.x0)/width),1];
  return edges.every((value,index)=>index===0 || value>edges[index-1]) ? edges : null;
}

function householdLines(`);
replace(spatial,`  const boundaries = profile === 'phfa'
    ? [0, 0.065, 0.235, 0.405, 0.47, 0.535, 0.60, 0.665, 0.765, 0.86, 1]
    : [0, 0.075, 0.295, 0.455, 0.64, 0.79, 0.885, 1];`, `  // Eleven PHFA cells require twelve edges; prefer source header geometry.
  const boundaries = householdHeaderBoundaries(table, extent, profile) ?? (profile === 'phfa'
    ? [0, 0.065, 0.235, 0.405, 0.47, 0.535, 0.60, 0.665, 0.72, 0.835, 0.885, 1]
    : [0, 0.075, 0.295, 0.455, 0.64, 0.79, 0.885, 1]);`);
const pdf='src/lib/pdf-ocr.ts';
replace(pdf,'candidate.confidence >= 0.15;', 'candidate.confidence >= 0.75;');
replace(pdf,'const isTicFormPage = isTicContent(nativeText) && formValueLines.length === 0 && nativeSpatialLines.length === 0;', `const sourceValues = [...formValueLines, ...nativeSpatialLines];
        const hasTypeValue = sourceValues.some(line => /^__CERTIVOIQ_TIC_FIELD__ certification_type:/.test(line));
        const hasTableValues = sourceValues.some(line => /^__CERTIVOIQ_TIC_FIELD__ (?:household_member_\\d+_(?:last_name|first_name_middle_initial)|income_member_\\d+_wages_business|asset_\\d+_cash_value):/.test(line));
        const isTicFormPage = isTicContent(nativeText) && (!hasTableValues || (/initial\\s+certification.*recertification/is.test(nativeText) && !hasTypeValue));`);
const native='src/lib/tic-pdf-form-values.ts';
replace(native,`  if (["Initial Certification", "Recertification", "Other"].includes(name)) {
    return ["certification_type", name];
  }`, `  const certificationChoice = ["Initial Certification", "Recertification", "Other"].find(choice => choice.toLowerCase() === name.trim().toLowerCase());
  if (certificationChoice) { name = certificationChoice; return ["certification_type", name]; }`);
for(const [path,e]of edits){if(e.original.startsWith(marker))continue;writeFileSync(path,marker+'\n'+e.next);console.log('Patched '+path);}
