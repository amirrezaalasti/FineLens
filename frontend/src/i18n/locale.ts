export type Locale = "de" | "en";

export const LOCALES: Locale[] = ["de", "en"];
export const LOCALE_COOKIE = "finelens-locale";

export function parseLocale(value: string | undefined | null): Locale {
  return value === "en" ? "en" : "de";
}
