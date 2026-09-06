export function selectedCertificationType(text: string): string | null;
export function isTicContent(text: string): boolean;
export function strictMappedValue(type: string, raw: unknown, key?: string): string | number | null;
export function nativePdfLayout(items: readonly unknown[], viewport: { scale?: number; rotation?: number; convertToViewportPoint(x: number, y: number): number[] }): { text: string; blocks: unknown[] };
export function administrativePageLabel(text: string): string | null;
