"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "@/i18n";

const STORAGE_KEY = "finelens-panel-widths";

export type MobileChatPanel = "sidebar" | "chat" | "sources";

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
  mobilePanel?: MobileChatPanel;
  onMobilePanelChange?: (panel: MobileChatPanel) => void;
  sourcesBadge?: number;
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
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-ink/10 transition group-hover:bg-pink/60 group-active:bg-pink" />
      <div className="absolute left-1/2 top-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/15 opacity-0 transition group-hover:opacity-100 group-active:bg-pink group-active:opacity-100" />
    </div>
  );
}

function MobileSubpanelHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="mb-3 flex shrink-0 items-center gap-2 lg:hidden">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 rounded-xl px-2 py-2 text-sm font-semibold text-ink transition touch-manipulation active:bg-surface-warm"
      >
        <ChevronLeft className="h-4 w-4" />
        {t("common.back")}
      </button>
      <h2 className="truncate text-sm font-bold text-ink">{title}</h2>
    </div>
  );
}

export function ResizableChatLayout({
  sidebar,
  chat,
  citations,
  mobilePanel: controlledPanel,
  onMobilePanelChange,
}: ResizableChatLayoutProps) {
  const { t } = useTranslation();
  const [widths, setWidths] = useState<PanelWidths>(DEFAULT_WIDTHS);
  const [internalPanel, setInternalPanel] = useState<MobileChatPanel>("chat");
  const containerRef = useRef<HTMLDivElement>(null);

  const mobilePanel = controlledPanel ?? internalPanel;
  const setMobilePanel = onMobilePanelChange ?? setInternalPanel;

  useEffect(() => {
    setWidths(loadWidths());
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  }, [widths]);

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
      {/* Mobile: single active panel; sub-panels use a back header instead of a tab bar */}
      <div className="flex h-full min-h-0 flex-col overflow-hidden lg:hidden">
        {mobilePanel === "sidebar" && (
          <MobileSubpanelHeader
            title={t("layout.mobile.chats")}
            onBack={() => setMobilePanel("chat")}
          />
        )}
        {mobilePanel === "sources" && (
          <MobileSubpanelHeader
            title={t("layout.mobile.sources")}
            onBack={() => setMobilePanel("chat")}
          />
        )}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            className={`absolute inset-0 overflow-hidden ${
              mobilePanel === "sidebar" ? "visible z-10" : "invisible pointer-events-none z-0"
            }`}
            aria-hidden={mobilePanel !== "sidebar"}
          >
            {sidebar}
          </div>
          <div
            className={`absolute inset-0 overflow-hidden ${
              mobilePanel === "chat" ? "visible z-10" : "invisible pointer-events-none z-0"
            }`}
            aria-hidden={mobilePanel !== "chat"}
          >
            {chat}
          </div>
          <div
            className={`absolute inset-0 overflow-hidden ${
              mobilePanel === "sources" ? "visible z-10" : "invisible pointer-events-none z-0"
            }`}
            aria-hidden={mobilePanel !== "sources"}
          >
            {citations}
          </div>
        </div>
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
