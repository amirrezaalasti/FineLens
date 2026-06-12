"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "@/i18n";
import type { Citation } from "@/lib/types";

interface AssistantMessageProps {
  content: string;
  citations?: Citation[];
}

function CitationRef({
  num,
  citations,
}: {
  num: number;
  citations?: Citation[];
}) {
  const { t } = useTranslation();
  const citation = citations?.find((c) => c.ref_number === num);
  const label =
    citation?.law_reference ||
    citation?.title ||
    t("citations.sourceFallback", { num });

  return (
    <sup
      className="ml-0.5 inline-flex cursor-default items-center rounded bg-gold/15 px-1 py-px text-[10px] font-bold text-gold"
      title={label}
    >
      {num}
    </sup>
  );
}

export function AssistantMessage({ content, citations }: AssistantMessageProps) {
  const markdown = content.replace(/\[(\d+)\]/g, "[$1](cite:$1)");

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h3: ({ children }) => (
          <h3 className="mb-2 mt-1 font-serif text-base font-semibold text-navy">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="mb-3 last:mb-0 leading-relaxed text-navy/90">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-navy">{children}</strong>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 ml-4 list-decimal space-y-3 marker:font-semibold marker:text-gold">
            {children}
          </ol>
        ),
        ul: ({ children }) => (
          <ul className="mb-3 ml-4 list-disc space-y-2 marker:text-gold">{children}</ul>
        ),
        li: ({ children }) => <li className="pl-1 leading-relaxed">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="mt-3 rounded-lg border-l-4 border-gold/60 bg-amber-50/60 px-3 py-2 text-xs italic text-amber-900">
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => {
          if (href?.startsWith("cite:")) {
            const num = parseInt(href.slice(5), 10);
            return <CitationRef num={num} citations={citations} />;
          }
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-navy underline decoration-gold/50 hover:text-gold"
            >
              {children}
            </a>
          );
        },
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}
