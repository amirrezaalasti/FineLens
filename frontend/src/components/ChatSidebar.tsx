"use client";

import { Loader2, MessageSquarePlus, MessagesSquare, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/i18n";
import type { ChatSessionSummary } from "@/lib/types";

interface ChatSidebarProps {
  sessions: ChatSessionSummary[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onDelete: (sessionId: string) => void;
  onRefresh?: () => Promise<unknown>;
  loading?: boolean;
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNewChat,
  onDelete,
  onRefresh,
  loading,
}: ChatSidebarProps) {
  const { t, dateLocale } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit" });
  };

  const handleRefresh = async () => {
    if (!onRefresh || refreshing || loading) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <aside className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
      <div className="border-b border-ink/10 p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNewChat}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-pink px-3 py-2.5 text-sm font-bold text-white transition hover:bg-pink-dark"
          >
            <MessageSquarePlus className="h-4 w-4" />
            {t("sidebar.newChat")}
          </button>
          {onRefresh && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-ink/10 bg-white text-ink transition hover:bg-ink/5 disabled:opacity-50"
              title={t("sidebar.refreshChats")}
              aria-label={t("sidebar.refreshChats")}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <p className="px-2 py-4 text-center text-xs text-slate-400">{t("sidebar.loadingChats")}</p>
        ) : sessions.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-slate-400">{t("sidebar.noChats")}</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => {
              const active = session.id === activeSessionId;
              return (
                <li key={session.id}>
                  <div
                    className={`group flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm transition ${
                      active
                        ? "border-pink/30 ring-1 ring-pink/20"
                        : "border-ink/5 hover:border-pink/20"
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink/15">
                      <MessagesSquare
                        className={`h-4 w-4 ${active ? "text-pink" : "text-pink/70"}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelect(session.id)}
                      className="min-w-0 flex-1 text-left touch-manipulation"
                    >
                      <p className="text-[10px] text-ink-muted">{t("sidebar.chatLabel")}</p>
                      <p
                        className={`truncate text-sm ${active ? "font-bold text-ink" : "font-semibold text-ink/90"}`}
                      >
                        {session.title}
                      </p>
                      <p className="mt-0.5 text-[10px] text-ink-muted">
                        {formatDate(session.updated_at)} ·{" "}
                        {t("sidebar.messages", { count: session.message_count })}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(session.id);
                      }}
                      className="rounded-lg p-2 text-ink-muted opacity-100 transition hover:bg-red-50 hover:text-red-500 active:bg-red-100 touch-manipulation sm:p-1.5 lg:opacity-0 lg:group-hover:opacity-100"
                      title={t("sidebar.deleteChat")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
