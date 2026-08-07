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
 * Spoken at a professional pace with a slight speed boost; total ~21s.
 */
export const EN_VOICEOVER =
  "One uncorrected Section 42 finding: sixty-five thousand dollars gone. " +
  "Reviewers check every certification by hand across five programs and fifty states. " +
  "CertivoIQ checks every line against the rule, flags missing verifications and bad income calculations. " +
  "Cited findings, correction steps, and a Pass or Fail score for human approval. " +
  "Protect your tax credits. Start your seven-day free trial today.";

/**
 * Continuous Spanish narration for the 5-scene animated explainer.
 * Spoken at a professional pace with a slight speed boost; total ~25s.
 */
export const ES_VOICEOVER =
  "Un hallazgo de la Sección 42 sin corregir: sesenta y cinco mil dólares perdidos. " +
  "Revisores revisan cada certificación manualmente entre cinco programas y cincuenta estados. " +
  "CertivoIQ verifica cada partida contra la regla, detecta verificaciones faltantes e ingresos erróneos. " +
  "Hallazgos citados, correcciones y un resultado para la aprobación humana. " +
  "Proteja sus créditos fiscales. Prueba gratuita de siete días.";

export const VOICEOVER_SCRIPTS: Record<VoiceoverLang, string> = {
  en: EN_VOICEOVER,
  es: ES_VOICEOVER,
};
