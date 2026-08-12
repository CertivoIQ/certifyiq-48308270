/**
 * Email copy in English and Spanish. Templates receive `locale` through
 * templateData; anything missing falls back to English.
 */
export type EmailLocale = 'en' | 'es'

const en = {
  'brand.tagline': 'Affordable housing compliance platform',

  // support request received
  'support.subject': 'We received your support request — case {caseNumber} · CertivoIQ',
  'support.preview': 'We received your support request — case {caseNumber} · CertivoIQ',
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
  'intro.subject.generic': 'Protect your tax credits before the next audit — CertivoIQ',
  'intro.preview': 'Protect {company} tax credits — AI compliance review for LIHTC, HOME, Section 8 & HOTMA',
  'intro.heading.pre': 'Find compliance risk',
  'intro.heading.accent': 'before the auditor',
  'intro.greeting.named': 'Hi {name},',
  'intro.greeting.plain': 'Hi there,',
  'intro.body': 'CertivoIQ is an AI compliance platform built for affordable housing teams{company}. It reads certification evidence, applies the assigned rule pack, and returns traceable findings and correction steps while keeping final approval with a human reviewer.',
  'intro.body.company': ' at {company}',
  'intro.section.what': 'WHAT THE PLATFORM DOES',
  'intro.stat.time': 'Typical AI review workflow per certification',
  'intro.stat.states': 'States supported by maintained rule packs',
  'intro.stat.programs': 'Programs: LIHTC, HOME, S8, HOTMA, RD, Bond',
  'intro.stat.signoff': 'Final approval remains with your team',
  'intro.section.vs': 'MANUAL REVIEW VS. CERTIVOIQ',
  'intro.bar.manual': 'Manual file review',
  'intro.bar.manual.value': 'Longer, repetitive evidence work',
  'intro.bar.ai': 'CertivoIQ AI review',
  'intro.bar.ai.value': 'Faster evidence review, then human approval',
  'intro.bar.manualChecks': 'Rule checks applied manually',
  'intro.bar.manualChecks.value': 'reviewer-dependent and time-intensive',
  'intro.bar.aiChecks': 'Rule checks applied by CertivoIQ',
  'intro.bar.aiChecks.value': 'standardized, traceable, version-aware',
  'intro.section.benefits': 'HOW TEAMS BENEFIT',
  'intro.benefit.1': 'Portfolio-wide visibility — findings, verdicts and audit readiness across every property and program.',
  'intro.benefit.2': 'Standardized reviews — the same rule logic applied consistently across teams and states.',
  'intro.benefit.3': 'Faster file throughput without turning compliance into another administrative burden.',
  'intro.benefit.4': 'CertivoIQ Academy training and Certificates of Achievement to onboard new reviewers.',
  'intro.benefit.5': 'Merlin, the AI compliance assistant, explains findings and cites the governing rule when a reviewer needs help.',
  'intro.section.pricing': 'PLANS & PRICING',
  'intro.plan.price': '{price}/month',
  'intro.addons': 'Add-ons: additional state rule packs $99–$199/state/month · CertivoIQ Academy $49/user/month or $499/property/month · API access $500–$2,000/month · AI document processing beyond plan allowance $3 per uploaded certification.',
  'intro.section.risk': 'THE COST OF NON-COMPLIANCE',
  'intro.risk.1': 'Non-curable §42 findings',
  'intro.risk.1.cost': 'IRS Form 8823 filing and recapture of allocated credits',
  'intro.risk.2': 'Failed state agency audit',
  'intro.risk.2.cost': 'Repayment agreements, withheld allocations, reputational damage',
  'intro.risk.3': 'Section 8 / TRACS errors',
  'intro.risk.3.cost': 'Subsidy repayment and HUD-imposed corrective action',
  'intro.risk.4': 'HOTMA implementation gaps',
  'intro.risk.4.cost': 'Systemic recertification errors across an entire portfolio',
  'intro.cta': 'See the CertivoIQ workflow',
  'intro.startFree': 'Or start free:',
  'intro.startFree.detail': '— 3 certification reviews, no card required.',
  'intro.signature': 'CertivoIQ — compliance intelligence for all 50 states',
  'intro.unsubscribe': 'You received this introduction because your organization operates affordable housing. Reply with "unsubscribe" and we will not contact you again.',
} as const

export type EmailKey = keyof typeof en

const es: Record<EmailKey, string> = {
  'brand.tagline': 'Plataforma de cumplimiento para vivienda asequible',
  'support.subject': 'Recibimos su solicitud de soporte — caso {caseNumber} · CertivoIQ',
  'support.preview': 'Recibimos su solicitud de soporte — caso {caseNumber} · CertivoIQ',
  'support.heading': 'Gracias por comunicarse con nosotros',
  'support.greeting.named': 'Hola {name}:',
  'support.greeting.plain': 'Hola:',
  'support.body': 'hemos recibido su solicitud de soporte y un especialista de CertivoIQ la revisará en breve.',
  'support.caseNumber': 'Número de caso: {caseNumber}',
  'support.pending': 'Pendiente',
  'support.subjectLine': 'Asunto: {subject}',
  'support.turnaround': 'La mayoría de las consultas se responden en un día hábil. Si necesita agregar más detalles, responda a este correo y el caso se actualizará automáticamente.',
  'support.cta': 'Abrir la página de soporte',
  'support.footer': 'Recibe este mensaje porque envió una solicitud a través de la página de soporte de CertivoIQ. Responda a este correo para agregar más detalles.',
  'intro.subject.company': '{company}: proteja sus créditos fiscales antes de la próxima auditoría',
  'intro.subject.generic': 'Proteja sus créditos fiscales antes de la próxima auditoría — CertivoIQ',
  'intro.preview': 'Proteja los créditos fiscales de {company} — revisión de cumplimiento con IA para LIHTC, HOME, Sección 8 y HOTMA',
  'intro.heading.pre': 'Encuentre el riesgo de cumplimiento',
  'intro.heading.accent': 'antes de la auditoría',
  'intro.greeting.named': 'Hola {name}:',
  'intro.greeting.plain': 'Hola:',
  'intro.body': 'CertivoIQ es una plataforma de cumplimiento con inteligencia artificial creada para equipos de vivienda asequible{company}. Lee la evidencia de las certificaciones, aplica el paquete de reglas asignado y devuelve hallazgos trazables y pasos de corrección, manteniendo la aprobación final en manos de un revisor humano.',
  'intro.body.company': ' en {company}',
  'intro.section.what': 'QUÉ HACE LA PLATAFORMA',
  'intro.stat.time': 'Flujo típico de revisión con IA por certificación',
  'intro.stat.states': 'Estados compatibles con paquetes de reglas mantenidos',
  'intro.stat.programs': 'Programas: LIHTC, HOME, S8, HOTMA, RD, bonos',
  'intro.stat.signoff': 'La aprobación final permanece con su equipo',
  'intro.section.vs': 'REVISIÓN MANUAL FRENTE A CERTIVOIQ',
  'intro.bar.manual': 'Revisión manual del expediente',
  'intro.bar.manual.value': 'Trabajo repetitivo de evidencia y mayor duración',
  'intro.bar.ai': 'Revisión con IA de CertivoIQ',
  'intro.bar.ai.value': 'Revisión de evidencia más rápida, después aprobación humana',
  'intro.bar.manualChecks': 'Verificaciones aplicadas manualmente',
  'intro.bar.manualChecks.value': 'dependientes del revisor y laboriosas',
  'intro.bar.aiChecks': 'Verificaciones aplicadas por CertivoIQ',
  'intro.bar.aiChecks.value': 'estandarizadas, trazables y con reglas versionadas',
  'intro.section.benefits': 'CÓMO SE BENEFICIAN LOS EQUIPOS',
  'intro.benefit.1': 'Visibilidad de todo el portafolio: hallazgos, dictámenes y preparación para auditorías en cada propiedad y programa.',
  'intro.benefit.2': 'Revisiones estandarizadas: la misma lógica normativa aplicada de forma consistente entre equipos y estados.',
  'intro.benefit.3': 'Mayor volumen de expedientes sin convertir el cumplimiento en otra carga administrativa.',
  'intro.benefit.4': 'Capacitación de CertivoIQ Academy y certificados de logro para incorporar nuevos revisores.',
  'intro.benefit.5': 'Merlin, el asistente de cumplimiento con IA, explica los hallazgos y cita la norma aplicable cuando un revisor necesita ayuda.',
  'intro.section.pricing': 'PLANES Y PRECIOS',
  'intro.plan.price': '{price}/mes',
  'intro.addons': 'Complementos: paquetes de reglas estatales adicionales $99–$199 por estado al mes · CertivoIQ Academy $49 por usuario al mes o $499 por propiedad al mes · acceso a la API $500–$2,000 al mes · procesamiento de documentos con IA por encima del límite del plan, $3 por certificación cargada.',
  'intro.section.risk': 'EL COSTO DEL INCUMPLIMIENTO',
  'intro.risk.1': 'Hallazgos §42 no subsanables',
  'intro.risk.1.cost': 'Presentación del Formulario 8823 del IRS y recuperación de los créditos asignados',
  'intro.risk.2': 'Auditoría estatal no aprobada',
  'intro.risk.2.cost': 'Acuerdos de reembolso, asignaciones retenidas y daño a la reputación',
  'intro.risk.3': 'Errores de Sección 8 / TRACS',
  'intro.risk.3.cost': 'Reembolso del subsidio y medidas correctivas impuestas por HUD',
  'intro.risk.4': 'Brechas en la implementación de HOTMA',
  'intro.risk.4.cost': 'Errores sistemáticos de recertificación en todo el portafolio',
  'intro.cta': 'Ver el flujo de trabajo de CertivoIQ',
  'intro.startFree': 'O comience gratis:',
  'intro.startFree.detail': '— 3 revisiones de certificación, sin tarjeta.',
  'intro.signature': 'CertivoIQ — inteligencia de cumplimiento para los 50 estados',
  'intro.unsubscribe': 'Recibe esta presentación porque su organización administra vivienda asequible. Responda con "unsubscribe" y no volveremos a contactarle.',
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
