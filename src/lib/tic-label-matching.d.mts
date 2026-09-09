export const TIC_LABEL_VARIANTS: Readonly<Record<string, readonly string[]>>;
export type TicLabelHit = {key: string; start: number; end: number; ambiguous: boolean};
export function normalizeTicLabel(text: string): string;
export function findTicLabels(text: string, definitions: readonly {key: string; aliases: readonly string[]}[]): TicLabelHit[];
export function findTicLabelForKey(text: string, key: string): TicLabelHit | null;
