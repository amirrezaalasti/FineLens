"use client";

import { Globe } from "lucide-react";
import { LOCALES, useTranslation, type Locale } from "@/i18n";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div className="flex items-center gap-1.5">
      <Globe className="hidden h-3.5 w-3.5 text-white/50 sm:block" />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t("language.label")}
        className="cursor-pointer rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-medium text-white/80 outline-none transition hover:border-gold/40 hover:text-white focus:border-gold/50"
      >
        {LOCALES.map((loc) => (
          <option key={loc} value={loc} className="bg-navy text-white">
            {t(`language.${loc}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
