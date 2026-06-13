"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { de } from "./messages/de";
import { en } from "./messages/en";
import { LOCALE_COOKIE, type Locale } from "./locale";

export type { Locale } from "./locale";
export { LOCALES, LOCALE_COOKIE, parseLocale } from "./locale";

const STORAGE_KEY = "finelens-locale";

const messages = { de, en } as const;

type MessageTree = typeof de;

function persistLocale(locale: Locale) {
  localStorage.setItem(STORAGE_KEY, locale);
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;SameSite=Lax`;
}

function getNested(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as object)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cur;
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`
  );
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  tArray: (key: string) => string[];
  dateLocale: string;
  speechLocale: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
}

export function I18nProvider({ children, initialLocale = "de" }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    setLocaleState(initialLocale);
  }, [initialLocale]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "de" || stored === "en") {
      if (stored !== initialLocale) {
        setLocaleState(stored);
        document.cookie = `${LOCALE_COOKIE}=${stored};path=/;max-age=31536000;SameSite=Lax`;
      } else {
        localStorage.setItem(STORAGE_KEY, initialLocale);
      }
      return;
    }
    localStorage.setItem(STORAGE_KEY, initialLocale);
  }, [initialLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const value = getNested(messages[locale] as unknown as Record<string, unknown>, key);
      if (typeof value === "string") return interpolate(value, vars);
      return key;
    },
    [locale]
  );

  const tArray = useCallback(
    (key: string) => {
      const value = getNested(messages[locale] as unknown as Record<string, unknown>, key);
      return Array.isArray(value) ? (value as string[]) : [];
    },
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      tArray,
      dateLocale: locale === "de" ? "de-DE" : "en-US",
      speechLocale: locale === "de" ? "de-DE" : "en-US",
    }),
    [locale, setLocale, t, tArray]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within I18nProvider");
  return ctx;
}

export type { MessageTree };
