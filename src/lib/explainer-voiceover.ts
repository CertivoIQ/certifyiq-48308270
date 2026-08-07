import enAsset from "@/assets/certivo-explainer-en.mp3.asset.json";
import esAsset from "@/assets/certivo-explainer-es.mp3.asset.json";

export type VoiceoverLang = "en" | "es";

export const VOICEOVER_FILES: Record<VoiceoverLang, { url: string; display: string }> = {
  en: { url: enAsset.url, display: "English" },
  es: { url: esAsset.url, display: "Español" },
};

/** Word counts per scene (English and Spanish share the same scene structure). */
export const VOICEOVER_SCENE_WORDS = {
  en: [10, 14, 17, 13, 10],
  es: [11, 15, 17, 12, 8],
};

/**
 * Empirical duration (ms) of each generated voiceover track.
 * Measured from the final MP3 files; used to keep the animated scenes
 * in sync with the narration for each language.
 */
export const VOICEOVER_DURATION_MS: Record<VoiceoverLang, number> = {
  en: 21_288,
  es: 25_224,
};

/** Compute per-scene durations so each slide lasts as long as its narration segment. */
export function getSceneDurations(lang: VoiceoverLang): number[] {
  const words = VOICEOVER_SCENE_WORDS[lang];
  const total = VOICEOVER_DURATION_MS[lang];
  const totalWords = words.reduce((a, b) => a + b, 0);
  return words.map((w) => Math.round((w / totalWords) * total));
}

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
