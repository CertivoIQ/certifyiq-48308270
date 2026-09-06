/** Only source-extracted scalar values may cross the editable preview boundary. */
export function previewEvidenceValue(value: unknown): string | number | boolean | null {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new Error("The extracted field is not a supported value. Review the source document before continuing.");
}
