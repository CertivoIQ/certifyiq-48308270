/**
 * Spanish copy for the landing-page content lists. Same order and length as
 * the English arrays in `@/lib/trial-data`; the landing page swaps by language.
 */
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
