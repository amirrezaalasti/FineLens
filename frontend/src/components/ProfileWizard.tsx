"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, User } from "lucide-react";
import { getProfile, saveProfile } from "@/lib/api";
import { LOCALES, useTranslation, type Locale } from "@/i18n";
import type { UserProfile } from "@/lib/types";

interface ProfileWizardProps {
  userId: string;
  onComplete?: () => void;
}

const STEP_IDS = ["personal", "address", "case"] as const;
const TOPIC_IDS = ["mietrecht", "arbeitsrecht", "datenschutz", "vertragsrecht", "familienrecht"];

const EMPTY: UserProfile = {
  id: "default",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  street: "",
  postal_code: "",
  city: "",
  country: "",
  date_of_birth: "",
  nationality: "",
  legal_topic: "",
  case_description: "",
  preferred_language: "de",
};

export function ProfileWizard({ userId, onComplete }: ProfileWizardProps) {
  const { t, locale, setLocale } = useTranslation();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<UserProfile>({
    ...EMPTY,
    id: userId,
    country: t("profile.defaults.country"),
    nationality: t("profile.defaults.nationality"),
    preferred_language: locale,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getProfile(userId)
      .then((p) => {
        setProfile(p);
        if (p.preferred_language === "de" || p.preferred_language === "en") {
          setLocale(p.preferred_language as Locale);
        }
      })
      .catch(() => {
        setProfile((prev) => ({
          ...prev,
          id: userId,
          country: prev.country || t("profile.defaults.country"),
          nationality: prev.nationality || t("profile.defaults.nationality"),
        }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, setLocale]);

  const update = (field: keyof UserProfile, value: string) => {
    setProfile((p) => ({ ...p, [field]: value }));
    setSaved(false);
    if (field === "preferred_language" && (value === "de" || value === "en")) {
      setLocale(value as Locale);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProfile({ ...profile, preferred_language: locale });
      setSaved(true);
      if (step === STEP_IDS.length - 1) onComplete?.();
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink/40";

  const stepTitle = (id: (typeof STEP_IDS)[number]) => {
    if (id === "case") return t("profile.steps.legal");
    return t(`profile.steps.${id}`);
  };

  return (
    <div className="glass mx-auto max-w-2xl rounded-2xl p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink/5">
          <User className="h-6 w-6 text-ink" />
        </div>
        <div>
          <h2 className="font-bold text-xl font-semibold text-ink">{t("profile.title")}</h2>
          <p className="text-sm text-slate-500">{t("profile.subtitle")}</p>
        </div>
      </div>

      <div className="mb-8 flex gap-2">
        {STEP_IDS.map((id, i) => (
          <button
            key={id}
            onClick={() => setStep(i)}
            className={`flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition ${
              i === step
                ? "bg-pink text-white"
                : i < step
                  ? "bg-green-50 text-green-800"
                  : "bg-ink/5 text-slate-500"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                i < step ? "bg-green-500 text-white" : "bg-white/20"
              }`}
            >
              {i < step ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className="hidden sm:inline">{stepTitle(id)}</span>
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t("profile.fields.firstName")}
            </label>
            <input
              className={inputClass}
              value={profile.first_name}
              onChange={(e) => update("first_name", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t("profile.fields.lastName")}
            </label>
            <input
              className={inputClass}
              value={profile.last_name}
              onChange={(e) => update("last_name", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t("profile.fields.email")}
            </label>
            <input
              type="email"
              className={inputClass}
              value={profile.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t("profile.fields.phone")}
            </label>
            <input
              className={inputClass}
              value={profile.phone}
              onChange={(e) => update("phone", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t("profile.fields.dateOfBirth")}
            </label>
            <input
              type="date"
              className={inputClass}
              value={profile.date_of_birth}
              onChange={(e) => update("date_of_birth", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t("profile.fields.nationality")}
            </label>
            <input
              className={inputClass}
              value={profile.nationality}
              onChange={(e) => update("nationality", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t("profile.fields.preferredLanguage")}
            </label>
            <select
              className={inputClass}
              value={profile.preferred_language}
              onChange={(e) => update("preferred_language", e.target.value)}
            >
              {LOCALES.map((loc) => (
                <option key={loc} value={loc}>
                  {t(`language.${loc}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t("profile.fields.street")}
            </label>
            <input
              className={inputClass}
              value={profile.street}
              onChange={(e) => update("street", e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                {t("profile.fields.postalCode")}
              </label>
              <input
                className={inputClass}
                value={profile.postal_code}
                onChange={(e) => update("postal_code", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                {t("profile.fields.city")}
              </label>
              <input
                className={inputClass}
                value={profile.city}
                onChange={(e) => update("city", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t("profile.fields.country")}
            </label>
            <input
              className={inputClass}
              value={profile.country}
              onChange={(e) => update("country", e.target.value)}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t("profile.fields.legalTopic")}
            </label>
            <select
              className={inputClass}
              value={profile.legal_topic}
              onChange={(e) => update("legal_topic", e.target.value)}
            >
              <option value="">{t("common.pleaseSelect")}</option>
              {TOPIC_IDS.map((topic) => (
                <option key={topic} value={topic}>
                  {t(`profile.topics.${topic}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t("profile.fields.caseDescription")}
            </label>
            <textarea
              rows={5}
              className={inputClass}
              placeholder={t("profile.casePlaceholder")}
              value={profile.case_description}
              onChange={(e) => update("case_description", e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="text-sm text-slate-500 disabled:opacity-30"
        >
          {t("common.back")}
        </button>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" /> {t("common.saved")}
            </span>
          )}
          {step < STEP_IDS.length - 1 ? (
            <button
              onClick={() => {
                handleSave();
                setStep((s) => s + 1);
              }}
              className="flex items-center gap-2 rounded-xl bg-pink px-5 py-2.5 text-sm font-medium text-white hover:bg-pink-dark"
            >
              {t("common.next")} <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-2xl bg-pink px-5 py-2.5 text-sm font-bold text-white hover:bg-pink-dark disabled:opacity-50"
            >
              {saving ? t("common.saving") : t("common.save")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
