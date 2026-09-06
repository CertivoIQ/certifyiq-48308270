import {readFileSync,writeFileSync} from 'node:fs';
function patch(path,change){const old=readFileSync(path,'utf8');const next=change(old);if(next===old) throw new Error(`Expected source repair not applied: ${path}`);writeFileSync(path,next);}
function replace(s,old,next){if(!s.includes(old))throw new Error(`Expected source missing: ${old.slice(0,100)}`);return s.replace(old,next);}
patch('supabase/functions/_shared/income-calculator-engine.ts',s=>{
 s=replace(s,'const [whole, fraction = ""]','const [whole = "", fraction = ""]');
 const start=s.indexOf('function lineShape('),end=s.indexOf('export function profileIssues');
 if(start<0||end<start)throw new Error('Shape validation section missing');
 s=s.slice(0,start)+s.slice(start,end).replace(/\b(v|j)\.([a-zA-Z]\w*)/g,'$1["$2"]')+s.slice(end);
 s += `\n/** Parse only explicitly sourced limits; blanks and duplicate sizes fail closed. */
export function parseSourcedLimits(text: string): Record<string, string> {
  const limits: Record<string, string> = {};
  for (const row of text.split("\\n").filter((r) => r.trim())) {
    const match = /^\\s*([1-9]\\d?)\\s*=\\s*(\\d+(?:\\.\\d{1,6})?)\\s*$/.exec(row);
    const size = match?.[1], amount = match?.[2];
    if (!size || !amount || Number(size) > 30 || Object.hasOwn(limits, size)) throw new Error("Each limit row requires a unique household size (1–30) and exact amount, without commas.");
    decimal(amount);
    limits[size] = amount;
  }
  if (!Object.keys(limits).length) throw new Error("At least one sourced household-size income limit is required.");
  return limits;
}
`;
 return s;
});
patch('src/components/income-calculator.tsx',s=>{
 s=replace(s,'FREQUENCIES, evaluate,','FREQUENCIES, parseSourcedLimits, evaluate,');
 s=replace(s,'const [loading, setLoading] = useState(false);','const [metadataLoading, setMetadataLoading] = useState(false);\n  const [configurationLoading, setConfigurationLoading] = useState(false);\n  const loading = metadataLoading || configurationLoading;\n  const [metadataError, setMetadataError] = useState("");\n  const [configurationError, setConfigurationError] = useState("");');
 s=replace(s,'const [error, setError] = useState("");','const [error, setError] = useState("");\n  const visibleError = error || metadataError || configurationError;');
 const a=s.indexOf('  useEffect(() => {'),b=s.indexOf('  useEffect(() => {\n    if (!input.tenantId) return;',a);
 if(a<0||b<a)throw new Error('Configuration effects not found');
 const effects=`  useEffect(() => {
    let active = true; setMetadataError(""); setMetadataLoading(true);
    request<Metadata>({ action: "metadata", propertyId: input.propertyId || undefined, unitId: input.unitId || undefined }).then((data) => { if (active) setMetadata(data); }).catch((e: unknown) => { if (active) setMetadataError(e instanceof Error ? e.message : "Could not load portfolio records."); }).finally(() => { if (active) setMetadataLoading(false); });
    return () => { active = false; };
  }, [input.propertyId, input.unitId, reload]);
  useEffect(() => {
    setConfigurationError("");
    // A saved version retains its exact inputs and profiles until explicitly edited.
    if (saved?.id) { setConfigurationLoading(false); return; }
    if (!input.tenantId) { setProfiles([]); setDocuments([]); setSnapshots([]); setConfigurationLoading(false); return; }
    let active = true; setConfigurationLoading(true);
    request<Load>({ action: "load", tenantId: input.tenantId, effectiveDate: input.effectiveDate }).then((data) => {
      if (!active) return; setProfiles(data.profiles); setDocuments(data.documents); setSnapshots(data.snapshots);
      setInput((prev) => ({ ...prev, layers: data.programs.map((p) => prev.layers.find((l) => l.program === p) || newLayer(p)) }));
    }).catch((e: unknown) => { if (active) { setProfiles([]); setConfigurationError(e instanceof Error ? e.message : "Could not load program configuration."); } }).finally(() => { if (active) setConfigurationLoading(false); });
    return () => { active = false; };
  }, [input.tenantId, input.effectiveDate, reload, saved?.id]);
`;
 s=s.slice(0,a)+effects+s.slice(b);
 const parserStart=s.indexOf('    const limits: Record<string, string> = {};'),parserEnd=s.indexOf('    await request({ action: "save_profile"',parserStart);
 if(parserStart<0||parserEnd<parserStart)throw new Error('Limits parser missing');
 s=s.slice(0,parserStart)+'    const limits = parseSourcedLimits(limitsText);\n'+s.slice(parserEnd);
 s=replace(s,'["rules", "Property Rule Setup"]];','["rules", "Property Rule Setup"]] as const;');
 s=s.replaceAll('!!error','!!visibleError');
 s=replace(s,'{error ? <div role="alert"','{visibleError ? <div role="alert"');
 s=replace(s,'<strong>Action required:</strong> {error}','<strong>Action required:</strong> {visibleError}');
 return s;
});
patch('src/components/app-shell.tsx',s=>s.replaceAll('onNavigate?: () => void','onNavigate?: (() => void) | undefined'));
patch('scripts/test-native-income-calculator.mjs',s=>{
 s=replace(s,"'--strict','--skipLibCheck'","'--strict','--noUncheckedIndexedAccess','--noPropertyAccessFromIndexSignature','--exactOptionalPropertyTypes','--noImplicitReturns','--skipLibCheck'");
 return s+`\ntest('sourced limits retain precise decimal values',()=>assert.deepEqual(e.parseSourcedLimits('1=40000\\n2=45000.123456'),{'1':'40000','2':'45000.123456'}));
for(const invalid of ['', '2=45000\\n2=46000','31=50000','2=45,000','2=1e3','2=-100','2=0.1234567','2=10000000000']) test('invalid limits fail closed: '+JSON.stringify(invalid),()=>assert.throws(()=>e.parseSourcedLimits(invalid)));
test('saved version is not overwritten by current configuration fetch',()=>{const ui=readFileSync('src/components/income-calculator.tsx','utf8');assert.ok(ui.includes('if (saved?.id) { setConfigurationLoading(false); return; }'));assert.ok(ui.includes('reload, saved?.id]'));});
test('both pending metadata and configuration requests block saves',()=>{const ui=readFileSync('src/components/income-calculator.tsx','utf8');assert.ok(ui.includes('const loading = metadataLoading || configurationLoading;'));assert.ok(ui.includes('!!visibleError'));});
`;
});
console.log('Calculator strict typing, limits parsing, navigation typing, and saved-version loading repaired.');
