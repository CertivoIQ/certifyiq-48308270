const DEFINITIONS = Object.freeze([
  { formCode: "HUD-50059-A", patterns: [/\bHUD[-\s]?50059[-\s]?A\b/i, /\b50059[-\s]?A\b/i] },
  { formCode: "HUD-50059", patterns: [/\bHUD[-\s]?50059\b/i, /\b50059\b/i] },
  { formCode: "HUD-9887-A", patterns: [/\bHUD[-\s]?9887[-\s]?A\b/i, /\b9887[-\s]?A\b/i] },
  { formCode: "HUD-9887", patterns: [/\bHUD[-\s]?9887\b/i, /\b9887\b/i] },
  { formCode: "HUD-9834", patterns: [/\bHUD[-\s]?9834\b/i, /\b9834\b/i] },
  { formCode: "HUD-50058-MTW-EXPANSION", patterns: [/\bHUD[-\s]?50058[-\s]?MTW[-\s]?EXPANSION\b/i, /\b50058[-\s]?MTW[-\s]?EXPANSION\b/i] },
  { formCode: "HUD-50058-MTW", patterns: [/\bHUD[-\s]?50058[-\s]?MTW\b/i, /\b50058[-\s]?MTW\b/i] },
  { formCode: "HUD-50058", patterns: [/\bHUD[-\s]?50058\b/i, /\b50058\b/i] },
  { formCode: "HUD-90105-A", patterns: [/\bHUD[-\s]?90105[-\s]?A\b/i, /\b90105[-\s]?A\b/i] },
  { formCode: "HUD-90105-B", patterns: [/\bHUD[-\s]?90105[-\s]?B\b/i, /\b90105[-\s]?B\b/i] },
  { formCode: "HUD-90105-C", patterns: [/\bHUD[-\s]?90105[-\s]?C\b/i, /\b90105[-\s]?C\b/i] },
  { formCode: "HUD-90105-D", patterns: [/\bHUD[-\s]?90105[-\s]?D\b/i, /\b90105[-\s]?D\b/i] },
  { formCode: "HUD-90100", patterns: [/\bHUD[-\s]?90100\b/i, /\b90100\b/i] },
  { formCode: "HUD-5380", patterns: [/\bHUD[-\s]?5380\b/i, /\b5380\b/i] },
  { formCode: "HUD-5382", patterns: [/\bHUD[-\s]?5382\b/i, /\b5382\b/i] },
  { formCode: "HUD-5383", patterns: [/\bHUD[-\s]?5383\b/i, /\b5383\b/i] },
]);

const RESTRICTED_SENSITIVE_FORM_CODES = new Set(["HUD-5380", "HUD-5382", "HUD-5383"]);

export function isRestrictedSensitiveFormCode(formCode) {
  return RESTRICTED_SENSITIVE_FORM_CODES.has(String(formCode ?? "").toUpperCase());
}

function matchDefinition(value) {
  const text = String(value ?? "");
  return DEFINITIONS.filter((definition) =>
    definition.patterns.some((pattern) => pattern.test(text)),
  );
}

function snippetAround(text, formCode) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  const digits = formCode.replace(/[^0-9A-Z-]/gi, "");
  const token = digits.replace("HUD-", "");
  const index = normalized.toUpperCase().indexOf(token.toUpperCase());
  if (index < 0) return normalized.slice(0, 240);
  return normalized.slice(Math.max(0, index - 90), Math.min(normalized.length, index + token.length + 150));
}

export function recognizeComplianceForm({ fileName = "", text = "" } = {}) {
  const filenameMatches = matchDefinition(fileName);
  const textMatches = matchDefinition(text);
  const byCode = new Map();

  for (const match of filenameMatches) byCode.set(match.formCode, { formCode: match.formCode, filename: true, text: false });
  for (const match of textMatches) {
    const existing = byCode.get(match.formCode) ?? { formCode: match.formCode, filename: false, text: false };
    existing.text = true;
    byCode.set(match.formCode, existing);
  }

  // Avoid counting a base form when a more specific form variant was found.
  for (const code of [...byCode.keys()]) {
    if (code.endsWith("-A")) byCode.delete(code.slice(0, -2));
    if (code === "HUD-50058-MTW-EXPANSION") {
      byCode.delete("HUD-50058-MTW");
      byCode.delete("HUD-50058");
    } else if (code === "HUD-50058-MTW") {
      byCode.delete("HUD-50058");
    }
  }

  const matches = [...byCode.values()];
  if (matches.length === 0) {
    return Object.freeze({ status: "unrecognized", formCode: null, confidence: null, snippet: null });
  }
  if (matches.length > 1) {
    return Object.freeze({
      status: "ambiguous",
      formCode: null,
      confidence: 0.5,
      candidates: matches.map((item) => item.formCode).sort(),
      snippet: null,
    });
  }

  const match = matches[0];
  const confidence = match.filename && match.text ? 0.99 : match.text ? 0.97 : 0.92;
  return Object.freeze({
    status: "recognized",
    formCode: match.formCode,
    confidence,
    candidates: [match.formCode],
    snippet: isRestrictedSensitiveFormCode(match.formCode) ? null : snippetAround(text, match.formCode),
  });
}

export function registryRecognitionDisposition(registryRow) {
  if (!registryRow) return "unsupported";
  if (registryRow.support_status === "superseded") return "outdated";
  if (registryRow.support_status === "unsupported") return "unsupported";
  return "recognized";
}
