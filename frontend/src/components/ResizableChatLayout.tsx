"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "@/i18n";

const STORAGE_KEY = "finelens-panel-widths";

interface PanelWidths {
  sidebar: number;
  citations: number;
}

const DEFAULT_WIDTHS: PanelWidths = {
  sidebar: 260,
  citations: 400,
};

const MIN_WIDTHS: PanelWidths = {
  sidebar: 200,
  citations: 280,
};

const MIN_CHAT_WIDTH = 320;

interface ResizableChatLayoutProps {
  sidebar: ReactNode;
  chat: ReactNode;
  citations: ReactNode;
  isAnalysisActive?: boolean;
}

function loadWidths(): PanelWidths {
  if (typeof window === "undefined") return DEFAULT_WIDTHS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_WIDTHS;
    const parsed = JSON.parse(stored) as PanelWidths;
    return {
      sidebar: parsed.sidebar ?? DEFAULT_WIDTHS.sidebar,
      citations: parsed.citations ?? DEFAULT_WIDTHS.citations,
    };
  } catch {
    return DEFAULT_WIDTHS;
  }
}

function PanelResizer({ onDrag }: { onDrag: (delta: number) => void }) {
  const { t } = useTranslation();
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    lastX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onDrag(delta);
    },
    [onDrag]
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t("layout.resizePanels")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="group relative z-10 hidden w-2 shrink-0 cursor-col-resize lg:block"
    >
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-navy/10 transition group-hover:bg-gold/60 group-active:bg-gold" />
      <div className="absolute left-1/2 top-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-navy/15 opacity-0 transition group-hover:opacity-100 group-active:bg-gold group-active:opacity-100" />
    </div>
  );
}

export function ResizableChatLayout({
  sidebar,
  chat,
  citations,
  isAnalysisActive,
}: ResizableChatLayoutProps) {
  const [widths, setWidths] = useState<PanelWidths>(DEFAULT_WIDTHS);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastNormalWidth = useRef(DEFAULT_WIDTHS.citations);
  const isFirstMount = useRef(true);

  useEffect(() => {
    setWidths(loadWidths());
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  }, [widths]);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (isAnalysisActive) {
      lastNormalWidth.current = widths.citations;
      setWidths((prev) => {
        const containerWidth = containerRef.current?.clientWidth ?? 1200;
        const maxCitations = containerWidth - prev.sidebar - MIN_CHAT_WIDTH - 16;
        const targetCitations = Math.min(Math.max(prev.citations, 750), maxCitations);
        return { ...prev, citations: targetCitations };
      });
    } else {
      setWidths((prev) => {
        const containerWidth = containerRef.current?.clientWidth ?? 1200;
        const maxCitations = containerWidth - prev.sidebar - MIN_CHAT_WIDTH - 16;
        const targetCitations = Math.min(lastNormalWidth.current, maxCitations);
        return { ...prev, citations: targetCitations };
      });
    }
  }, [isAnalysisActive]);

  const clampWidths = useCallback((next: PanelWidths): PanelWidths => {
    const containerWidth = containerRef.current?.clientWidth ?? 1200;
    const resizerSpace = 16;
    const maxSidebar = containerWidth - next.citations - MIN_CHAT_WIDTH - resizerSpace;
    const maxCitations = containerWidth - next.sidebar - MIN_CHAT_WIDTH - resizerSpace;

    return {
      sidebar: Math.min(Math.max(next.sidebar, MIN_WIDTHS.sidebar), Math.max(MIN_WIDTHS.sidebar, maxSidebar)),
      citations: Math.min(Math.max(next.citations, MIN_WIDTHS.citations), Math.max(MIN_WIDTHS.citations, maxCitations)),
    };
  }, []);

  const resizeSidebar = useCallback(
    (delta: number) => {
      setWidths((prev) => clampWidths({ ...prev, sidebar: prev.sidebar + delta }));
    },
    [clampWidths]
  );

  const resizeCitations = useCallback(
    (delta: number) => {
      setWidths((prev) => clampWidths({ ...prev, citations: prev.citations - delta }));
    },
    [clampWidths]
  );

  return (
    <>
      {/* Mobile: stacked, each panel scrolls internally */}
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden lg:hidden">
        <div className="h-36 shrink-0 overflow-hidden">{sidebar}</div>
        <div className="min-h-0 flex-1 overflow-hidden">{chat}</div>
        <div className="min-h-0 flex-1 overflow-hidden">{citations}</div>
      </div>

      {/* Desktop: resizable row */}
      <div ref={containerRef} className="hidden h-full min-w-0 lg:flex">
        <div className="h-full shrink-0 overflow-hidden" style={{ width: widths.sidebar }}>
          {sidebar}
        </div>

        <PanelResizer onDrag={resizeSidebar} />

        <div className="h-full min-w-0 flex-1 overflow-hidden">{chat}</div>

        <PanelResizer onDrag={resizeCitations} />

        <div className="h-full shrink-0 overflow-hidden" style={{ width: widths.citations }}>
          {citations}
        </div>
      </div>
    </>
  );
}
