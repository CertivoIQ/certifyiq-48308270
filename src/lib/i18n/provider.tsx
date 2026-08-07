import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en, type TranslationKey } from "./en";
import { es } from "./es";

export type Lang = "en" | "es";

export const LANG_STORAGE_KEY = "certivoiq-lang";

const DICTS: Record<Lang, Record<string, string>> = { en, es };

export type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translate;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Always start at "en" so SSR markup and the first client render match;
  // the stored preference is applied right after hydration.
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === "es" || stored === "en") setLangState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    localStorage.setItem(LANG_STORAGE_KEY, next);
  }, []);

  const t = useCallback<Translate>(
    (key, vars) => interpolate(DICTS[lang]?.[key] ?? en[key] ?? key, vars),
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (ctx) return ctx;
  // Safe fallback for components rendered outside the provider (e.g. tests).
  return {
    lang: "en",
    setLang: () => {},
    t: (key, vars) => interpolate(en[key] ?? key, vars),
  };
}

/** Translation function only — the common case. */
export function useT(): Translate {
  return useLanguage().t;
}

/** Locale-aware number / currency / date helpers. */
export function useFormatters() {
  const { lang } = useLanguage();
  const locale = lang === "es" ? "es-US" : "en-US";
  return useMemo(
    () => ({
      locale,
      number: (value: number, options?: Intl.NumberFormatOptions) =>
        new Intl.NumberFormat(locale, options).format(value),
      currency: (value: number, currency = "USD") =>
        new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        }).format(value),
      date: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(
          locale,
          options ?? { year: "numeric", month: "short", day: "numeric" },
        ).format(new Date(value)),
    }),
    [locale],
  );
}
