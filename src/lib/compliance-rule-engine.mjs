/**
 * Deterministic compliance rule engine.
 *
 * AI never decides compliance. Extraction may propose facts; only the code in
 * this module turns facts into PASS / FAIL / UNABLE_TO_DETERMINE.
 *
 * Guardrails enforced here:
 *  - A rule marked `jurisdiction: 'state'` is only evaluated when a validated,
 *    approved, versioned state pack is supplied. Otherwise the finding is
 *    UNABLE_TO_DETERMINE with a federal-baseline blocking reason.
 *  - Any required fact that is missing, unparsable, or below the confidence
 *    policy without human verification yields UNABLE_TO_DETERMINE — never a
 *    guessed PASS or FAIL.
 */

export const ENGINE_BUILD = 'rule-engine-2026.08.1';
export const MINIMUM_CONFIDENCE = 0.85;

export const FINDING_STATUS = Object.freeze({
  pass: 'PASS',
  fail: 'FAIL',
  unableToDetermine: 'UNABLE_TO_DETERMINE',
});

/**
 * Federal LIHTC / HOTMA baseline pack. Versioned; citations point at the
 * controlling federal source. This pack is jurisdiction-independent.
 */
export const FEDERAL_LIHTC_PACK = Object.freeze({
  id: 'federal-lihtc-hotma',
  version: '2026.08.1',
  jurisdiction: 'US',
  status: 'validated',
  effectiveFrom: '2026-01-01',
  rules: Object.freeze([
    {
      id: 'LIHTC-TIC-SIGNATURE',
      version: '1.0.0',
      jurisdiction: 'federal',
      severity: 'critical',
      requires: ['tenant_signature_date', 'certification_effective_date'],
      citation: '26 U.S.C. 42(g); IRS Form 8823 Guide, Ch. 4',
      description: 'The tenant income certification must be signed on or before its effective date.',
      evaluate: (facts) => {
        const signed = Date.parse(String(facts.tenant_signature_date.value));
        const effective = Date.parse(String(facts.certification_effective_date.value));
        if (Number.isNaN(signed) || Number.isNaN(effective)) {
          return { status: FINDING_STATUS.unableToDetermine, explanation: 'Signature or effective date could not be parsed as a date.' };
        }
        return signed <= effective
          ? { status: FINDING_STATUS.pass, explanation: 'Certification was signed on or before the effective date.' }
          : { status: FINDING_STATUS.fail, explanation: 'Certification was signed after its effective date.' };
      },
    },
    {
      id: 'LIHTC-INCOME-LIMIT-60',
      version: '1.0.0',
      jurisdiction: 'federal',
      severity: 'critical',
      requires: ['household_annual_income', 'income_limit_60_pct'],
      citation: '26 U.S.C. 42(g)(1)(B); HUD MTSP income limits',
      description: 'Household annual income must not exceed the applicable 60% AMI limit at certification.',
      evaluate: (facts) => {
        const income = Number(facts.household_annual_income.value);
        const limit = Number(facts.income_limit_60_pct.value);
        if (!Number.isFinite(income) || !Number.isFinite(limit) || limit <= 0) {
          return { status: FINDING_STATUS.unableToDetermine, explanation: 'Income or applicable income limit is not a usable number.' };
        }
        return income <= limit
          ? { status: FINDING_STATUS.pass, explanation: `Household income ${income} is within the 60% limit ${limit}.` }
          : { status: FINDING_STATUS.fail, explanation: `Household income ${income} exceeds the 60% limit ${limit}.` };
      },
    },
    {
      id: 'HOTMA-ASSET-CAP',
      version: '1.0.0',
      jurisdiction: 'federal',
      severity: 'major',
      requires: ['household_net_assets', 'hotma_asset_cap'],
      citation: 'HOTMA Sec. 102/104; 24 CFR 5.618',
      description: 'Net family assets above the HOTMA cap require documented eligibility treatment.',
      evaluate: (facts) => {
        const assets = Number(facts.household_net_assets.value);
        const cap = Number(facts.hotma_asset_cap.value);
        if (!Number.isFinite(assets) || !Number.isFinite(cap) || cap <= 0) {
          return { status: FINDING_STATUS.unableToDetermine, explanation: 'Net assets or the HOTMA cap is not a usable number.' };
        }
        return assets <= cap
          ? { status: FINDING_STATUS.pass, explanation: `Net assets ${assets} are at or below the HOTMA cap ${cap}.` }
          : { status: FINDING_STATUS.fail, explanation: `Net assets ${assets} exceed the HOTMA cap ${cap}.` };
      },
    },
    {
      id: 'STATE-QAP-UTILITY-ALLOWANCE',
      version: '1.0.0',
      jurisdiction: 'state',
      severity: 'major',
      requires: ['utility_allowance_source', 'gross_rent', 'state_max_gross_rent'],
      citation: 'State QAP / agency compliance manual (pack-specific)',
      description: 'Gross rent including the state-approved utility allowance must not exceed the state maximum.',
      evaluate: (facts) => {
        const rent = Number(facts.gross_rent.value);
        const max = Number(facts.state_max_gross_rent.value);
        if (!Number.isFinite(rent) || !Number.isFinite(max) || max <= 0) {
          return { status: FINDING_STATUS.unableToDetermine, explanation: 'Gross rent or state maximum rent is not a usable number.' };
        }
        return rent <= max
          ? { status: FINDING_STATUS.pass, explanation: `Gross rent ${rent} is within the state maximum ${max}.` }
          : { status: FINDING_STATUS.fail, explanation: `Gross rent ${rent} exceeds the state maximum ${max}.` };
      },
    },
  ]),
});

/** A state pack is usable only when independently approved and versioned. */
export function isStatePackUsable(pack) {
  return Boolean(
    pack &&
      pack.status === 'validated' &&
      pack.approvedBy &&
      pack.effectiveFrom &&
      pack.version &&
      Number(pack.validatedRuleCount) > 0,
  );
}

function factUsable(fact, minimumConfidence) {
  if (!fact) return { usable: false, reason: 'missing' };
  if (fact.value === null || fact.value === undefined || fact.value === '') return { usable: false, reason: 'empty' };
  if (!fact.humanVerified && Number(fact.confidence) < minimumConfidence) return { usable: false, reason: 'low_confidence' };
  return { usable: true };
}

function evidenceRefs(facts, fields) {
  return fields
    .map((field) => facts[field])
    .filter(Boolean)
    .map((fact) => ({
      field: fact.field,
      documentRef: fact.sourceDocumentRef ?? null,
      page: fact.page ?? null,
      snippet: fact.snippet ?? null,
      confidence: Number(fact.confidence ?? 0),
      humanVerified: Boolean(fact.humanVerified),
    }));
}

/**
 * Evaluate a fact set against a rule pack.
 *
 * @param {{ facts: readonly object[], pack?: object, statePack?: object|null, jurisdiction?: string, minimumConfidence?: number }} input
 */
export function evaluateCertification(input) {
  const pack = input.pack ?? FEDERAL_LIHTC_PACK;
  const minimumConfidence = Number.isFinite(input.minimumConfidence) ? input.minimumConfidence : MINIMUM_CONFIDENCE;
  const jurisdiction = input.jurisdiction ?? 'US';
  const statePackUsable = isStatePackUsable(input.statePack);

  const facts = {};
  for (const fact of input.facts ?? []) {
    if (fact && fact.field) facts[fact.field] = fact;
  }

  const findings = pack.rules.map((rule) => {
    const base = {
      ruleId: rule.id,
      ruleVersion: rule.version,
      rulePackId: pack.id,
      rulePackVersion: pack.version,
      jurisdiction: rule.jurisdiction === 'state' ? jurisdiction : 'federal',
      severity: rule.severity,
      citation: rule.citation,
      engineBuild: ENGINE_BUILD,
      evidenceRefs: evidenceRefs(facts, rule.requires),
    };

    if (rule.jurisdiction === 'state' && !statePackUsable) {
      return {
        ...base,
        status: FINDING_STATUS.unableToDetermine,
        explanation: `${rule.description} No validated state rule pack is available for ${jurisdiction}, so this state-specific requirement was not determined.`,
        blockingReasons: [
          'Federal baseline only — a validated state-specific rule pack is required before this determination can be made.',
        ],
      };
    }

    const blockingReasons = [];
    for (const field of rule.requires) {
      const check = factUsable(facts[field], minimumConfidence);
      if (check.usable) continue;
      blockingReasons.push(
        check.reason === 'low_confidence'
          ? `Fact "${field}" is below the ${Math.round(minimumConfidence * 100)}% confidence policy and is not human-verified.`
          : `Required fact "${field}" is missing from the submitted evidence.`,
      );
    }
    if (blockingReasons.length) {
      return {
        ...base,
        status: FINDING_STATUS.unableToDetermine,
        explanation: `${rule.description} The evidence on file is insufficient to determine this rule.`,
        blockingReasons,
      };
    }

    const outcome = rule.evaluate(facts);
    return {
      ...base,
      status: outcome.status,
      explanation: `${rule.description} ${outcome.explanation}`,
      blockingReasons: outcome.status === FINDING_STATUS.unableToDetermine ? [outcome.explanation] : [],
    };
  });

  return {
    engineBuild: ENGINE_BUILD,
    rulePackId: pack.id,
    rulePackVersion: pack.version,
    statePackApplied: statePackUsable,
    findings,
    counts: findings.reduce(
      (acc, finding) => {
        if (finding.status === FINDING_STATUS.pass) acc.pass += 1;
        else if (finding.status === FINDING_STATUS.fail) acc.fail += 1;
        else acc.unableToDetermine += 1;
        return acc;
      },
      { pass: 0, fail: 0, unableToDetermine: 0 },
    ),
  };
}

/** Human sign-off is only offered when nothing is undetermined. */
export function signOffAllowed(result) {
  return result.counts.unableToDetermine === 0;
}

export const REVIEW_DECISIONS = Object.freeze(['approved', 'remediation_requested', 'unable_to_determine']);
