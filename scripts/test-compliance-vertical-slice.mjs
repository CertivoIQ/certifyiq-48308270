import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ENGINE_BUILD,
  FEDERAL_LIHTC_PACK,
  FINDING_STATUS,
  evaluateCertification,
  isStatePackUsable,
  signOffAllowed,
} from '../src/lib/compliance-rule-engine.mjs';

const CERTIFICATION_TEXT = [
  'Page 1',
  'Tenant Signature Date: 2026-03-01',
  'Certification Effective Date: 2026-03-05',
  'Household Annual Income: $42,500',
  'Page 2',
  '60% Income Limit: $48,900',
  'Household Net Assets: $12,000',
  'HOTMA Asset Cap: $100,000',
  'Gross Rent: 1,150',
  'State Maximum Gross Rent: 1,300',
  'Utility Allowance Source: State agency schedule 2026',
].join('\n');

/** Mirrors the deterministic server-side label parser for a Node-runnable test. */
function extract(text) {
  const labels = {
    tenant_signature_date: 'tenant signature date',
    certification_effective_date: 'certification effective date',
    household_annual_income: 'household annual income',
    income_limit_60_pct: '60% income limit',
    household_net_assets: 'household net assets',
    hotma_asset_cap: 'hotma asset cap',
    gross_rent: 'gross rent',
    state_max_gross_rent: 'state maximum gross rent',
    utility_allowance_source: 'utility allowance source',
  };
  const numeric = new Set([
    'household_annual_income',
    'income_limit_60_pct',
    'household_net_assets',
    'hotma_asset_cap',
    'gross_rent',
    'state_max_gross_rent',
  ]);
  const lines = text.split('\n');
  let page = 1;
  const facts = [];
  for (const line of lines) {
    const marker = /^page\s+(\d+)/i.exec(line.trim());
    if (marker) {
      page = Number(marker[1]);
      continue;
    }
    for (const [field, label] of Object.entries(labels)) {
      const lower = line.toLowerCase();
      if (!lower.startsWith(label)) continue;
      const raw = line.slice(line.indexOf(':') + 1).trim();
      const value = numeric.has(field) ? Number(raw.replace(/[$,]/g, '')) : raw;
      facts.push({
        field,
        value,
        sourceDocumentRef: 'tic-2026-03.txt',
        page,
        snippet: line.trim(),
        confidence: 0.99,
        humanVerified: false,
        requiredForDecision: true,
        provider: 'deterministic-text',
      });
    }
  }
  return facts;
}

test('extraction attaches a document/page citation to every fact', () => {
  const facts = extract(CERTIFICATION_TEXT);
  assert.equal(facts.length, 9);
  for (const fact of facts) {
    assert.equal(fact.sourceDocumentRef, 'tic-2026-03.txt');
    assert.ok(fact.page >= 1);
    assert.ok(fact.snippet.length > 0);
  }
  assert.equal(facts.find((fact) => fact.field === 'income_limit_60_pct').page, 2);
});

test('a complete compliant file passes federal rules and blocks the state rule', () => {
  const result = evaluateCertification({ facts: extract(CERTIFICATION_TEXT), jurisdiction: 'TX' });
  assert.equal(result.engineBuild, ENGINE_BUILD);
  assert.equal(result.rulePackVersion, FEDERAL_LIHTC_PACK.version);
  assert.equal(result.statePackApplied, false);
  assert.equal(result.counts.pass, 3);
  assert.equal(result.counts.fail, 0);
  // Guardrail: no validated state pack ⇒ UNABLE_TO_DETERMINE, never a guess.
  const stateFinding = result.findings.find((finding) => finding.ruleId === 'STATE-QAP-UTILITY-ALLOWANCE');
  assert.equal(stateFinding.status, FINDING_STATUS.unableToDetermine);
  assert.match(stateFinding.blockingReasons[0], /validated state-specific rule pack/i);
  assert.equal(signOffAllowed(result), false);
});

test('a validated state pack unlocks the state-specific determination', () => {
  const statePack = {
    code: 'TX',
    status: 'validated',
    version: '2026-01-01',
    approvedBy: 'reviewer-1',
    effectiveFrom: '2026-01-01',
    validatedRuleCount: 12,
  };
  assert.equal(isStatePackUsable(statePack), true);
  assert.equal(isStatePackUsable({ ...statePack, approvedBy: null }), false);
  const result = evaluateCertification({ facts: extract(CERTIFICATION_TEXT), jurisdiction: 'TX', statePack });
  assert.equal(result.statePackApplied, true);
  assert.equal(result.counts.pass, 4);
  assert.equal(signOffAllowed(result), true);
});

test('a real violation is a deterministic FAIL with evidence references', () => {
  const facts = extract(CERTIFICATION_TEXT).map((fact) =>
    fact.field === 'household_annual_income' ? { ...fact, value: 61000 } : fact,
  );
  const result = evaluateCertification({ facts });
  const finding = result.findings.find((entry) => entry.ruleId === 'LIHTC-INCOME-LIMIT-60');
  assert.equal(finding.status, FINDING_STATUS.fail);
  assert.equal(finding.evidenceRefs.length, 2);
  assert.equal(finding.evidenceRefs[0].documentRef, 'tic-2026-03.txt');
  assert.equal(finding.ruleVersion, '1.0.0');
});

test('missing or low-confidence evidence yields UNABLE_TO_DETERMINE, not a guess', () => {
  const withoutLimit = extract(CERTIFICATION_TEXT).filter((fact) => fact.field !== 'income_limit_60_pct');
  const missing = evaluateCertification({ facts: withoutLimit }).findings.find(
    (finding) => finding.ruleId === 'LIHTC-INCOME-LIMIT-60',
  );
  assert.equal(missing.status, FINDING_STATUS.unableToDetermine);
  assert.match(missing.blockingReasons[0], /missing from the submitted evidence/i);

  const lowConfidence = extract(CERTIFICATION_TEXT).map((fact) =>
    fact.field === 'household_annual_income' ? { ...fact, confidence: 0.4 } : fact,
  );
  const blocked = evaluateCertification({ facts: lowConfidence }).findings.find(
    (finding) => finding.ruleId === 'LIHTC-INCOME-LIMIT-60',
  );
  assert.equal(blocked.status, FINDING_STATUS.unableToDetermine);
  assert.match(blocked.blockingReasons[0], /confidence policy/i);

  const verified = lowConfidence.map((fact) =>
    fact.field === 'household_annual_income' ? { ...fact, humanVerified: true } : fact,
  );
  assert.equal(
    evaluateCertification({ facts: verified }).findings.find((finding) => finding.ruleId === 'LIHTC-INCOME-LIMIT-60')
      .status,
    FINDING_STATUS.pass,
  );
});
