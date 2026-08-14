const ROUTINE_RESPONSES = [
  {
    test: /how do i upload/i,
    response:
      "Use CertivoIQ's certification review upload workflow to add the certification documents, then review the extracted evidence and findings before any human approval or submission step. If the upload itself is failing, describe the failure and SupportIQ will route it as a production/UI issue.",
  },
  {
    test: /where .*manifest/i,
    response:
      "Evidence manifests are associated with the reviewed certification package and are used by the Submission Center to bind human approvals and transmission authority to the exact reviewed evidence. Open the relevant certification/submission workflow to review the current package before authorization.",
  },
  {
    test: /where .*finding/i,
    response:
      "Findings are shown with the certification review results. Review each finding and its evidence before approving, requesting remediation, or proceeding to submission. SupportIQ cannot override a finding.",
  },
  {
    test: /where .*invoice/i,
    response:
      "Open Billing from your authenticated CertivoIQ account to review subscription and invoice information. If you see a duplicate charge, failed payment, disputed invoice, or refund request, tell SupportIQ and it will create a billing escalation for human review.",
  },
  {
    test: /invite .* (user|reviewer)/i,
    response:
      "Use the account or team-management controls to invite an authorized user or reviewer, then verify the person's role and access before sharing resident or certification information. Permission or privacy concerns should be escalated rather than handled automatically.",
  },
  {
    test: /(reset|change) .*password/i,
    response:
      "Use the account sign-in or security flow to reset or change your password. If you suspect unauthorized access, do not treat it as a routine password issue—report the suspicious login or security concern so SupportIQ can escalate it immediately.",
  },
  {
    test: /how do i add .*property/i,
    response:
      "Use the authenticated property onboarding workflow to add the property and confirm its program and ownership information before running compliance workflows. If the property cannot be created or saved, report the error and SupportIQ will route it for UI review.",
  },
  {
    test: /what does .*not[_ -]?determined/i,
    response:
      "NOT_DETERMINED means CertivoIQ does not have sufficient reliable evidence to make the compliance determination. It is a blocking state, not a pass or fail, and the underlying evidence must be clarified or corrected before the affected rule can proceed.",
  },
  {
    test: /how .*submission .*work/i,
    response:
      "CertivoIQ keeps review, human approval, submission authorization, and external delivery separate. A package must satisfy the current evidence and human-approval gates before submission authorization, and submitted status does not by itself mean an external housing authority received the package.",
  },
];

export function resolveRoutineSupportRequest(message) {
  const text = String(message ?? "").trim();
  for (const item of ROUTINE_RESPONSES) {
    if (item.test.test(text)) return item.response;
  }

  return "I can help with routine CertivoIQ navigation and workflow questions. I do not guess about account-specific, billing, security, legal, or compliance decisions; those requests are routed to the appropriate human queue.";
}
