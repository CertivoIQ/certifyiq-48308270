import enAsset from "@/assets/certivo-explainer-en.mp3.asset.json";
import esAsset from "@/assets/certivo-explainer-es.mp3.asset.json";

export type VoiceoverLang = "en" | "es";

export const VOICEOVER_FILES: Record<VoiceoverLang, { url: string; display: string }> = {
  en: { url: enAsset.url, display: "English" },
  es: { url: esAsset.url, display: "Español" },
};

/**
 * Total length of the explainer animation (ms). Keep narration comfortably
 * under this ceiling so the voiceover finishes before the animation loops.
 */
export const VOICEOVER_DURATION_MS = 26_700;

/**
 * Continuous English narration for the 5-scene animated explainer.
 * Spoken at a professional pace; total ~24s.
 */
export const EN_VOICEOVER =
  "One overlooked Section 42 finding can cost a property sixty-five thousand dollars in recaptured tax credits. " +
  "Your reviewers are checking every certification by hand across LIHTC, Section 8, HOME, HOTMA and bond programs. " +
  "CertivoIQ reviews every line item against the rule that governs it, flags missing verifications, incorrect income calculations, and expired safe harbors. " +
  "It returns cited findings, clear correction steps, and a Pass or Fail score for human final approval. " +
  "Protect your tax credits before the auditor arrives. Start your seven-day free trial today.";

/**
 * Continuous Spanish narration for the 5-scene animated explainer.
 * Spoken at a professional pace; total ~24s.
 */
export const ES_VOICEOVER =
  "Un hallazgo de la Sección 42 pasado por alto puede costarle a una propiedad sesenta y cinco mil dólares en créditos fiscales recapturados. " +
  "Sus revisores revisan cada certificación manualmente entre los programas LIHTC, Section 8, HOME, HOTMA y Bond. " +
  "CertivoIQ revisa cada partida contra la regla que la rige, señala verificaciones faltantes, cálculos de ingresos incorrectos y salvaguardas vencidas. " +
  "Devuelve hallazgos citados, pasos de corrección claros y un resultado de aprobado o no aprobado para la aprobación final humana. " +
  "Proteja sus créditos fiscales antes de que llegue el auditor. Comience su prueba gratuita de siete días hoy.";

export const VOICEOVER_SCRIPTS: Record<VoiceoverLang, string> = {
  en: EN_VOICEOVER,
  es: ES_VOICEOVER,
};
