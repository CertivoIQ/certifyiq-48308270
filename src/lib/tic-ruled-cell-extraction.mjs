/** Bounded, image-backed TIC cell proposals. Never repairs letters or invents hidden values. */
const FIELD='__CERTIVOIQ_TIC_FIELD__';
export const BLOCKED='__CERTIVOIQ_TIC_UNRESOLVED__';
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
export function ocrLines(blocks){return (Array.isArray(blocks)?blocks:[]).flatMap(b=>(b.paragraphs??[]).flatMap(p=>p.lines??[])).filter(l=>l.bbox&&l.words?.length).sort((a,b)=>a.bbox.y0-b.bbox.y0);}
const wordsOf=blocks=>ocrLines(blocks).flatMap(l=>l.words).filter(w=>w.bbox);
function group(values,gap=2){const out=[];for(const v of values){const last=out.at(-1);if(last&&v-last.at(-1)<=gap)last.push(v);else out.push([v]);}return out;}
export function rasterMask(image){
 const {width:w,height:h,data}=image;
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<50||h<50||w*h>16000000||data.length!==w*h*4)throw new Error('Unsupported cell image dimensions.');
 const mask=new Uint8Array(w*h);
 for(let i=0;i<mask.length;i++){const k=i*4;mask[i]=(data[k+3]>180&&(data[k]*.299+data[k+1]*.587+data[k+2]*.114)<130)?1:0;}
 return {w,h,mask};
}
function bound(r,b){return {x0:Math.max(0,Math.floor(b.x0)),y0:Math.max(0,Math.floor(b.y0)),x1:Math.min(r.w,Math.ceil(b.x1)),y1:Math.min(r.h,Math.ceil(b.y1))};}
function redacted(r,b){
 b=bound(r,b);const minWidth=Math.max(35,r.w*.025), minHeight=Math.max(9,r.h*.004);let consecutive=0;
 for(let y=b.y0;y<b.y1;y++){let run=0,max=0;for(let x=b.x0;x<b.x1;x++){run=r.mask[y*r.w+x]?run+1:0;max=Math.max(max,run);} consecutive=max>=minWidth?consecutive+1:0;if(consecutive>=minHeight)return true;}
 return false;
}
function contentBounds(r,b){
 b=bound(r,b);let minX=b.x1,minY=b.y1,maxX=b.x0,maxY=b.y0;
 for(let y=b.y0;y<b.y1;y++){let row=[];for(let x=b.x0;x<b.x1;x++)if(r.mask[y*r.w+x])row.push(x);
  const runs=group(row,1),thinRules=runs.filter(g=>g.length>Math.max(45,(b.x1-b.x0)*.65));
  for(const x of row){if(thinRules.some(g=>x>=g[0]&&x<=g.at(-1)))continue;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 }
 return minX<=maxX&&minY<=maxY?bound(r,{x0:minX-2,x1:maxX+3,y0:minY-2,y1:maxY+3}):null;
}
function hasInk(r,b){b=bound(r,b);let n=0;for(let y=b.y0;y<b.y1;y++)for(let x=b.x0;x<b.x1;x++)n+=r.mask[y*r.w+x];return n>Math.max(12,(b.x1-b.x0)*(b.y1-b.y0)*.007);}
function verticals(r,y0,y1){
 const hits=[];for(let x=Math.floor(r.w*.03);x<r.w*.98;x++){let n=0;for(let y=y0;y<y1;y++)n+=r.mask[y*r.w+x];if(n/(y1-y0)>.53)hits.push(x);}
 return group(hits,Math.max(2,Math.round(r.w/900))).filter(g=>g.length<r.w*.014).map(g=>Math.round(g.reduce((a,b)=>a+b)/g.length));
}
function horizontals(r,x0,x1,y0,y1){
 const radius=Math.max(2,Math.round(r.h/800)),hits=[],colCounts=new Uint16Array(x1-x0);
 // Sliding vertical dilation tolerates small scan skew without inferring row positions.
 for(let yy=Math.max(0,y0-radius);yy<=Math.min(r.h-1,y0+radius);yy++)for(let x=x0;x<x1;x++)colCounts[x-x0]+=r.mask[yy*r.w+x];
 for(let y=y0;y<y1;y++){
  let n=0;for(const c of colCounts)if(c)n++;
  if(n/(x1-x0)>.90)hits.push(y);
  const leaving=y-radius,entering=y+radius+1;
  for(let x=x0;x<x1;x++){if(leaving>=0)colCounts[x-x0]-=r.mask[leaving*r.w+x];if(entering<r.h)colCounts[x-x0]+=r.mask[entering*r.w+x];}
 }
 return group(hits,2).map(g=>Math.round((g[0]+g.at(-1))/2));
}
function labelMatch(line,re){
 const words=[...line.words].sort((a,b)=>a.bbox.x0-b.bbox.x0);let text='',spans=[];
 for(const word of words){if(text)text+=' ';spans.push({start:text.length,end:text.length+word.text.length,word});text+=word.text;}
 const m=re.exec(text);if(!m)return null;
 const hit=spans.filter(s=>s.end>m.index&&s.start<m.index+m[0].length);
 return {x0:hit[0].word.bbox.x0,x1:hit.at(-1).word.bbox.x1,y0:Math.min(...hit.map(s=>s.word.bbox.y0)),y1:Math.max(...hit.map(s=>s.word.bbox.y1)),match:m[0],words,tail:spans.filter(s=>s.start>=m.index+m[0].length).map(s=>s.word)};
}
export function planTicCells(image,blocks){
 const r=rasterMask(image),lines=ocrLines(blocks),sourceWords=wordsOf(blocks),cells=[],blocked=[],groups=[];
 const add=(key,b,type='text',extra={})=>{b=bound(r,b);if(b.x1-b.x0<8||b.y1-b.y0<8)return; if(redacted(r,b)){blocked.push(key);return;} cells.push({key,bbox:b,contentBox:contentBounds(r,b),type,ink:hasInk(r,b),sourceWords:sourceWords.filter(w=>{const x=(w.bbox.x0+w.bbox.x1)/2,y=(w.bbox.y0+w.bbox.y1)/2;return x>=b.x0&&x<=b.x1&&y>=b.y0&&y<=b.y1;}),...extra});};
 const find=re=>lines.find(l=>re.test(l.text));
 const household=find(/HOUSEHOLD\s+COMPOSITION/i),income=find(/GROSS\s+ANNUAL\s+INCOME/i),assets=find(/INCOME\s+FROM\s+ASSETS/i);
 const profiles=[
  {start:household,end:income,part:'household',count:8,max:10,labels:[/last\s+name/i,/first\s+name/i,/date\s+of\s+birth/i],keys:['number','last_name','first_name_middle_initial','relationship','date_of_birth','full_time_student','ssn_or_alien_registration'],types:['number','text','text','text','date','yes_no','text']},
  {start:income,end:assets,part:'income',count:6,max:10,labels:[/employment|wages/i,/social\s+security/i,/public\s+assistance/i],keys:['household_member_number','wages_business','social_security_pension','public_assistance','other_income'],types:['number','currency','currency','currency','currency']},
  {start:assets,end:find(/HOUSEHOLD\s+CERTIFICATION\s*&?\s*SIGNATURES/i),part:'asset',count:6,max:27,labels:[/type\s+of\s+asset/i,/cash\s+value/i,/annual\s+income\s+from\s+asset/i],keys:['household_member_number','type','current_disposed','cash_value','annual_income'],types:['number','text','text','currency','currency']},
 ];
 for(const p of profiles){
  if(!p.start||!p.end||p.end.bbox.y0<=p.start.bbox.y1)continue;
  const y0=Math.ceil(p.start.bbox.y1+2),sectionLines=lines.filter(l=>l.bbox.y0>y0&&l.bbox.y0<p.end.bbox.y0);
  const stop=sectionLines.find(l=>/TOTALS\b/i.test(l.text));
  const y1=Math.floor(stop?stop.bbox.y0-r.h*.006:p.end.bbox.y0-r.h*.01);
  const header=sectionLines.filter(l=>l.bbox.y0<y0+r.h*.058).map(l=>l.text).join(' ');
  if(!p.labels.every(re=>re.test(header))||y1-y0<r.h*.05)continue;
  const xs=verticals(r,y0,y1);if(xs.length!==p.count)continue;
  const ys=horizontals(r,xs[0],xs.at(-1),Math.max(0,y0-8),Math.min(r.h,y1+Math.round(r.h*.015)));
  if(ys.length<3)continue;
  // The first bounded row is a multiline header, not a household member.
  const headerRow=ys.findIndex((v,i)=>i<ys.length-1&&(ys[i+1]-v)>r.h*.018);
  if(headerRow<0)continue;
  const body=ys.slice(headerRow+1);let row=0;
  for(let i=0;i<body.length-1&&row<p.max;i++){
   const top=body[i],bottom=body[i+1];if(bottom-top<r.h*.007||bottom-top>r.h*.025)continue;
   // A totals row can sit below the last grid line; it is not a member row.
   if(stop&&top>=stop.bbox.y0-r.h*.004)break;
   const pad=Math.max(3,Math.round(r.h*.0016)),region={x0:xs[0]+pad,y0:top+pad,x1:xs.at(-1)-pad,y1:bottom-pad};
   const bodyWords=wordsOf(blocks).filter(w=>w.bbox.y0>=top-3&&w.bbox.y1<=bottom+5&&w.bbox.x0>xs[1]+pad&&w.bbox.x1<xs.at(-1)-pad);
   // Blank preprinted row numbers alone do not create people or zero-income rows.
   const nonNumberInk=hasInk(r,{...region,x0:xs[1]+pad});
   if(!nonNumberInk&&!bodyWords.length)continue;
   row++;
   const id=`${p.part}:${row}`;groups.push({id,part:p.part,row});
   for(let c=0;c<xs.length-1;c++){
    const prefix=p.part==='household'?`household_member_${row}_`:p.part==='income'?`income_member_${row}_`:`asset_${row}_`;
    add(prefix+p.keys[c],{x0:xs[c]+pad,x1:xs[c+1]-pad,y0:top+pad,y1:bottom-pad},p.types[c],{group:id,column:c});
   }
  }
 }
 // Value regions are bounded by their printed labels, not global template coordinates.
 const headerFields=[['certification_effective_date',/effective\s+date\s*:/i,'date'],['move_in_date',/move[- ]in\s+date\s*:/i,'date'],['property_name',/property\s+name\s*:/i,'text'],['county',/county\s*:/i,'text'],['building_identification_number',/BIN\s*#\s*:/i,'text'],['unit_number',/unit\s+number\s*:/i,'text'],['unit_bedrooms',/#?\s*bedrooms\s*:/i,'number']];
 for(const [key,re,type] of headerFields){
  const line=lines.find(l=>(!household||l.bbox.y0<household.bbox.y0)&&re.test(l.text));if(!line)continue;
  const m=labelMatch(line,re);if(!m)continue;
  const next=headerFields.map(([,other])=>labelMatch(line,other)).filter(n=>n&&n.x0>m.x1).sort((a,b)=>a.x0-b.x0)[0];
  const x1=next?next.x0-8:Math.min(r.w*.955,Math.max(m.x1+r.w*.08,line.bbox.x1+12));
  add(key,{x0:m.x1+4,x1,y0:m.y0-3,y1:Math.max(m.y1,line.bbox.y1)+3},type);
 }
 // A partial address redaction prevents the whole address from being represented as exact.
 const address=lines.find(l=>(!household||l.bbox.y0<household.bbox.y0)&&/address/i.test(l.text));
 if(address){const m=labelMatch(address,/address/i);const stop=labelMatch(address,/unit\s+number/i);if(m&&stop){const b={x0:m.x0,x1:stop.x0-8,y0:address.bbox.y0-3,y1:address.bbox.y1+3};if(redacted(r,b))blocked.push('property_address');}}
 const numberFields=[['total_income_e',/TOTAL\s+INCOME\s*\([A-Z][A-Z]?\)/i],['household_annual_income',/Total\s+Annual\s+Household\s+Income/i],['applicable_lihtc_income_limit',/Current\s+Income\s+Limit\s+per\s+Family\s+Size/i],['tenant_paid_rent',/Tenant\s+Paid\s+Rent/i],['utility_allowance',/Utility\s+Allowance/i],['rent_assistance',/Rental\s+Assistance\s*:/i],['other_non_optional_charges',/Other\s+non-optional\s+charges\s+and\s+mandatory\s+fees/i],['gross_rent',/Gross\s+Rent\s+For\s+Unit/i],['total_income_assets_m',/TOTAL\s+INCOME\s+FROM\s+ASSETS\s*\(K\)/i]];
 for(const [key,re] of numberFields){
  const line=lines.find(l=>re.test(l.text));if(!line)continue;const m=labelMatch(line,re);if(!m)continue;
  const money=m.tail.filter(w=>/^\$?\d[\d,]*\.\d{2}$/.test(w.text));
  if(money.length!==1)continue;const b=money[0].bbox;
  add(key,{x0:b.x0-5,x1:b.x1+6,y0:b.y0-4,y1:b.y1+4},'currency');
 }
 return {version:1,width:r.w,height:r.h,cells:cells.slice(0,90),blocked:[...new Set([...blocked,...cells.slice(90).map(c=>c.key)])],groups,checkboxes:certificationCheckboxes(r,lines)};
}
function certificationCheckboxes(r,lines){
 const line=lines.find(l=>/initial\s+certification/i.test(l.text)&&/recertification/i.test(l.text)&&/other/i.test(l.text));
 if(!line)return null; const b=bound(r,{x0:Math.max(0,line.bbox.x0-15),x1:line.bbox.x1+15,y0:line.bbox.y0-8,y1:line.bbox.y1+8}),seen=new Uint8Array((b.x1-b.x0)*(b.y1-b.y0)),components=[];
 const width=b.x1-b.x0,inside=(x,y)=>x>=b.x0&&x<b.x1&&y>=b.y0&&y<b.y1;
 for(let y=b.y0;y<b.y1;y++)for(let x=b.x0;x<b.x1;x++){
  let at=(y-b.y0)*width+x-b.x0;if(seen[at]||!r.mask[y*r.w+x])continue;
  let stack=[[x,y]],xs=[],ys=[];seen[at]=1;
  while(stack.length){const [xx,yy]=stack.pop();xs.push(xx);ys.push(yy);for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=xx+dx,ny=yy+dy;if(!inside(nx,ny))continue;at=(ny-b.y0)*width+nx-b.x0;if(!seen[at]&&r.mask[ny*r.w+nx]){seen[at]=1;stack.push([nx,ny]);}}}
  const c={x0:Math.min(...xs),x1:Math.max(...xs)+1,y0:Math.min(...ys),y1:Math.max(...ys)+1};const w=c.x1-c.x0,h=c.y1-c.y0;
  if(w>=r.h*.005&&w<r.h*.016&&h>=r.h*.005&&h<r.h*.016&&w/h>.75&&w/h<1.3){
   const inset=Math.max(3,Math.round(w*.23));let n=0,total=0;for(let yy=c.y0+inset;yy<c.y1-inset;yy++)for(let xx=c.x0+inset;xx<c.x1-inset;xx++){n+=r.mask[yy*r.w+xx];total++;} components.push({...c,fill:n/Math.max(1,total)});
  }
 }
 const selections=[];
 for(const [label,re]of[['Initial Certification',/initial\s+certification/i],['Recertification',/recertification/i],['Other',/other/i]]){
  const m=labelMatch(line,re);if(!m)return null;const candidates=components.filter(c=>c.x0>=m.x0-r.h*.02&&c.x1<=m.x0+r.h*.018&&Math.abs((c.y0+c.y1)/2-(m.y0+m.y1)/2)<r.h*.008);
  if(candidates.length!==1)return null;selections.push({label,...candidates[0]});
 }
 const selected=selections.filter(c=>c.fill>=.09);return {candidates:selections,selected:selected.length===1&&selections.filter(c=>c.fill<.02).length===2?selected[0].label:null};
}
export function cellSheetLayout(plan){
 const tiles=[];let y=0;
 for(const cell of plan.cells){if(!cell.ink||!cell.contentBox)continue;
  const b=cell.contentBox,scale=Math.min(2.3,38/Math.max(14,b.y1-b.y0),760/(b.x1-b.x0));
  const height=Math.ceil((b.y1-b.y0)*scale);
  tiles.push({...cell,bbox:b,x:148,y:y+24,width:Math.ceil((b.x1-b.x0)*scale),height,scale});
  y+=Math.max(88,height+48);
 }
 return {width:940,height:Math.max(1,y),tiles};
}
function normalizedCell(type,words,minConfidence){
 const selected=words.filter(w=>clean(w.text));
 let text=clean(selected.map(w=>w.text).join(' '));
 const confidence=selected.length?Math.min(...selected.map(w=>Number(w.confidence??0))):0;
 if(type==='currency')text=text.replace(/^\$\s*/,'');
 if(type==='yes_no'){if(/^N$/i.test(text))text='No';else if(/^Y$/i.test(text))text='Yes';}
 let valid=confidence>=minConfidence&&!!text;
 if(type==='currency')valid=valid&&/^(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}$/.test(text);
 if(type==='number')valid=valid&&/^\d+$/.test(text);
 if(type==='date')valid=valid&&/^(?:\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})$/.test(text);
 if(type==='yes_no')valid=valid&&/^(?:Yes|No)$/.test(text);
 return valid?{text,confidence:confidence/100}:null;
}
export function finishTicCells(plan,sheet,blocks){
 const words=wordsOf(blocks),out=plan.groups.length||plan.cells.length>=3?['__CERTIVOIQ_TIC_CELL_MODE__: strict']:[],unresolved=new Set(plan.blocked),values=new Map(),evidence={};
 for(const tile of sheet.tiles){
  const selected=words.filter(w=>{const y=(w.bbox.y0+w.bbox.y1)/2;return w.bbox.x0>=tile.x-3&&y>=tile.y-4&&y<=tile.y+tile.height+4;}).sort((a,b)=>a.bbox.x0-b.bbox.x0);
  let parsed=normalizedCell(tile.type,selected,70),method='isolated-cell';
  // Missing single characters may be recovered only from an exact, higher-confidence
  // original word IN THIS SAME CELL. No substitution of |/]/O/l or neighboring fields.
  if(!parsed){parsed=normalizedCell(tile.type,tile.sourceWords??[],80);method='bounded-page-word';}
  if(!parsed){unresolved.add(tile.key);continue;}
  values.set(tile.key,parsed.text);
  evidence[tile.key]={bbox:tile.bbox,pageWidth:plan.width,pageHeight:plan.height,confidence:parsed.confidence,method};
 }
 // Household physical row position is not the member identifier. Use only an
 // explicit source member number; preserve multiple income/accounts for that member.
 const remapped=new Map(),seenHouseholds=new Set();
 for(const g of plan.groups){
  const prefix=g.part==='household'?`household_member_${g.row}_`:g.part==='income'?`income_member_${g.row}_`:`asset_${g.row}_`;
  const member=values.get(prefix+(g.part==='household'?'number':'household_member_number'));
  const groupCells=plan.cells.filter(c=>c.group===g.id);
  if(!/^(?:10|[1-9])$/.test(member??'')){
   for(const c of groupCells){values.delete(c.key);unresolved.add(c.key);}continue;
  }
  if(g.part!=='household')continue;
  const data=groupCells.filter(c=>c.column>0&&values.has(c.key));
  if(!data.length){for(const c of groupCells){values.delete(c.key);unresolved.delete(c.key);}continue;}
  const target=`household_member_${member}_`;
  for(const c of groupCells){const newKey=target+c.key.slice(prefix.length);
   if(values.has(c.key)&&c.column>0){if(seenHouseholds.has(member))unresolved.add(newKey);else{remapped.set(newKey,values.get(c.key));evidence[newKey]=evidence[c.key];}}
   if(unresolved.has(c.key)){unresolved.delete(c.key);unresolved.add(newKey);}
   values.delete(c.key);
  }
  seenHouseholds.add(member);
 }
 for(const [key,val]of remapped)values.set(key,val);
 if(plan.checkboxes?.selected){values.set('certification_type',plan.checkboxes.selected);const selected=plan.checkboxes.candidates.find(c=>c.label===plan.checkboxes.selected);evidence.certification_type={bbox:{x0:selected.x0,y0:selected.y0,x1:selected.x1,y1:selected.y1},pageWidth:plan.width,pageHeight:plan.height,confidence:.85,method:'checkbox-interior'};}
 else if(plan.checkboxes)unresolved.add('certification_type');
 for(const key of unresolved)values.delete(key);
 for(const [key,value]of values){if(key.endsWith('_number')&&key.startsWith('household_member_'))continue;
  out.push(`${FIELD} ${key}: ${value}`);
  if(evidence[key])out.push(`__CERTIVOIQ_TIC_CELL__ ${key}: ${JSON.stringify(evidence[key])}`);
 }
 for(const key of unresolved){if(key.endsWith('_number')&&key.startsWith('household_member_'))continue;out.push(`${BLOCKED} ${key}: Source cell is redacted, unreadable, or ambiguous.`);}
 return {lines:out,values:Object.fromEntries(values),unresolved:[...unresolved],evidence};
}

/** New image-backed values and unresolved cells take precedence, per field, only
 * over loose spatial guesses. Native PDF field values are handled by the caller. */
export function mergeCellProposals(spatialLines,cellLines){
 if(cellLines.includes('__CERTIVOIQ_TIC_CELL_MODE__: strict'))return cellLines;
 const keys=new Set(cellLines.map(line=>/^__CERTIVOIQ_TIC_(?:FIELD|UNRESOLVED)__\s+([a-z0-9_]+):/.exec(line)?.[1]).filter(Boolean));
 return [...spatialLines.filter(line=>!keys.has(/^__CERTIVOIQ_TIC_FIELD__\s+([a-z0-9_]+):/.exec(line)?.[1])),...cellLines];
}
