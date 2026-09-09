import {MAX_OCR_PAGES,OCR_TIME_BUDGET_MS} from './ocr-sidecar.mjs';
/** Allow supported packets to finish on smaller devices without an unbounded run. */
export function ocrTimeBudgetMs(pageCount,workerCount) {
 if(!Number.isInteger(pageCount)||pageCount<1||pageCount>MAX_OCR_PAGES||!Number.isInteger(workerCount)||workerCount<1||workerCount>3)throw new Error('Invalid OCR processing budget inputs.');
 return Math.min(15*60_000,Math.max(OCR_TIME_BUDGET_MS,Math.ceil(pageCount/workerCount)*30_000));
}
