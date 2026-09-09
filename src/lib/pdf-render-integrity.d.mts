import type {PDFPageProxy} from 'pdfjs-dist';
export function pdfImageDecodeOptions(version:string,origin:string): {wasmUrl:string;stopAtErrors:boolean};
export class PdfImageDecodeError extends Error { constructor(page:number); }
export function assertRenderedPdfImages(page:PDFPageProxy,ops:{paintImageXObject:number;paintImageXObjectRepeat:number},timeoutMs?:number):Promise<void>;
export function pdfOcrViewport(page:PDFPageProxy,scale:number,maxDimension?:number,maxPixels?:number):ReturnType<PDFPageProxy['getViewport']>;
