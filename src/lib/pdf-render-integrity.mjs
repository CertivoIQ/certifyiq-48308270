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
export async function assertRenderedPdfImages(page, ops) {
 const list=await page.getOperatorList();
 for(let i=0;i<list.fnArray.length;i++){
  if(list.fnArray[i]!==ops.paintImageXObject&&list.fnArray[i]!==ops.paintImageXObjectRepeat)continue;
  const resource=list.argsArray[i]?.[0];if(typeof resource!=='string')continue;
  const objects=resource.startsWith('g_')?page.commonObjs:page.objs;
  if(!objects.has(resource)||!objects.get(resource))throw new PdfImageDecodeError(page.pageNumber);
 }
}
