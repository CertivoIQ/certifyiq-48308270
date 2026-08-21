export type YardiImportError = { row: number; field: string; message: string };
export type YardiNormalizedRecord = {
  provider: "Yardi Voyager";
  importMode: "csv_export";
  externalRecordKey: string;
  property: { externalId: string; name: string | null };
  unit: { externalId: string };
  household: { externalId: string; name: string | null; status: string | null };
  certification: { type: string | null; effectiveDate: string | null; annualIncome: number | null };
  sourceRow: number;
};
export type YardiImportResult = {
  provider: "Yardi Voyager";
  source: "csv_export";
  records: YardiNormalizedRecord[];
  errors: YardiImportError[];
  summary: { total: number; accepted: number; rejected: number; duplicates: number };
};
export function importYardiVoyagerCsv(text: string): YardiImportResult;
export function reconcileYardiImport(result: YardiImportResult): {
  provider: string;
  source: string;
  totalsMatch: boolean;
  acceptedKeysUnique: boolean;
  readyToCommit: boolean;
  summary: YardiImportResult["summary"];
};
