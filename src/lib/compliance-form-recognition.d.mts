export type FormRecognition = Readonly<{
  status: "unrecognized" | "ambiguous" | "recognized";
  formCode: string | null;
  confidence: number | null;
  candidates?: readonly string[];
  snippet: string | null;
}>;
export function isRestrictedSensitiveFormCode(formCode: unknown): boolean;
export function recognizeComplianceForm(input?: { fileName?: string; text?: string }): FormRecognition;
export function registryRecognitionDisposition(registryRow: { support_status?: string } | null | undefined): "unsupported" | "outdated" | "recognized";
