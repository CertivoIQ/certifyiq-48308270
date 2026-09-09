import {supabase} from '@/integrations/supabase/client';
import {VISION_ENGINE,type OcrSidecarPage} from '@/lib/ocr-sidecar.mjs';
export function handwritingReader(source:{jobId:string;sha256:string},progress:(message:string)=>void) {
 return async(canvas:HTMLCanvasElement,page:number):Promise<OcrSidecarPage>=>{
  const scale=Math.min(1,2800/Math.max(canvas.width,canvas.height));
  const image=document.createElement('canvas');image.width=Math.round(canvas.width*scale);image.height=Math.round(canvas.height*scale);
  const ctx=image.getContext('2d');if(!ctx)throw new Error('Could not prepare handwriting image.');
  ctx.drawImage(canvas,0,0,image.width,image.height);
  const width=image.width,height=image.height,dataUrl=image.toDataURL('image/jpeg',0.88);
  image.width=1;image.height=1;
  for(let attempt=0;attempt<3;attempt++){
   progress(`Reading handwritten and printed TIC cells on page ${page}…`);
   const {data,error}=await supabase.functions.invoke('tic-handwriting',{body:{jobId:source.jobId,sourceSha256:source.sha256,page,width,height,image:dataUrl}});
   if(error){
    let detail:{error?:string;retryAfter?:number}={};
    if(error.context instanceof Response){try{detail=await error.context.json();}catch{/* Preserve the service failure. */}}
    if(error.context?.status===429&&attempt<2){const seconds=Math.min(60,Math.max(5,Number(detail.retryAfter)||30));progress(`Handwriting reader is busy. Retrying page ${page} in ${seconds} seconds…`);await new Promise(resolve=>setTimeout(resolve,seconds*1000));continue;}
    throw new Error(detail.error||'Handwriting extraction is unavailable. Retry or use printed-text mode and confirm missing handwritten values manually.');
   }
   if(data?.sourceSha256!==source.sha256||data?.page!==page||data?.engine!==VISION_ENGINE||data?.humanVerified!==false||typeof data?.text!=='string'||data.text.length>100000||!data.text.includes('__CERTIVOIQ_TIC_CELL_MODE__: strict'))throw new Error('The handwriting response could not be verified against this source page.');
   return {page,source:'ocr',engine:VISION_ENGINE,ocrConfidence:0.7,text:data.text};
  }
  throw new Error('Handwriting extraction did not finish.');
 };
}
