/**
 * English source strings. Keys are flat, dot-namespaced by surface.
 * `es.ts` mirrors these keys; any missing key falls back to English.
 */
export const en = {
  // ---- common ----
  "common.language": "Language",
  "common.english": "English",
  "common.spanish": "Español",
  "common.switchToSpanish": "Switch to Spanish",
  "common.switchToEnglish": "Switch to English",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.units": "units",
  "common.findings": "findings",
  "common.overdueRecerts": "overdue recerts",
  "common.days": "days",
  "common.perMonth": "/month",

  // ---- navigation ----
  "nav.dashboard": "Dashboard",
  "nav.properties": "Properties",
  "nav.files": "Certifications",
  "nav.findings": "Findings",
  "nav.rules": "Federal rules",
  "nav.copilot": "Compliance Assistant",
  "nav.academy": "Archived training",
  "nav.launchpad": "LaunchPad",
  "nav.trial": "Demo workspace",
  "nav.pricing": "Platform pricing",
  "nav.security": "Security",
  "nav.billing": "Account & billing",
  "nav.support": "Contact Support",
  "nav.crm": "CertivoIQ CRM",
  "nav.toggle": "Toggle navigation",

  // ---- shell ----
  "shell.tagline": "Compliance intelligence infrastructure",
  "shell.rulePacksActive": "Federal baseline active",
  "shell.statesBuild": "State-specific rules not evaluated",
  "shell.trial.status": "Demo workspace · {used}/{allowed} sample reviews used",
  "shell.trial.watchDemo": "Watch the demo",
  "shell.trial.upgrade": "Request a demo",

  // ---- errors ----
  "error.notFound.title": "Page not found",
  "error.notFound.body": "The page you're looking for doesn't exist or has been moved.",
  "error.goHome": "Go home",
  "error.generic.title": "This page didn't load",
  "error.generic.body": "Something went wrong on our end. You can try refreshing or head back home.",
  "error.tryAgain": "Try again",

  // ---- welcome / marketing ----
  "welcome.nav.support": "Contact Support",
  "welcome.nav.pricing": "Pricing",
  "welcome.nav.open": "Open the platform",
  "welcome.pill": "Federal baseline compliance review",
  "welcome.hero.title": "FIND COMPLIANCE RISK BEFORE THE AUDITOR.",
  "welcome.hero.subtitle":
    "CertivoIQ extracts evidence from affordable-housing certification files, applies supported versioned federal requirements deterministically, and shows exactly why each finding was raised.",
  "welcome.hero.cta": "REQUEST A DEMO",
  "welcome.workflow.upload": "Upload",
  "welcome.workflow.extract": "Extract",
  "welcome.workflow.check": "Check",
  "welcome.workflow.evidence": "Evidence",
  "welcome.workflow.findings": "Findings",
  "welcome.cta.trial": "REQUEST A DEMO",
  "welcome.cta.sample": "See a reviewed certification",
  "welcome.video.label": "CertivoIQ compliance intelligence explainer video",
  "welcome.video.trialCta": "REQUEST A DEMO",
  "welcome.risks.title": "What manual review alone can miss — and what it costs",
  "welcome.risks.body":
    "The items below can contribute to findings or corrective action. CertivoIQ surfaces supported federal-baseline issues for Manual Review and does not guarantee detection of every issue.",
  "welcome.value.title": "Compare CertivoIQ with your current cost of compliance",
  "welcome.value.body":
    "Enter your own figures below. CertivoIQ does not estimate savings or guarantee avoidance of findings, penalties, or credit recapture.",
  "welcome.why.1.title": "Tax credits stay intact",
  "welcome.why.1.body":
    "CertivoIQ surfaces supported federal-baseline issues while your team still has time to investigate and determine corrective action.",
  "welcome.why.2.title": "Fewer audit findings",
  "welcome.why.2.body":
    "Supported federal rules produce traceable findings. Missing, conflicting, or unevaluated requirements return Unable to Determine.",
  "welcome.why.3.title": "Minutes, not hours",
  "welcome.why.3.body":
    "CertivoIQ organizes evidence and findings while authorized compliance agents retain Agent Approval authority.",
  "welcome.close.title": "See CertivoIQ in your workflow",
  "welcome.close.body":
    "Request a demonstration of federal baseline review, evidence traceability, Agent Approval, and portfolio-level visibility.",
  "welcome.close.cta": "REQUEST A DEMO",

  // ---- dashboard ----
  "dash.title": "CertivoIQ Dashboard",
  "dash.subtitle": "Meridian Housing Partners · 185 properties · 14 states · period ending Aug 6, 2026",
  "dash.export": "Export board packet",
  "dash.reviewQueue": "Review queue",
  "dash.stat.properties": "Properties",
  "dash.stat.properties.hint": "{units} units under management",
  "dash.stat.openFindings": "Open findings",
  "dash.stat.openFindings.hint": "Down 22% over six months",
  "dash.stat.exposure": "8823 exposure",
  "dash.stat.exposure.hint": "Units at risk of IRS Form 8823 reporting",
  "dash.stat.autoApproval": "Auto soft-approval",
  "dash.stat.autoApproval.hint": "{minutes} min average review",
  "dash.risk.title": "Risk trajectory",
  "dash.risk.desc": "Portfolio risk score and open findings, trailing six months",
  "dash.risk.note": "Risk score improved 20 points since HOTMA rule pack v2.0 deployment.",
  "dash.readiness.title": "Program readiness",
  "dash.readiness.hotma": "HOTMA readiness",
  "dash.readiness.nspire": "NSPIRE readiness",
  "dash.byProgram.title": "Findings by program",
  "dash.topRisk.title": "Highest-risk properties",
  "dash.topRisk.desc": "Ranked by predicted probability of agency findings",
  "dash.topRisk.all": "All properties",
  "dash.obligations.title": "Upcoming obligations",
  "dash.obligations.recerts": "Recertifications due (30 days)",
  "dash.obligations.audits": "Agency audits scheduled",
  "dash.obligations.nspire": "NSPIRE inspections",
  "dash.obligations.interim": "Interim certifications pending",
  "dash.obligations.softApproval": "Files awaiting soft approval",

  // ---- property correspondence language ----
  "property.language.label": "Correspondence language",
  "property.language.help": "Emails and printed notices for this property are sent in this language.",
  "property.language.saved": "Correspondence language updated",

  // ---- merlin ----
  "merlin.greeting": "Greetings! I am Merlin, your compliance wizard. Ask me about any LIHTC, HOME, Section 8 or HOTMA rule and I will cite it for you.",
  "merlin.placeholder": "Ask Merlin about a compliance rule…",
  "merlin.open": "Chat with Merlin",
} as const;

export type TranslationKey = keyof typeof en;
export type Dictionary = Record<TranslationKey, string>;
