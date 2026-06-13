"use client";

import { ExternalLink, FileText, Shield } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { Citation } from "@/lib/types";

interface CitationsPanelProps {
  citations: Citation[];
  transparencyNote?: string;
}

const SOURCE_LABELS: Record<string, string> = {
  "de.openlegaldata.io": "Open Legal Data",
  "gesetze-im-internet.de": "Gesetze im Internet",
  "recht.bund.de": "recht.bund.de",
  "beck-online.beck.de": "beck-online",
  "juris.de": "juris",
  "buzer.de": "buzer.de",
};

export function CitationsPanel({ citations, transparencyNote }: CitationsPanelProps) {
  const { t } = useTranslation();

  return (
    <aside className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
      <div className="border-b border-ink/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-pink" />
          <h2 className="font-semibold text-ink">{t("citations.title")}</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">{t("citations.subtitle")}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {citations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink/15 p-6 text-center text-sm text-slate-500">
            <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            {t("citations.empty")}
          </div>
        ) : (
          [...citations]
            .sort((a, b) => (a.ref_number || 0) - (b.ref_number || 0))
            .map((c, i) => (
              <article
                key={`${c.ref_number || i + 1}-${c.title}-${i}`}
                className="animate-fade-up rounded-xl border border-ink/8 bg-white p-3 shadow-sm"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-pink text-[10px] font-bold text-ink">
                      {c.ref_number || i + 1}
                    </span>
                    <span className="rounded bg-ink/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink/70">
                      {SOURCE_LABELS[c.source] || c.source}
                    </span>
                  </div>
                  <span className="shrink-0 text-[10px] text-slate-400">
                    {Math.round(c.confidence * 100)}%
                  </span>
                </div>

                {c.law_reference ? (
                  <h3 className="font-mono text-sm font-bold text-pink">{c.law_reference}</h3>
                ) : (
                  <h3 className="text-sm font-semibold text-ink">{c.title}</h3>
                )}

                {c.law_reference && c.title && c.title !== c.law_reference && (
                  <p className="mt-0.5 text-xs text-slate-500">{c.title}</p>
                )}

                <blockquote className="mt-2 rounded-lg border-l-2 border-pink/40 bg-surface/80 px-3 py-2 text-xs leading-relaxed text-slate-700">
                  {c.excerpt}
                </blockquote>

                {c.source_url && (
                  <a
                    href={c.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ink hover:text-pink"
                  >
                    {t("citations.openOriginal")} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </article>
            ))
        )}
      </div>

      {transparencyNote && (
        <div className="border-t border-ink/10 bg-amber-50/80 p-3 text-xs leading-relaxed text-amber-900">
          {transparencyNote}
        </div>
      )}
    </aside>
  );
}
