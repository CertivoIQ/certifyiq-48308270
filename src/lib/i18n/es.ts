import type { Dictionary } from "./en";

/**
 * Spanish translations. Program names, statute citations and form numbers
 * (LIHTC, HOTMA, HOME, NSPIRE, §42, IRS Form 8823, TRACS) stay untranslated
 * because agencies use the English terms in Spanish-language markets too.
 */
export const es: Dictionary = {
  // ---- common ----
  "common.language": "Idioma",
  "common.english": "English",
  "common.spanish": "Español",
  "common.switchToSpanish": "Cambiar a español",
  "common.switchToEnglish": "Cambiar a inglés",
  "common.save": "Guardar",
  "common.cancel": "Cancelar",
  "common.close": "Cerrar",
  "common.units": "unidades",
  "common.findings": "hallazgos",
  "common.overdueRecerts": "recertificaciones vencidas",
  "common.days": "días",
  "common.perMonth": "/mes",

  // ---- navigation ----
  "nav.dashboard": "Panel principal",
  "nav.properties": "Propiedades",
  "nav.files": "Certificaciones",
  "nav.findings": "Hallazgos",
  "nav.rules": "Paquetes de reglas",
  "nav.submissions": "Envíos a la agencia",
  "nav.agency": "Consola de la agencia",
  "nav.copilot": "Copiloto de IA",
  "nav.academy": "CertivoIQ Academy",
  "nav.launchpad": "LaunchPad",
  "nav.trial": "Mi prueba gratuita",
  "nav.pricing": "Planes y precios",
  "nav.security": "Seguridad",
  "nav.billing": "Cuenta y facturación",
  "nav.support": "Contactar soporte",
  "nav.crm": "CRM de CertivoIQ",
  "nav.toggle": "Mostrar u ocultar la navegación",

  // ---- shell ----
  "shell.tagline": "Inteligencia de cumplimiento",
  "shell.rulePacksActive": "Paquetes de reglas activos",
  "shell.statesBuild": "50 estados · versión 2026.08",
  "shell.trial.status":
    "Prueba gratuita · quedan {daysLeft} de {daysTotal} días · {used}/{allowed} revisiones de certificación usadas",
  "shell.trial.watchDemo": "Ver la demostración",
  "shell.trial.upgrade": "Mejorar ahora",

  // ---- errors ----
  "error.notFound.title": "Página no encontrada",
  "error.notFound.body": "La página que busca no existe o fue movida.",
  "error.goHome": "Ir al inicio",
  "error.generic.title": "Esta página no se cargó",
  "error.generic.body":
    "Ocurrió un problema de nuestro lado. Puede volver a intentarlo o regresar al inicio.",
  "error.tryAgain": "Volver a intentar",

  // ---- welcome / marketing ----
  "welcome.nav.support": "Contactar soporte",
  "welcome.nav.pricing": "Precios",
  "welcome.nav.open": "Abrir la plataforma",
  "welcome.pill": "Quedan {daysLeft} días · {allowed} revisiones de certificación con IA gratis",
  "welcome.hero.title.pre": "El sistema operativo del",
  "welcome.hero.title.accent": "cumplimiento en vivienda asequible",
  "welcome.hero.body":
    "CertivoIQ revisa las certificaciones de LIHTC, HOME, Section 8 y HOTMA según el paquete de reglas asignado a cada propiedad, entrega un resultado de Aprobado o No aprobado con hallazgos citados y pasos de corrección, y lo envía a una persona para la aprobación final.",
  "welcome.cta.trial": "Comience su prueba de 7 días",
  "welcome.cta.sample": "Ver una certificación revisada",
  "welcome.video.label": "Video explicativo de inteligencia de cumplimiento de CertivoIQ",
  "welcome.video.trialCta": "Comience la prueba de 7 días",
  "welcome.risks.title": "Lo que una revisión manual pasa por alto — y lo que cuesta",
  "welcome.risks.body":
    "Cada punto a continuación es una causa real de multas, acuerdos de reembolso, hallazgos en el IRS Form 8823 o recaptura de créditos fiscales. La revisión manual detecta la mayoría, casi siempre. CertivoIQ los verifica todos, siempre.",
  "welcome.value.title": "Compare CertivoIQ con su costo actual de cumplimiento",
  "welcome.value.body":
    "Ingrese sus propias cifras a continuación. CertivoIQ no estima sus ahorros ni garantiza evitar hallazgos, multas o recaptura de créditos — todos los planes comienzan con una {offer}.",
  "welcome.why.1.title": "Sus créditos fiscales quedan intactos",
  "welcome.why.1.body":
    "Un solo hallazgo §42 sin corregir puede provocar un IRS Form 8823 y poner en riesgo los créditos asignados. CertivoIQ lo detecta cuando aún se puede subsanar.",
  "welcome.why.2.title": "Menos hallazgos en auditoría",
  "welcome.why.2.body":
    "Cada certificación recibe un resultado de Aprobado o No aprobado según el paquete de reglas exacto asignado a esa propiedad, con los pasos de corrección redactados.",
  "welcome.why.3.title": "Minutos, no horas",
  "welcome.why.3.body":
    "Las revisiones bajan de unos 41 minutos de trabajo manual a cerca de 4 minutos, y una persona conserva la autoridad de aprobación final.",
  "welcome.close.title": "Su prueba termina en {daysLeft} días",
  "welcome.close.body":
    "Al terminar la prueba, conserve revisiones ilimitadas de certificaciones, paquetes de reglas estatales y la capacitación de Academy con el plan {plan} por {price}/mes.",
  "welcome.close.cta": "Comprar un plan",

  // ---- dashboard ----
  "dash.title": "Panel de CertivoIQ",
  "dash.subtitle":
    "Meridian Housing Partners · 185 propiedades · 14 estados · periodo que termina el 6 de agosto de 2026",
  "dash.export": "Exportar informe para la junta",
  "dash.reviewQueue": "Cola de revisión",
  "dash.stat.properties": "Propiedades",
  "dash.stat.properties.hint": "{units} unidades administradas",
  "dash.stat.openFindings": "Hallazgos abiertos",
  "dash.stat.openFindings.hint": "22 % menos en seis meses",
  "dash.stat.exposure": "Exposición al 8823",
  "dash.stat.exposure.hint": "Unidades en riesgo de reporte en el IRS Form 8823",
  "dash.stat.autoApproval": "Aprobación preliminar automática",
  "dash.stat.autoApproval.hint": "{minutes} min de revisión promedio",
  "dash.risk.title": "Trayectoria del riesgo",
  "dash.risk.desc": "Puntaje de riesgo del portafolio y hallazgos abiertos, últimos seis meses",
  "dash.risk.note":
    "El puntaje de riesgo mejoró 20 puntos desde la implementación del paquete de reglas HOTMA v2.0.",
  "dash.readiness.title": "Preparación por programa",
  "dash.readiness.hotma": "Preparación para HOTMA",
  "dash.readiness.nspire": "Preparación para NSPIRE",
  "dash.byProgram.title": "Hallazgos por programa",
  "dash.topRisk.title": "Propiedades de mayor riesgo",
  "dash.topRisk.desc": "Ordenadas por probabilidad prevista de hallazgos de la agencia",
  "dash.topRisk.all": "Todas las propiedades",
  "dash.obligations.title": "Obligaciones próximas",
  "dash.obligations.recerts": "Recertificaciones por vencer (30 días)",
  "dash.obligations.audits": "Auditorías de agencia programadas",
  "dash.obligations.nspire": "Inspecciones NSPIRE",
  "dash.obligations.interim": "Certificaciones interinas pendientes",
  "dash.obligations.softApproval": "Archivos en espera de aprobación preliminar",

  // ---- property correspondence language ----
  "property.language.label": "Idioma de correspondencia",
  "property.language.help":
    "Los correos y avisos impresos de esta propiedad se envían en este idioma.",
  "property.language.saved": "Se actualizó el idioma de correspondencia",

  // ---- merlin ----
  "merlin.greeting":
    "¡Saludos! Soy Merlín, su mago del cumplimiento. Pregúnteme sobre cualquier regla de LIHTC, HOME, Section 8 o HOTMA y le daré la cita normativa.",
  "merlin.placeholder": "Pregúntele a Merlín sobre una regla de cumplimiento…",
  "merlin.open": "Chatear con Merlín",
};
