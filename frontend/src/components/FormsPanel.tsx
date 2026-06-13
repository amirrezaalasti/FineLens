"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Download, FileEdit, Sparkles } from "lucide-react";
import { getForms } from "@/lib/api";
import { useTranslation } from "@/i18n";
import type { FormField, LegalForm } from "@/lib/types";

interface FormsPanelProps {
  userId: string;
  suggestedForms?: LegalForm[];
}

export function FormsPanel({ userId, suggestedForms = [] }: FormsPanelProps) {
  const { t, locale } = useTranslation();
  const [forms, setForms] = useState<LegalForm[]>([]);
  const [activeForm, setActiveForm] = useState<LegalForm | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getForms(userId, locale)
      .then((loaded) => {
        setForms(loaded);
        if (activeForm) {
          const refreshed = loaded.find((f) => f.id === activeForm.id);
          if (refreshed) {
            setActiveForm(refreshed);
            const values: Record<string, string> = {};
            refreshed.fields.forEach((f) => {
              values[f.id] = fieldValues[f.id] ?? f.value;
            });
            setFieldValues(values);
          }
        }
      })
      .catch(() => setForms([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, locale]);

  useEffect(() => {
    if (suggestedForms.length > 0 && !activeForm) {
      openForm(suggestedForms[0]);
    }
  }, [suggestedForms]);

  const openForm = (form: LegalForm) => {
    setActiveForm(form);
    const values: Record<string, string> = {};
    form.fields.forEach((f) => {
      values[f.id] = f.value;
    });
    setFieldValues(values);
  };

  const updateField = (id: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [id]: value }));
  };

  const exportForm = () => {
    if (!activeForm) return;
    const letterBody = activeForm.body_template
      ? activeForm.fields.reduce(
          (body, f) => body.replaceAll(`{{${f.id}}}`, fieldValues[f.id] || `[${f.label}]`),
          activeForm.body_template
        )
      : null;

    const lines = letterBody
      ? [
          activeForm.title,
          "=".repeat(activeForm.title.length),
          "",
          letterBody,
          "",
          `${t("common.legalBasis")}: ${activeForm.legal_basis.join(", ")}`,
          `${t("common.source")}: ${activeForm.source_url}`,
        ]
      : [
          activeForm.title,
          "=".repeat(activeForm.title.length),
          "",
          activeForm.description,
          "",
          ...activeForm.fields.map((f) => `${f.label}: ${fieldValues[f.id] || ""}`),
          "",
          `${t("common.legalBasis")}: ${activeForm.legal_basis.join(", ")}`,
          `${t("common.source")}: ${activeForm.source_url}`,
        ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeForm.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderField = (field: FormField) => {
    const common = {
      value: fieldValues[field.id] ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        updateField(field.id, e.target.value),
      className:
        "w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink/40",
      placeholder: field.placeholder,
    };

    if (field.type === "textarea") {
      return <textarea rows={4} {...common} />;
    }
    return <input type={field.type === "number" ? "number" : field.type} {...common} />;
  };

  const uniqueSuggestedIds = [...new Set(suggestedForms.map((s) => s.id))];
  const uniqueSuggested = uniqueSuggestedIds
    .map((id) => forms.find((f) => f.id === id) ?? suggestedForms.find((s) => s.id === id))
    .filter((f): f is LegalForm => Boolean(f));
  const suggestedIds = new Set(uniqueSuggested.map((s) => s.id));
  const displayForms = [
    ...uniqueSuggested,
    ...forms.filter((f) => !suggestedIds.has(f.id)),
  ];

  return (
    <div className="mx-auto grid max-w-6xl gap-4 sm:gap-6 lg:grid-cols-5">
      <div className={`lg:col-span-2 ${activeForm ? "hidden lg:block" : ""}`}>
        <div className="glass rounded-3xl p-4">
          <h2 className="mb-1 font-semibold text-ink">{t("forms.title")}</h2>
          <p className="mb-4 text-xs text-slate-500">{t("forms.subtitle")}</p>

          {loading ? (
            <p className="text-sm text-slate-400">{t("common.loading")}</p>
          ) : (
            <div className="space-y-2">
              {displayForms.map((form) => {
                const isSuggested = uniqueSuggested.some((s) => s.id === form.id);
                return (
                  <button
                    key={form.id}
                    onClick={() => openForm(form)}
                    className={`w-full rounded-2xl border bg-white p-3 text-left shadow-sm transition ${
                      activeForm?.id === form.id
                        ? "border-pink/40 ring-1 ring-pink/20"
                        : "border-ink/5 hover:border-pink/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink/15">
                        <FileEdit className="h-4 w-4 text-pink" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-ink-muted">{form.category}</p>
                        <p className="text-sm font-bold text-ink">{form.title}</p>
                      </div>
                      {isSuggested && (
                        <span className="flex items-center gap-0.5 rounded-full bg-pink/20 px-2 py-0.5 text-[10px] font-semibold text-ink">
                          <Sparkles className="h-3 w-3" /> {t("common.ai")}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className={`lg:col-span-3 ${!activeForm ? "hidden lg:block" : ""}`}>
        {activeForm ? (
          <div className="glass rounded-3xl p-4 sm:p-6">
            <div className="mb-6 flex items-start justify-between gap-3 sm:gap-4">
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setActiveForm(null)}
                  className="mb-3 flex items-center gap-1.5 text-xs font-medium text-slate-500 transition active:text-ink lg:hidden touch-manipulation"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {t("common.back")}
                </button>
                <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink/60">
                  {activeForm.category}
                </span>
                <h3 className="mt-2 font-bold text-xl font-semibold text-ink">
                  {activeForm.title}
                </h3>
                <p className="mt-1 text-sm text-slate-600">{activeForm.description}</p>
                {activeForm.legal_basis.length > 0 && (
                  <p className="mt-2 font-mono text-xs text-pink">
                    {activeForm.legal_basis.join(" · ")}
                  </p>
                )}
              </div>
              <button
                onClick={exportForm}
                className="flex shrink-0 items-center gap-2 rounded-2xl bg-pink px-3 py-2.5 text-xs font-bold text-white transition hover:bg-pink-dark active:scale-95 touch-manipulation"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("common.export")}</span>
              </button>
            </div>

            <div className="space-y-4">
              {activeForm.fields.map((field) => (
                <div key={field.id}>
                  <label className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-600">
                    {field.label}
                    {field.required && <span className="text-red-400">*</span>}
                    {field.prefilled_from && field.value && (
                      <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] text-green-700">
                        {t("common.fromProfile")}
                      </span>
                    )}
                  </label>
                  {renderField(field)}
                </div>
              ))}
            </div>

            {activeForm.body_template && (
              <div className="mt-6 rounded-xl border border-ink/10 bg-surface/40 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">
                  {t("forms.letterPreview")}
                </p>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink/90">
                  {activeForm.fields.reduce(
                    (body, f) =>
                      body.replaceAll(`{{${f.id}}}`, fieldValues[f.id] || `[${f.label}]`),
                    activeForm.body_template
                  )}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="glass flex flex-col items-center justify-center rounded-2xl p-12 text-center shadow-sm">
            <FileEdit className="mb-4 h-12 w-12 text-slate-300" />
            <p className="font-medium text-ink">{t("forms.selectTitle")}</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {t("forms.selectDescription")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
