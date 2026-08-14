# SupportIQ Virtual Customer Service

SupportIQ is CertivoIQ's low-touch customer support and triage layer. It is designed to resolve routine product questions automatically while preserving explicit human authority for high-risk actions.

## Escalation model

| Priority | Category | Default action |
| --- | --- | --- |
| P0_SECURITY | Security / privacy | Immediate human escalation |
| P1_PRODUCTION_UI | Production / UI outage | Human escalation |
| P1_BILLING | Material billing | Human authorization |
| P2_COMPLIANCE_REVIEW | Compliance / legal interpretation | Qualified human review |
| P2_SUPPORT_REVIEW | Low-confidence / unclassified | Support queue |
| P3_ROUTINE | Routine product usage | Automatic resolution from approved content |

## Safety boundaries

SupportIQ must not independently:

- change user permissions during a suspected security incident;
- expose resident, tenant, customer, or cross-organization data;
- issue material refunds or change contract terms;
- override a compliance finding;
- approve a certification;
- provide legal advice;
- claim an outage is resolved without verification;
- invent product behavior when confidence or source grounding is insufficient.

## Automatic support scope

At high confidence, routine questions can be answered from approved CertivoIQ product documentation, including navigation, uploads, property setup, invitations, standard workflow explanations, and standard troubleshooting.

## Confidence policy

The deterministic gate defaults to a 0.75 confidence threshold. Requests below the threshold are queued for review rather than guessed. High-risk keyword/category matches override confidence and always escalate.

## Persistence

`support_cases` stores escalated support requests with category, priority, disposition, agent confidence, human-required state, and metadata. Authenticated users may create and read their own cases. Elevated support workflows are expected to operate through server-side/service-role authorization.

## Next integration boundary

A conversational model can sit in front of this deterministic gate, but the model is not the authority. The required order is:

1. authenticate the user when account context is needed;
2. retrieve only approved product/support knowledge and authorized account data;
3. draft a response and confidence estimate;
4. run deterministic SupportIQ classification;
5. auto-resolve only when the gate returns `P3_ROUTINE / AUTO_RESOLVE`;
6. otherwise create a support case and route it to the correct human queue.

No automated support response may override existing CertivoIQ certification, transmission, privacy, security, or billing authority controls.
