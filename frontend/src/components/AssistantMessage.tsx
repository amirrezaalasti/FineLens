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
      className="ml-0.5 inline-flex cursor-default items-center rounded bg-pink/15 px-1 py-px text-[10px] font-bold text-pink"
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
          <h3 className="mb-2 mt-1 text-base font-bold text-ink">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="mb-3 last:mb-0 leading-relaxed text-ink/90">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-ink">{children}</strong>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 ml-4 list-decimal space-y-3 marker:font-semibold marker:text-pink">
            {children}
          </ol>
        ),
        ul: ({ children }) => (
          <ul className="mb-3 ml-4 list-disc space-y-2 marker:text-pink">{children}</ul>
        ),
        li: ({ children }) => <li className="pl-1 leading-relaxed">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="mt-3 rounded-lg border-l-4 border-pink/60 bg-pink/5 px-3 py-2 text-xs italic text-plum">
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
              className="font-medium text-ink underline decoration-pink/50 hover:text-pink"
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
