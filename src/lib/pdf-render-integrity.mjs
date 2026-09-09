/** A failed image decode must never become a successful blank-page result. */
export function pdfImageDecodeOptions(version, origin) {
 if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Unsupported PDF decoder version.');
 return {wasmUrl:new URL('/pdfjs/'+version+'/wasm/',origin).href,stopAtErrors:true};
}
export class PdfImageDecodeError extends Error {
 constructor(page) {
  super(`PDF image decoding failed on page ${page}. The page could not be rendered and has not been treated as blank. Retry the upload or route the document for manual intake.`);
  this.name='PdfImageDecodeError';
 }
}
// Operator-list delivery can precede the asynchronous image-resource message.
function decodedImage(objects, resource, pageNumber, timeoutMs) {
 if(objects.has(resource)) return Promise.resolve(objects.get(resource));
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new PdfImageDecodeError(pageNumber)),timeoutMs);
  try { objects.get(resource, value=>{clearTimeout(timer);resolve(value);}); }
  catch(error){clearTimeout(timer);reject(error);}
 });
}
export async function assertRenderedPdfImages(page, ops, timeoutMs = 15_000) {
 const list=await page.getOperatorList();
 const images=new Map();
 for(let i=0;i<list.fnArray.length;i++){
  if(list.fnArray[i]!==ops.paintImageXObject&&list.fnArray[i]!==ops.paintImageXObjectRepeat)continue;
  const resource=list.argsArray[i]?.[0];if(typeof resource!=='string')continue;
  const objects=resource.startsWith('g_')?page.commonObjs:page.objs;
  if(!images.has(resource))images.set(resource,decodedImage(objects,resource,page.pageNumber,timeoutMs));
 }
 const decoded=await Promise.all(images.values());
 if(decoded.some(value=>!value))throw new PdfImageDecodeError(page.pageNumber);
}

/** Some scanner PDFs use image pixels as PDF points. Avoid 100-megapixel OCR canvases. */
export function pdfOcrViewport(page, scale, maxDimension = 4096, maxPixels = 12_000_000) {
 const natural=page.getViewport({scale:1});
 if(!Number.isFinite(natural.width)||!Number.isFinite(natural.height)||natural.width<=0||natural.height<=0)throw new Error('Invalid PDF page dimensions.');
 return page.getViewport({scale:Math.min(scale,maxDimension/Math.max(natural.width,natural.height),Math.sqrt(maxPixels/(natural.width*natural.height)))});
}
