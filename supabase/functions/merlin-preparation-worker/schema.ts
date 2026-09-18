export const procedureSchema = {
  type: "object",
  additionalProperties: false,
  required: ["document_title", "document_scope", "procedures", "document_ambiguity_flags"],
  properties: {
    document_title: { type: "string" },
    document_scope: { type: "string" },
    document_ambiguity_flags: { type: "array", items: { type: "string" } },
    procedures: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "procedure_key", "category", "title", "summary", "steps", "responsible_roles",
          "triggering_events", "required_inputs", "required_evidence", "deadlines", "exceptions",
          "citations", "ambiguity_flags", "extraction_confidence",
        ],
        properties: {
          procedure_key: { type: "string" },
          category: { type: "string" },
          title: { type: "string" },
          summary: { type: "string" },
          steps: { type: "array", items: { type: "string" } },
          responsible_roles: { type: "array", items: { type: "string" } },
          triggering_events: { type: "array", items: { type: "string" } },
          required_inputs: { type: "array", items: { type: "string" } },
          required_evidence: { type: "array", items: { type: "string" } },
          deadlines: { type: "array", items: { type: "string" } },
          exceptions: { type: "array", items: { type: "string" } },
          ambiguity_flags: { type: "array", items: { type: "string" } },
          extraction_confidence: { type: "number" },
          citations: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["page_or_locator", "section", "excerpt"],
              properties: {
                page_or_locator: { type: "string" },
                section: { type: "string" },
                excerpt: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
};

