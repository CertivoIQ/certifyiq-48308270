/**
 * Spanish copy for the landing-page content lists. Same order and length as
 * the English arrays in `@/lib/trial-data`; the landing page swaps by language.
 */
export const VIDEO_CHAPTERS_ES = [
  {
    time: "0:00",
    title: "Qué es CertivoIQ",
    body: "Un solo sistema de registro de cumplimiento para LIHTC, Sección 8, HOME y HOTMA en los 50 estados.",
  },
  {
    time: "0:40",
    title: "Registrar una propiedad",
    body: "Elija los programas al registrarla y CertivoIQ asigna el paquete de reglas federal y estatal exacto.",
  },
  {
    time: "1:25",
    title: "Cargar el expediente",
    body: "TIC, certificaciones de ingresos, verificaciones, EIV, contratos y documentos de activos: una carpeta a la vez.",
  },
  {
    time: "2:10",
    title: "La revisión con IA",
    body: "Cada campo se extrae y se contrasta con cada regla, y se califica Aprobado o No aprobado con su cita.",
  },
  {
    time: "3:05",
    title: "Correcciones y aprobación",
    body: "Pasos de corrección ordenados con responsables y fechas límite; una persona conserva la aprobación final.",
  },
  {
    time: "3:50",
    title: "El día de la auditoría",
    body: "Hallazgos, plazos y versiones de reglas ya están documentados antes de que el auditor pregunte.",
  },
];

export const PENALTY_RISKS_ES = [
  {
    risk: "Ingreso del hogar mal calculado",
    cost: "Unidad descalificada · créditos recuperados",
    detail:
      "Un bono, un anexo de trabajo por cuenta propia o una imputación de activos que se pasa por alto saca la unidad de cumplimiento por todo el año.",
  },
  {
    risk: "Recertificación tardía o faltante",
    cost: "Hallazgo en el Formulario 8823 del IRS",
    detail:
      "Los calendarios manuales fallan. Una recertificación anual omitida puede poner en duda la reserva de todo un edificio.",
  },
  {
    risk: "Renta o subsidio de servicios incorrecto",
    cost: "Violación de renta bruta, no subsanable",
    detail:
      "Aplicar el subsidio de servicios del año anterior cobra de más al residente y pierde el crédito de esa unidad de forma permanente.",
  },
  {
    risk: "Verificaciones sin firma o vencidas",
    cost: "Expediente rechazado en la auditoría",
    detail:
      "Las verificaciones de terceros con más de 120 días, las firmas faltantes y las certificaciones en blanco son los hallazgos más comunes.",
  },
  {
    risk: "Errores de activos e ingresos bajo HOTMA",
    cost: "Acuerdos de reembolso y sanciones de HUD",
    detail:
      "El límite de activos de $50,000, los rendimientos imputados y las reglas de minimis cambiaron el cálculo de cada expediente después de 2024.",
  },
  {
    risk: "Errores de condición estudiantil y reservas",
    cost: "Incumplimiento de la unidad",
    detail:
      "Los hogares de estudiantes de tiempo completo y las reservas combinadas LIHTC/HOME/Sección 8 confunden incluso a revisores experimentados.",
  },
  {
    risk: "Conflictos entre programas combinados",
    cost: "Hallazgos bajo dos programas a la vez",
    detail:
      "Siempre gana la regla más estricta. Los revisores aplican con frecuencia el umbral del programa equivocado.",
  },
  {
    risk: "Criterio inconsistente entre revisores",
    cost: "Resultados de auditoría impredecibles",
    detail:
      "Dos revisores, dos respuestas. CertivoIQ aplica el mismo paquete de reglas versionado a cada expediente.",
  },
];

export const VALUE_MATH_ES = [
  {
    label: "Una unidad con crédito recuperado",
    value: "$65,000+",
    note: "Valor típico del crédito perdido por un solo hallazgo no subsanable",
  },
  {
    label: "Tiempo de revisión manual",
    value: "41 min → 4 min",
    note: "Por certificación, con las citas ya redactadas",
  },
  {
    label: "Horas de revisión ahorradas al mes",
    value: "~230 h",
    note: "En un portafolio de 5,000 unidades con recertificaciones trimestrales",
  },
  {
    label: "Plan Business de CertivoIQ",
    value: "$1,499/mes",
    note: "Menos que un solo hallazgo. Cada mes.",
  },
];
