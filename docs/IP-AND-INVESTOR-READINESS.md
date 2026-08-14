# CertivoIQ IP and Investor Readiness

## Purpose

This checklist organizes corporate, intellectual-property, security, financial, and diligence work that should be completed as CertivoIQ prepares for customers and investors. It is an operational checklist, not legal or tax advice.

## Corporate formation

- Confirm availability of the intended Wyoming legal entity name.
- Select and obtain written consent from a Wyoming registered agent.
- File Wyoming Articles of Organization.
- Adopt an operating agreement covering ownership, management, voting, transfers, IP, distributions, and dissolution.
- Obtain an EIN from the IRS after formation.
- Establish company banking and bookkeeping.
- Maintain a capitalization table and written records of equity issuances.
- Calendar Wyoming annual-report obligations.
- Determine whether foreign qualification is required in any state where the company is actually doing business.

## Intellectual property chain of title

- Document who authored each material component of the platform.
- Obtain written IP assignment and confidentiality agreements from founders, employees, contractors, designers, and other contributors as appropriate.
- Inventory third-party and open-source dependencies and their licenses.
- Preserve dated Git history and release records.
- Maintain confidential trade-secret material with access controls.
- Register eligible software versions with the U.S. Copyright Office.
- Conduct trademark clearance for `CertivoIQ` and consider federal trademark registration for the brand and logo.
- Review whether any genuinely novel technical inventions warrant patent counsel review before public disclosure.

## Software copyright package

For each material release selected for registration, preserve:

- release/version identifier and release date;
- authorship and ownership information;
- publication status and first-publication facts, if applicable;
- source-code deposit material prepared under current Copyright Office rules;
- identification of third-party/preexisting material that must be excluded from the claim;
- screenshots/documentation if separately relevant;
- a copy of the filed application, deposit, correspondence, and registration certificate.

Copyright does not protect the idea of affordable-housing compliance software, business methods, facts, regulations, or functional concepts. It can protect original code and other original expression. Brand protection, trade secrets, contracts, and potentially patents address different risks.

## Investor data room

Recommended top-level folders:

1. Corporate Formation and Governance
2. Capitalization and Ownership
3. Intellectual Property
4. Product and Technology
5. Security and Privacy
6. Compliance Methodology
7. Customers and Pipeline
8. Financial Model and KPIs
9. Contracts and Vendor Agreements
10. Insurance, Tax, and Legal

## Product diligence package

Maintain current versions of:

- product overview and roadmap;
- system architecture;
- data-flow and trust-boundary diagram;
- rules-engine methodology;
- AI data-use and human-review methodology;
- security controls and incident-response plan;
- backup/disaster-recovery plan;
- test strategy and CI evidence;
- integration inventory distinguishing production adapters from simulations;
- regulatory coverage matrix distinguishing implemented, tested, planned, and unsupported jurisdictions/features.

## Commercial diligence

Track:

- qualified pipeline and sales cycle;
- annual contract value and expansion revenue;
- customer acquisition cost;
- gross margin;
- churn and retention;
- certification volume;
- time saved per certification;
- findings detected before submission;
- audit-readiness improvements;
- avoided rework and documented risk reduction.

Do not market a guaranteed avoidance of tax-credit recapture, fines, findings, or agency action. Position the platform as reducing preventable errors, improving evidence quality, and strengthening audit readiness.

## Repository controls

- Keep the repository private unless a deliberate open-source decision is made.
- Never commit production secrets or resident PII.
- Use branch protection and required CI checks.
- Restrict administrative access.
- Preserve security logs and release history.
- Review committed `.env` files and rotate any credential that may have been exposed.
