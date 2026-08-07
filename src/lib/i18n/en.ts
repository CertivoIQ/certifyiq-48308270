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
  "nav.rules": "Rule packs",
  "nav.copilot": "AI Copilot",
  "nav.academy": "CertivoIQ Academy",
  "nav.launchpad": "LaunchPad",
  "nav.trial": "My free trial",
  "nav.pricing": "Plans & pricing",
  "nav.security": "Security",
  "nav.billing": "Account & billing",
  "nav.support": "Contact Support",
  "nav.crm": "CertivoIQ CRM",
  "nav.toggle": "Toggle navigation",

  // ---- shell ----
  "shell.tagline": "Compliance intelligence",
  "shell.rulePacksActive": "Rule packs active",
  "shell.statesBuild": "50 states · 2026.08 build",
  "shell.trial.status":
    "Free trial · {daysLeft} of {daysTotal} days left · {used}/{allowed} trial certification reviews used",
  "shell.trial.watchDemo": "Watch the demo",
  "shell.trial.upgrade": "Upgrade now",

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
  "welcome.pill": "{daysLeft} days left · {allowed} free AI certification reviews",
  "welcome.hero.title.pre": "The operating system for",
  "welcome.hero.title.accent": "affordable housing compliance",
  "welcome.hero.body":
    "CertivoIQ reviews LIHTC, HOME, Section 8 and HOTMA certifications against the rule pack assigned to each property, returns a Pass or Fail score with cited findings and correction steps, and routes it to a human for final approval.",
  "welcome.cta.trial": "Start your 7-day trial",
  "welcome.cta.sample": "See a reviewed certification",
  "welcome.video.play": "Play the CertivoIQ instructional video",
  "welcome.video.toast.title": "Playing: “Inside CertivoIQ”",
  "welcome.video.toast.body": "4 minutes — what it is, how it works, and what non-compliance really costs.",
  "welcome.video.title.pre": "Inside",
  "welcome.video.title.post": "— the 4-minute compliance walkthrough",
  "welcome.video.sub":
    "What the platform is · how the AI review works · why a human eye alone puts credits at risk",
  "welcome.risks.title": "What a human eye alone misses — and what it costs",
  "welcome.risks.body":
    "Every item below is a real source of fines, repayment agreements, IRS Form 8823 findings or recaptured tax credits. Manual review catches most of them, most of the time. CertivoIQ tests all of them, every time.",
  "welcome.value.title": "The Smart Investment That Pays for Itself",
  "welcome.value.body":
    "One avoided non-curable finding pays for years of CertivoIQ. Your reviewers stop hunting for citations and start signing off with confidence — and every plan starts with a {offer}.",
  "welcome.why.1.title": "Tax credits stay intact",
  "welcome.why.1.body":
    "A single uncorrected §42 finding can trigger IRS Form 8823 and put allocated credits at risk. CertivoIQ catches it while it is still curable.",
  "welcome.why.2.title": "Fewer audit findings",
  "welcome.why.2.body":
    "Every certification is scored Pass or Fail against the exact rule pack assigned to that property, with the correction steps written out.",
  "welcome.why.3.title": "Minutes, not hours",
  "welcome.why.3.body":
    "Reviews drop from ~41 minutes of manual file work to about 4 minutes, with a human keeping final sign-off authority.",
  "welcome.close.title": "Your trial ends in {daysLeft} days",
  "welcome.close.body":
    "After the trial, keep unlimited certification reviews, state rule packs and Academy training on the {plan} plan at {price}/month.",
  "welcome.close.cta": "Purchase a plan",

  // ---- dashboard ----
  "dash.title": "CertivoIQ Dashboard",
  "dash.subtitle":
    "Meridian Housing Partners · 185 properties · 14 states · period ending Aug 6, 2026",
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
  "property.language.help":
    "Emails and printed notices for this property are sent in this language.",
  "property.language.saved": "Correspondence language updated",

  // ---- merlin ----
  "merlin.greeting":
    "Greetings! I am Merlin, your compliance wizard. Ask me about any LIHTC, HOME, Section 8 or HOTMA rule and I will cite it for you.",
  "merlin.placeholder": "Ask Merlin about a compliance rule…",
  "merlin.open": "Chat with Merlin",
} as const;

export type TranslationKey = keyof typeof en;
export type Dictionary = Record<TranslationKey, string>;
