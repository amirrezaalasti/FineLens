"use client";

import { Globe } from "lucide-react";
import { LOCALES, useTranslation, type Locale } from "@/i18n";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div className="flex items-center gap-1.5">
      <Globe className="hidden h-3.5 w-3.5 text-ink-muted sm:block" />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t("language.label")}
        className="cursor-pointer rounded-lg border border-ink/10 bg-surface-warm px-2 py-1 text-xs font-medium text-ink outline-none transition hover:border-pink/40 hover:text-pink focus:border-pink/50"
      >
        {LOCALES.map((loc) => (
          <option key={loc} value={loc} className="bg-white text-ink">
            {t(`language.${loc}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
