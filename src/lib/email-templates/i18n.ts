/**
 * Email copy in English and Spanish. Templates receive `locale` through
 * templateData; anything missing falls back to English.
 */
export type EmailLocale = 'en' | 'es'

const en = {
  'brand.tagline': 'Affordable housing compliance platform',

  // support request received
  'support.subject': 'We received your support request â€” case {caseNumber} Â· CertivoIQ',
  'support.preview': 'We received your support request â€” case {caseNumber} Â· CertivoIQ',
  'support.heading': 'Thanks for reaching out',
  'support.greeting.named': 'Hi {name},',
  'support.greeting.plain': 'Hi there,',
  'support.body': 'we have received your support request and a CertivoIQ specialist will review it shortly.',
  'support.caseNumber': 'Case number: {caseNumber}',
  'support.pending': 'Pending',
  'support.subjectLine': 'Subject: {subject}',
  'support.turnaround': 'Most questions are answered within one business day. If you need to add more details, reply to this email and the case will be updated automatically.',
  'support.cta': 'Open support page',
  'support.footer': 'You are receiving this because you submitted a request through the CertivoIQ support page. Reply to this email to add more details.',

  // cold intro
  'intro.subject.company': '{company}: protect your tax credits before the next audit',
  'intro.subject.generic': 'Protect your tax credits before the next audit â€” CertivoIQ',
  'intro.preview': 'Federal baseline compliance intelligence for LIHTC, HOME, Project-Based Section 8 and HOTMA',
  'intro.heading.pre': 'One missed certification can cost',
  'intro.heading.accent': 'years of tax credits',
  'intro.greeting.named': 'Hi {name},',
  'intro.greeting.plain': 'Hi there,',
  'intro.body': 'CertivoIQ is compliance intelligence infrastructure for affordable housing programs{company}. It evaluates certification evidence against supported, versioned federal requirements and returns traceable findings or Unable to Determine when evidence or scope is incomplete. Authorized compliance agents retain Agent Approval authority.',
  'intro.body.company': ' like {company}',
  'intro.section.what': 'WHAT THE PLATFORM DOES',
  'intro.stat.time': 'Federal baseline scope',
  'intro.stat.states': 'Versioned federal rules',
  'intro.stat.programs': 'Traceable findings',
  'intro.stat.signoff': 'Agent Approval and Agent Signature',
  'intro.section.vs': 'TRACEABLE REVIEW WORKFLOW',
  'intro.bar.manual': 'Evidence intake',
  'intro.bar.manual.value': 'source documents retained with the review',
  'intro.bar.ai': 'Federal rule evaluation',
  'intro.bar.ai.value': 'versioned and deterministic',
  'intro.bar.manualChecks': 'Unresolved evidence',
  'intro.bar.manualChecks.value': 'Unable to Determine blocks completion',
  'intro.bar.aiChecks': 'Review completion',
  'intro.bar.aiChecks.value': 'Agent Approval and Agent Signature required',
  'intro.section.benefits': 'HOW ENTERPRISES BENEFIT',
  'intro.benefit.1': 'Portfolio-level visibility into traceable findings and review status.',
  'intro.benefit.2': 'Consistent evaluation using supported, versioned federal requirements.',
  'intro.benefit.3': 'Evidence remains connected to findings, rule versions and agent actions.',
  'intro.benefit.4': 'Unable to Determine safeguards block unsupported or incomplete conclusions.',
  'intro.benefit.5': 'Authorized compliance agents retain approval and signature authority.',
  'intro.section.pricing': 'ANNUAL PLATFORM LICENSE',
  'intro.plan.price': '{price}/year',
  'intro.addons': 'Multifamily Enterprise is $65,000 per selected state annually; PHA is a flat $150,000 annual license.',
  'intro.section.risk': 'THE COST OF NON-COMPLIANCE',
  'intro.risk.1': 'Non-curable Â§42 findings',
  'intro.risk.1.cost': 'IRS Form 8823 filing and recapture of allocated credits',
  'intro.risk.2': 'Failed state agency audit',
  'intro.risk.2.cost': 'Repayment agreements, withheld allocations, reputational damage',
  'intro.risk.3': 'Section 8 / TRACS errors',
  'intro.risk.3.cost': 'Subsidy repayment and HUD-imposed corrective action',
  'intro.risk.4': 'HOTMA implementation gaps',
  'intro.risk.4.cost': 'Systemic recertification errors across an entire portfolio',
  'intro.cta': 'Try CertivoIQ for Free',
  'intro.startFree': 'Learn more:',
  'intro.startFree.detail': 'â€” start with three free certification reviews using your organization website email.',
  'intro.signature': 'CertivoIQ â€” federal baseline compliance intelligence',
  'intro.unsubscribe': 'You received this introduction because your organization operates affordable housing. Reply with "unsubscribe" and we will not contact you again.',
} as const

export type EmailKey = keyof typeof en

const es: Record<EmailKey, string> = {
  'brand.tagline': 'Plataforma de cumplimiento para vivienda asequible',
  'support.subject': 'Recibimos su solicitud de soporte â€” caso {caseNumber} Â· CertivoIQ',
  'support.preview': 'Recibimos su solicitud de soporte â€” caso {caseNumber} Â· CertivoIQ',
  'support.heading': 'Gracias por comunicarse con nosotros',
  'support.greeting.named': 'Hola {name}:',
  'support.greeting.plain': 'Hola:',
  'support.body': 'hemos recibido su solicitud de soporte y un especialista de CertivoIQ la revisarÃ¡ en breve.',
  'support.caseNumber': 'NÃºmero de caso: {caseNumber}',
  'support.pending': 'Pendiente',
  'support.subjectLine': 'Asunto: {subject}',
  'support.turnaround': 'La mayorÃ­a de las consultas se responden en un dÃ­a hÃ¡bil. Si necesita agregar mÃ¡s detalles, responda a este correo y el caso se actualizarÃ¡ automÃ¡ticamente.',
  'support.cta': 'Abrir la pÃ¡gina de soporte',
  'support.footer': 'Recibe este mensaje porque enviÃ³ una solicitud a travÃ©s de la pÃ¡gina de soporte de CertivoIQ. Responda a este correo para agregar mÃ¡s detalles.',
  'intro.subject.company': '{company}: proteja sus crÃ©ditos fiscales antes de la prÃ³xima auditorÃ­a',
  'intro.subject.generic': 'Proteja sus crÃ©ditos fiscales antes de la prÃ³xima auditorÃ­a â€” CertivoIQ',
  'intro.preview': 'Inteligencia de cumplimiento de lÃ­nea base federal para LIHTC, HOME, SecciÃ³n 8 basada en proyectos y HOTMA',
  'intro.heading.pre': 'Una certificaciÃ³n mal revisada puede costar',
  'intro.heading.accent': 'aÃ±os de crÃ©ditos fiscales',
  'intro.greeting.named': 'Hola {name}:',
  'intro.greeting.plain': 'Hola:',
  'intro.body': 'CertivoIQ es infraestructura de inteligencia de cumplimiento para programas de vivienda asequible{company}. EvalÃºa evidencia de certificaciÃ³n segÃºn requisitos federales compatibles y versionados, y devuelve hallazgos trazables o No se puede determinar cuando la evidencia o el alcance estÃ¡n incompletos. Los agentes de cumplimiento autorizados conservan la autoridad de AprobaciÃ³n del Agente.',
  'intro.body.company': ' como {company}',
  'intro.section.what': 'QUÃ‰ HACE LA PLATAFORMA',
  'intro.stat.time': 'Alcance de lÃ­nea base federal',
  'intro.stat.states': 'Reglas federales versionadas',
  'intro.stat.programs': 'Hallazgos trazables',
  'intro.stat.signoff': 'AprobaciÃ³n y Firma del Agente',
  'intro.section.vs': 'FLUJO DE REVISIÃ“N TRAZABLE',
  'intro.bar.manual': 'RecepciÃ³n de evidencia',
  'intro.bar.manual.value': 'los documentos fuente permanecen con la revisiÃ³n',
  'intro.bar.ai': 'EvaluaciÃ³n de reglas federales',
  'intro.bar.ai.value': 'versionada y determinista',
  'intro.bar.manualChecks': 'Evidencia no resuelta',
  'intro.bar.manualChecks.value': 'No se puede determinar bloquea la finalizaciÃ³n',
  'intro.bar.aiChecks': 'FinalizaciÃ³n de la revisiÃ³n',
  'intro.bar.aiChecks.value': 'se requieren AprobaciÃ³n y Firma del Agente',
  'intro.section.benefits': 'CÃ“MO SE BENEFICIAN LAS EMPRESAS',
  'intro.benefit.1': 'Visibilidad del portafolio sobre hallazgos trazables y estado de revisiÃ³n.',
  'intro.benefit.2': 'EvaluaciÃ³n uniforme mediante requisitos federales compatibles y versionados.',
  'intro.benefit.3': 'La evidencia permanece vinculada con hallazgos, versiones de reglas y acciones del agente.',
  'intro.benefit.4': 'No se puede determinar bloquea conclusiones no respaldadas o incompletas.',
  'intro.benefit.5': 'Los agentes de cumplimiento autorizados conservan la autoridad de aprobaciÃ³n y firma.',
  'intro.section.pricing': 'LICENCIA ANUAL DE LA PLATAFORMA',
  'intro.plan.price': '{price}/aÃ±o',
  'intro.addons': 'Multifamily Enterprise cuesta $65,000 por estado seleccionado al aÃ±o; PHA tiene una licencia anual fija de $150,000.',
  'intro.section.risk': 'EL COSTO DEL INCUMPLIMIENTO',
  'intro.risk.1': 'Hallazgos Â§42 no subsanables',
  'intro.risk.1.cost': 'PresentaciÃ³n del Formulario 8823 del IRS y recuperaciÃ³n de los crÃ©ditos asignados',
  'intro.risk.2': 'AuditorÃ­a estatal no aprobada',
  'intro.risk.2.cost': 'Acuerdos de reembolso, asignaciones retenidas y daÃ±o a la reputaciÃ³n',
  'intro.risk.3': 'Errores de SecciÃ³n 8 / TRACS',
  'intro.risk.3.cost': 'Reembolso del subsidio y medidas correctivas impuestas por HUD',
  'intro.risk.4': 'Brechas en la implementaciÃ³n de HOTMA',
  'intro.risk.4.cost': 'Errores sistemÃ¡ticos de recertificaciÃ³n en todo el portafolio',
  'intro.cta': 'Pruebe CertivoIQ gratis',
  'intro.startFree': 'MÃ¡s informaciÃ³n:',
  'intro.startFree.detail': 'â€” comience con tres revisiones gratuitas de certificaciÃ³n usando el correo electrÃ³nico del sitio web de su organizaciÃ³n.',
  'intro.signature': 'CertivoIQ â€” inteligencia de cumplimiento de lÃ­nea base federal',
  'intro.unsubscribe': 'Recibe esta presentaciÃ³n porque su organizaciÃ³n administra vivienda asequible. Responda con "unsubscribe" y no volveremos a contactarle.',
}

const DICTS: Record<EmailLocale, Record<string, string>> = { en, es }

/** Narrows arbitrary template data into a supported email locale. */
export function localeOf(value: unknown): EmailLocale | undefined {
  return value === 'es' || value === 'en' ? value : undefined
}

export function emailT(locale: EmailLocale | undefined, key: EmailKey, vars?: Record<string, string | number>) {
  const template = DICTS[locale ?? 'en']?.[key] ?? en[key]
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}

