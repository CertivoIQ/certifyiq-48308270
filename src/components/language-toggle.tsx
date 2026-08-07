import { Languages } from "lucide-react";
import { useLanguage } from "@/lib/i18n/provider";

/** EN / ES switch. Sits beside the light/dark toggle in the header. */
export function LanguageToggle() {
  const { lang, setLang, t } = useLanguage();
  const next = lang === "es" ? "en" : "es";

  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      aria-label={next === "es" ? t("common.switchToSpanish") : t("common.switchToEnglish")}
      title={next === "es" ? t("common.switchToSpanish") : t("common.switchToEnglish")}
      className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[12px] font-semibold uppercase tracking-wide text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <Languages className="size-4" strokeWidth={1.9} />
      {lang === "es" ? "ES" : "EN"}
    </button>
  );
}
