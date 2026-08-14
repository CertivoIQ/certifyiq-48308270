# Questions for RJ — SupportIQ

These questions are intentionally deferred so implementation can proceed without interrupting development. None of the answers below are required for the deterministic triage foundation.

## Human escalation destinations

1. What email address should receive P0 security/privacy alerts?
2. What email address should receive P1 billing escalations?
3. What email address should receive P1 production/UI escalations?
4. Who should receive P2 compliance/legal-review cases?

## Support channels

5. Should SupportIQ launch first in website/app chat, email, or both?
6. Do you want customers to be offered phone support at all, or only after a human marks a case as high priority?
7. What customer-facing support email should be published (for example, support@certivoiq.com)?

## Billing authority

8. What dollar amount, if any, may eventually be auto-refunded without human approval? Current implementation assumes $0 automatic refund authority.
9. Should failed-card / failed-renewal issues be P1 immediately, or P2 until service access is affected?

## Service targets

10. Preferred target response for P0 security/privacy cases?
11. Preferred target response for P1 production/UI cases?
12. Preferred target response for P1 billing cases?
13. Do Enterprise or Enterprise Plus customers receive faster support targets than other plans?

## Virtual-agent identity

14. Preferred customer-facing name: `SupportIQ`, `CertivoIQ Support`, or another name?
15. Should the agent explicitly identify itself as a virtual support agent at the start of every conversation?

## Knowledge and integrations

16. Which approved help content should be authoritative at launch: README/product docs, an in-app knowledge base, KnowledgeIQ, or a dedicated support knowledge base?
17. Should support cases eventually synchronize to the CertivoIQ CRM, a dedicated support dashboard, or both?
18. If email automation is enabled later, which provider/account should send support messages?

## Current safe defaults until answered

- No automatic refunds.
- No automatic compliance approvals or finding overrides.
- No automated permission changes for security incidents.
- No phone escalation for routine support.
- Confidence below 0.75 queues human review.
- Security/privacy is always P0 and immediate.
- Production/UI and material billing are P1.
- Compliance/legal interpretation is P2 and human-gated.
- Routine product usage can auto-resolve only from approved documentation and authorized account context.
