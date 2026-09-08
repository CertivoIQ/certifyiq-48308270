import { administrativePageLabel, isTicContent } from "@/lib/tic-document-layout.mjs";
import {
  SUPPORTING_DOCUMENT_DEFINITIONS,
  SUPPORTING_DOCUMENT_BY_TYPE,
  TIC_PAGE_SIGNALS,
  type SupportingDocumentType,
} from "@/lib/tic-supporting-document-registry";

export type PacketPage = {
  page: number;
  text: string;
};

export type PacketPageClassification = {
  page: number;
  kind: "tic" | "supporting" | "unclassified";
  documentType: SupportingDocumentType | null;
  label: string;
  confidence: number;
  basis: string;
};

export type SupportingPacketGroup = {
  id: string;
  documentType: SupportingDocumentType;
  label: string;
  pageStart: number;
  pageEnd: number;
  pageNumbers: number[];
  confidence: number;
  classificationBasis: string;
};

function scorePatterns(text: string, patterns: readonly RegExp[]) {
  return patterns.reduce((score, pattern) => score + (pattern.test(text) ? 1 : 0), 0);
}

export function classifyPacketPage(page: PacketPage): PacketPageClassification {
  const text = String(page.text ?? "").trim();
  if (!text) {
    return {
      page: page.page,
      kind: "unclassified",
      documentType: null,
      label: "Unclassified page",
      confidence: 0,
      basis: "No readable page text was available for classification.",
    };
  }

  const administrative = administrativePageLabel(text);
  if (administrative) return { page: page.page, kind: "unclassified", documentType: null, label: administrative, confidence: 0.9, basis: "Administrative heading detected. Awaiting user include/omit decision; not TIC evidence." };
  if (/annual\s+income\s+calculation\s+worksheet/i.test(text)) return {page: page.page, kind: "supporting", documentType: "income_calculation_worksheet", label: "Annual Income Calculation Worksheet", confidence: 0.95, basis: "Income worksheet heading; preserve separately from certified TIC totals."};
  if (isTicContent(text)) return { page: page.page, kind: "tic", documentType: null, label: "Tenant Income Certification", confidence: 0.9, basis: "TIC title or multiple form sections detected. Confirm selected TIC pages before field extraction." };

  let best:
    | { type: SupportingDocumentType; label: string; score: number; strong: number; weak: number }
    | null = null;

  for (const definition of SUPPORTING_DOCUMENT_DEFINITIONS) {
    if (definition.type === "other_supporting_document") continue;
    const strong = scorePatterns(text, definition.strongSignals);
    const weak = scorePatterns(text, definition.weakSignals ?? []);
    const score = strong * 3 + weak;
    if (!best || score > best.score) {
      best = { type: definition.type, label: definition.label, score, strong, weak };
    }
  }

  const ticSignals = scorePatterns(text, TIC_PAGE_SIGNALS);
  if (best && best.strong > 0 && best.score >= 3 && best.score > ticSignals * 2) {
    const confidence = Math.min(0.99, 0.72 + best.strong * 0.1 + Math.min(0.12, best.weak * 0.04));
    return {
      page: page.page,
      kind: "supporting",
      documentType: best.type,
      label: best.label,
      confidence,
      basis: `Matched ${best.strong} strong and ${best.weak} supporting-document signal(s).`,
    };
  }

  if (isTicContent(text)) {
    return {
      page: page.page,
      kind: "tic",
      documentType: null,
      label: "Tenant Income Certification",
      confidence: Math.min(0.99, 0.75 + ticSignals * 0.06),
      basis: `Matched ${ticSignals} Tenant Income Certification signal(s).`,
    };
  }

  return {
    page: page.page,
    kind: "unclassified",
    documentType: null,
    label: "Unclassified packet page",
    confidence: 0.25,
    basis: "No high-confidence TIC or supporting-document signature was found. Review classification before save.",
  };
}

export function classifyPacketPages(pages: readonly PacketPage[]) {
  return [...pages]
    .sort((a, b) => a.page - b.page)
    .map(classifyPacketPage);
}

export function groupSupportingPages(classifications: readonly PacketPageClassification[]): SupportingPacketGroup[] {
  const groups: SupportingPacketGroup[] = [];
  let current: SupportingPacketGroup | null = null;

  for (const classification of [...classifications].sort((a, b) => a.page - b.page)) {
    if (classification.kind === "tic") {
      current = null;
      continue;
    }

    const type = classification.documentType ?? "other_supporting_document";
    const label = SUPPORTING_DOCUMENT_BY_TYPE.get(type)?.label ?? "Other Supporting Document";
    const contiguous = current && current.pageEnd + 1 === classification.page;
    const sameType = current && current.documentType === type;

    if (current && contiguous && sameType) {
      current.pageEnd = classification.page;
      current.pageNumbers.push(classification.page);
      current.confidence = Math.min(current.confidence, classification.confidence);
      current.classificationBasis += ` Page ${classification.page}: ${classification.basis}`;
      continue;
    }

    current = {
      id: `${type}:${classification.page}`,
      documentType: type,
      label,
      pageStart: classification.page,
      pageEnd: classification.page,
      pageNumbers: [classification.page],
      confidence: classification.confidence,
      classificationBasis: `Page ${classification.page}: ${classification.basis}`,
    };
    groups.push(current);
  }

  return groups;
}
