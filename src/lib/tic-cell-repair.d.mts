export function selectedCertificationType(text: string): string | null;
export function isTicContent(text: string): boolean;
export function strictMappedValue(type: string, raw: unknown, key?: string): string | number | null;
export function nativePdfLayout(items: readonly unknown[], viewport: { scale?: number; convertToViewportPoint(x: number, y: number): number[] }): { text: string; blocks: unknown[] };
export function amountCents(raw: unknown): bigint;
export function centsText(cents: bigint): string;
export function sumAmounts(values: readonly string[]): string;
export function projectGrossPay(input: { amounts: string[]; frequency: string; policyRef: string }): { annual: string; formula: string; policyRef: string; status: string };
export function calculateTicSums(values: Record<string, string>): { proposals: Record<string, string>; blockers: string[]; status: string };
