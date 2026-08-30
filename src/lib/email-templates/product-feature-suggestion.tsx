import React from "react";
import { Preview } from "@react-email/components";
import type { EmailTemplateData, TemplateEntry } from "./registry";
import {
  BRAND,
  Body,
  Container,
  Head,
  Heading,
  Html,
  Brand,
  Section,
  Text,
  Hr,
  hr,
  small,
  container,
  heading,
  main,
  text,
} from "./shared";

interface Props {
  suggestionId?: string;
  submitterEmail?: string;
  submitterRole?: string;
  workspaceType?: string;
  category?: string;
  priority?: string;
  title?: string;
  description?: string;
  expectedOutcome?: string;
  currentPage?: string;
  submittedAt?: string;
}

const label = (value?: string) => (value || "Not provided").replaceAll("_", " ");

const Email = ({
  suggestionId,
  submitterEmail,
  submitterRole,
  workspaceType,
  category,
  priority,
  title,
  description,
  expectedOutcome,
  currentPage,
  submittedAt,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New CertivoIQ feature suggestion: {title || "Untitled suggestion"}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Brand locale="en" />
        <Heading style={heading}>New product suggestion</Heading>
        <Text style={text}>
          A signed-in CertivoIQ user submitted a product feature or workflow suggestion.
        </Text>

        <Section style={{ padding: "14px 16px", backgroundColor: "#f8f9fc", borderRadius: "8px", marginBottom: "18px" }}>
          <Text style={{ ...text, margin: 0, fontWeight: 700 }}>{title || "Untitled suggestion"}</Text>
          <Text style={{ ...text, margin: "7px 0 0", color: BRAND.muted }}>
            {label(category)} · {label(priority)} priority · {label(workspaceType)} · {label(submitterRole)}
          </Text>
        </Section>

        <Text style={{ ...text, fontWeight: 700, marginBottom: "5px" }}>Suggestion</Text>
        <Text style={{ ...text, whiteSpace: "pre-wrap" }}>{description || "No description provided."}</Text>

        <Text style={{ ...text, fontWeight: 700, marginBottom: "5px" }}>Expected outcome</Text>
        <Text style={{ ...text, whiteSpace: "pre-wrap" }}>{expectedOutcome || "Not provided"}</Text>

        <Hr style={hr} />
        <Text style={small}>Submitted by: {submitterEmail || "Unknown"}</Text>
        <Text style={small}>Current page: {currentPage || "Not provided"}</Text>
        <Text style={small}>Suggestion ID: {suggestionId || "Pending"}</Text>
        <Text style={small}>Submitted: {submittedAt || "Not provided"}</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: EmailTemplateData) =>
    `[CertivoIQ suggestion] ${String(data["title"] ?? "New feature request")} — ${label(String(data["submitterRole"] ?? "user"))}`,
  displayName: "Product feature suggestion",
  to: "rjwatkins@certivoiq.com",
  previewData: {
    suggestionId: "11111111-2222-3333-4444-555555555555",
    submitterEmail: "client@example.com",
    submitterRole: "public_housing_specialist",
    workspaceType: "pha",
    category: "workflow",
    priority: "important",
    title: "Add a transfer aging report",
    description: "Provide a role-filtered report of pending transfers grouped by age and reason.",
    expectedOutcome: "Managers can identify stalled transfers before deadlines are missed.",
    currentPage: "/pha-public-housing-occupancy",
    submittedAt: "2026-08-30T09:20:00.000Z",
  },
} satisfies TemplateEntry;
