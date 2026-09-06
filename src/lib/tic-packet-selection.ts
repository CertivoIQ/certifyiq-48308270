import { classifyPacketPages, type PacketPage, type PacketPageClassification, type SupportingPacketGroup } from '@/lib/tic-packet-classifier';
import { SUPPORTING_DOCUMENT_TYPE_SET, supportingDocumentLabel, type SupportingDocumentType } from '@/lib/tic-supporting-document-registry';

export const PACKET_SELECTION_VERSION = 'tic-packet-selection:1' as const;
export type PacketPageRole = 'pending' | 'tic_page' | 'omit' | SupportingDocumentType;
export type PacketPageChoice = { page: number; role: PacketPageRole; reason: string };
export type PacketPageInventory = PacketPageClassification & { suggestedRole: PacketPageRole; excerpt: string };
export type PacketSelectionManifest = {
  version: typeof PACKET_SELECTION_VERSION;
  sourceSha256: string;
  pageCount: number;
  choices: PacketPageChoice[];
  ticPages: number[];
  supportingPages: number[];
  omittedPages: number[];
};
const roles: ReadonlySet<string> = new Set(['pending', 'tic_page', 'omit', ...SUPPORTING_DOCUMENT_TYPE_SET]);

/** Strict shape/coverage checks; client-provided types never bypass the source page count. */
export function validatePageChoices(input: unknown, pageCount?: number, complete = false): PacketPageChoice[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 300) throw new Error('Select the role of every packet page.');
  const seen = new Set<number>();
  const choices = input.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid packet page selection.');
    const { page, role, reason } = entry as Record<string, unknown>;
    if (typeof page !== 'number' || !Number.isInteger(page) || page < 1 || page > (pageCount ?? 300) || seen.has(page)) throw new Error('Packet selections contain a duplicate or invalid source page.');
    if (typeof role !== 'string' || !roles.has(role)) throw new Error(`Choose a valid role for page ${page}.`);
    if (typeof reason !== 'string' || reason.length > 500) throw new Error(`Page ${page} selection reason must be text of at most 500 characters.`);
    if (complete && role === 'pending') throw new Error(`Page ${page} still needs an include/omit decision.`);
    if (complete && role === 'omit' && !reason.trim()) throw new Error(`Record why page ${page} is omitted from review.`);
    seen.add(page);
    return { page, role: role as PacketPageRole, reason: reason.trim() };
  }).sort((a, b) => a.page - b.page);
  if (pageCount !== undefined && (choices.length !== pageCount || choices.some((c, i) => c.page !== i + 1))) throw new Error('Every source page must have exactly one selection, including unreadable pages.');
  if (complete && !choices.some(c => c.role === 'tic_page')) throw new Error('Select at least one Tenant Income Certification page before extracting TIC fields.');
  return choices;
}

export function packetInventory(pages: readonly PacketPage[]): PacketPageInventory[] {
  return classifyPacketPages(pages).map(c => ({
    ...c,
    suggestedRole: c.kind === 'tic' ? 'tic_page' : c.documentType ?? 'omit',
    excerpt: (pages.find(p => p.page === c.page)?.text ?? '').replace(/^__CERTIVOIQ_TIC_FIELD__.*$/gm, '').replace(/\s+/g, ' ').trim().slice(0, 240),
  }));
}

/** Only a positively recognized TIC is preselected. Every other page awaits the user. */
export function initialPageChoices(inventory: readonly PacketPageInventory[]): PacketPageChoice[] {
  return inventory.map(page => ({ page: page.page, role: page.kind === 'tic' ? 'tic_page' : 'pending', reason: '' }));
}

export function buildPacketSelection(pages: readonly PacketPage[], input: unknown, sha: string): PacketSelectionManifest {
  if (!/^[a-f0-9]{64}$/i.test(sha)) throw new Error('The original packet hash is missing.');
  if (!pages.length || pages.some((p, i) => p.page !== i + 1)) throw new Error('The source page inventory is incomplete.');
  const choices = validatePageChoices(input, pages.length, true);
  const chosen = (predicate: (c: PacketPageChoice) => boolean) => choices.filter(predicate).map(c => c.page);
  return { version: PACKET_SELECTION_VERSION, sourceSha256: sha.toLowerCase(), pageCount: pages.length, choices,
    ticPages: chosen(c => c.role === 'tic_page'), supportingPages: chosen(c => SUPPORTING_DOCUMENT_TYPE_SET.has(c.role as SupportingDocumentType)), omittedPages: chosen(c => c.role === 'omit') };
}

/** Keep original physical page numbers; never renumber selected pages. */
export function selectedTicText(pages: readonly PacketPage[], selection: PacketSelectionManifest): string {
  const selected = new Set(selection.ticPages);
  return pages.filter(p => selected.has(p.page)).map(p => `page ${p.page}\n${p.text}`).join('\n');
}

/** Per-page references avoid merging two adjacent employers/accounts into one document. */
export function selectedSupportingPages(selection: PacketSelectionManifest, inventory: readonly PacketPageInventory[]): SupportingPacketGroup[] {
  return selection.choices.filter(c => SUPPORTING_DOCUMENT_TYPE_SET.has(c.role as SupportingDocumentType)).map(c => {
    const classification = inventory.find(p => p.page === c.page);
    return { id: `selected:${c.page}`, documentType: c.role as SupportingDocumentType, label: supportingDocumentLabel(c.role),
      pageStart: c.page, pageEnd: c.page, pageNumbers: [c.page], confidence: classification?.confidence ?? 0,
      classificationBasis: `User selected ${supportingDocumentLabel(c.role)} on original page ${c.page}. ${c.reason}`.trim() };
  });
}

/** Reconstruct only a stored, source-bound manifest. A malformed manifest is an error, not a fallback. */
export function selectionFromHistory(history: unknown, sourceSha256: string): PacketSelectionManifest | null {
  if (!Array.isArray(history)) return null;
  const entries = history.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object' && 'packet_selection' in entry);
  if (!entries.length) return null;
  const value = entries.at(-1)?.['packet_selection'];
  if (!value || typeof value !== 'object') throw new Error('The saved packet selection cannot be verified.');
  const raw = value as Record<string, unknown>;
  if (raw['version'] !== PACKET_SELECTION_VERSION || typeof raw['sourceSha256'] !== 'string' || raw['sourceSha256'].toLowerCase() !== sourceSha256.toLowerCase() || !Number.isInteger(raw['pageCount']) || Number(raw['pageCount']) < 1 || Number(raw['pageCount']) > 300) throw new Error('The saved selection does not match the source packet.');
  const pages = Array.from({ length: Number(raw['pageCount']) }, (_, i) => ({ page: i + 1, text: '' }));
  return buildPacketSelection(pages, raw['choices'], sourceSha256);
}
