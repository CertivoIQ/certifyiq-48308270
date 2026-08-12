# Legacy CertivoIQ Build Prompt

This document records the original repository README's role as an AI build prompt and early product-development specification. It is retained for historical context and should **not** be treated as the current production product specification.

## Original intent

Build an affordable-housing compliance platform covering LIHTC, Section 8, HOME, and HOTMA, with AI-assisted TIC/certification review, soft-approval workflows, reviewer training, and certificates of achievement.

## Early architecture ideas

### HOTMA Compliance Engine

- Income exclusions
- Asset calculations
- Hardship determinations
- Safe Harbor verification
- Asset threshold rules
- Medical deduction rules
- Interim certifications
- EIV reconciliation
- Over-income monitoring

### Multi-state rule architecture

The original prompt proposed a layered rules model:

```text
Core Rule Engine
    ↓
State Plugin
    ↓
County Plugin
    ↓
PHA Plugin
    ↓
Property Plugin
```

### HUD rule versioning

The original proposal called for each rule to retain:

- Rule version
- Effective date
- Expiration date
- Authority
- Superseded-by relationship
- Citation
- Revision history

### AI extraction confidence

The proposal envisioned extracted fields carrying confidence, source-document location, OCR text, coordinates/image evidence, and human-verification status.

### Document intelligence

The proposed evidence chain was:

```text
Document → Pages → Paragraphs → Fields → Evidence
```

with findings linked to precise source evidence where possible.

### Compliance knowledge graph

The proposal connected entities such as tenant, unit, property, owner, program, funding source, recertification, inspection, violation, letter, and corrective action to support impact analysis.

### AI Copilot

The original concept included questions such as:

- Why did this fail?
- Explain a rule.
- Show the governing citation.
- Has this household failed before?
- Recommend remediation.

The intended philosophy was that deterministic rules provide facts and AI explains them.

### Compliance timeline

The original concept included a unified lifecycle from move-in through certification, verification, finding, correction, approval, interim activity, HOTMA changes, audit, 8823 risk, and recertification.

### Risk scoring

The proposal included property risk scores based on overdue recertifications, missing evidence, rule violations, HOTMA discrepancies, and other indicators.

### Executive dashboard

The proposed executive view included portfolio size, units, open findings, upcoming recertifications/audits, 8823 exposure, HOTMA readiness, and NSPIRE readiness.

## Early technology proposal

The original prompt proposed React/TypeScript, Tailwind/shadcn, Supabase/PostgreSQL, a deterministic rules engine, OpenAI-assisted extraction/summaries/letters, OCR/document intelligence, pgvector, background jobs, notifications, and digitally signed reporting.

## Historical note

The production implementation has evolved beyond this early prompt. The current operational source of truth is the production README plus the application source, entitlement catalog, database migrations, Stripe catalog, and current compliance/rule documentation. Do not copy historical claims from this document into customer-facing marketing without validating them against the current product.
