export function segmentPages(pages, cap=6500) {
 if(!Array.isArray(pages)||!pages.length||pages.length>250) throw new Error("PDF_PAGE_LIMIT");
 const segments=[]; let part=[]; let size=0; let wordCount=0;
 for(let page=0;page<pages.length;page++) {
  const words=String(pages[page]).replace(/\s+/g," ").trim().split(" ").filter(Boolean);
  if(words.length<5) throw new Error("PDF_REQUIRES_OCR");
  wordCount+=words.length; if(wordCount>150000) throw new Error("PDF_TEXT_LIMIT");
  for(let i=0;i<words.length;) {
   const take=words.length-i<=20?words.length-i:16;
   const excerpt=words.slice(i,i+take).join(" ");
   const item={id:"p"+(page+1)+"w"+i,page:page+1,excerpt};
   const cost=JSON.stringify(item).length+1;
   if(cost>cap) throw new Error("PDF_TEXT_LIMIT");
   if(size+cost>cap&&part.length){segments.push(part);part=[];size=0;}
   part.push(item);size+=cost;i+=take;
  }
 }
 if(part.length) segments.push(part);
 if(segments.length>100) throw new Error("PDF_TEXT_LIMIT");
 return segments;
}
export function groundedSchema(segment) {
 const item={type:"object",additionalProperties:false,required:["title","summary","steps","evidence_ids","uncertainties"],properties:{
 title:{type:"string"},summary:{type:"string"},steps:{type:"array",items:{type:"string"}},
 evidence_ids:{type:"array",minItems:1,maxItems:8,items:{type:"string",enum:segment.map(x=>x.id)}},
 uncertainties:{type:"array",items:{type:"string"}}}};
 return {type:"object",additionalProperties:false,required:["procedures","notes"],properties:{
 notes:{type:"array",items:{type:"string"}},procedures:{type:"array",maxItems:3,items:item}}};
}
export function groundResult(result,segment,index) {
 if(!result||!Array.isArray(result.procedures)||result.procedures.length>3||!Array.isArray(result.notes)||result.notes.some(x=>typeof x!=="string"||x.length>1000)) throw new Error("INVALID_SEGMENT_RESULT");
 const evidence=new Map(segment.map(x=>[x.id,x]));
 return result.procedures.map((p,i)=>{
  for(const field of ["title","summary"])if(typeof p[field]!=="string"||!p[field].trim()||p[field].length>1500)throw new Error("INVALID_SEGMENT_RESULT");
  for(const field of ["steps","uncertainties"])if(!Array.isArray(p[field])||p[field].some(x=>typeof x!=="string"||x.length>1500))throw new Error("INVALID_SEGMENT_RESULT");
  if(!Array.isArray(p.evidence_ids)||!p.evidence_ids.length||p.evidence_ids.length>8)throw new Error("CITATION_REQUIRED");
  const citations=[...new Set(p.evidence_ids)].map(id=>{
   const source=evidence.get(id);if(!source)throw new Error("CITATION_NOT_IN_SOURCE");
   return {page_or_locator:String(source.page),section:"PDF text segment "+(index+1),excerpt:source.excerpt};
  });
  return {procedure_key:"segment_"+index+"_procedure_"+i,category:"draft_operating_procedure",title:p.title,summary:p.summary,
   steps:p.steps,responsible_roles:[],triggering_events:[],required_inputs:[],required_evidence:[],deadlines:[],exceptions:[],
   citations,ambiguity_flags:[...p.uncertainties,"Unverified AI draft; surrounding pages, tables and complete obligations require independent review."],
   extraction_confidence:0};
 });
}
