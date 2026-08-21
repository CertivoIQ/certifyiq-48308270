export const POST_SALE_PRIORITIES = [
  {
    title: "Activate self-directed onboarding",
    items: [
      "Verify the customer's organization email domain and primary administrator.",
      "Confirm the in-product setup checklist reaches first value without staff intervention.",
      "Validate automated welcome, setup, and progress messages.",
    ],
  },
  {
    title: "Protect customer data",
    items: [
      "Verify least-privilege roles, tenant isolation, audit logging, and backup coverage.",
      "Confirm production secrets, retention settings, and incident contacts.",
    ],
  },
  {
    title: "Open the PMS data path",
    items: [
      "Start with a secure CSV import while obtaining API credentials for the customer's PMS.",
      "Prioritize the first live PMS connector from the customer's actual system and access level.",
    ],
  },
  {
    title: "Deliver first compliance value",
    items: [
      "Run the first real portfolio review and confirm findings are traceable to source evidence.",
      "Measure time to first completed review and resolve onboarding blockers automatically.",
    ],
  },
  {
    title: "Operate autonomous support",
    items: [
      "Create tickets automatically from customer chat and support email.",
      "Auto-resolve grounded routine requests and route high-risk exceptions for controlled review.",
      "Reopen tickets automatically when the customer reports the issue is unresolved.",
    ],
  },
  {
    title: "Measure, retain, and expand",
    items: [
      "Track activation, review completion, support resolution, renewal risk, and expansion signals.",
      "Use product-led prompts and lifecycle messages instead of a sales-led handoff.",
    ],
  },
] as const;
