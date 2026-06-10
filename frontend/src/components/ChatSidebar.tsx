"use client";

import { MessageSquarePlus, MessagesSquare, Trash2 } from "lucide-react";
import type { ChatSessionSummary } from "@/lib/types";

interface ChatSidebarProps {
  sessions: ChatSessionSummary[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onDelete: (sessionId: string) => void;
  loading?: boolean;
}

function formatDate(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNewChat,
  onDelete,
  loading,
}: ChatSidebarProps) {
  return (
    <aside className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-2xl shadow-sm">
      <div className="border-b border-navy/10 p-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-3 py-2.5 text-sm font-semibold text-navy transition hover:bg-gold-light"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Neuer Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <p className="px-2 py-4 text-center text-xs text-slate-400">Lade Chats...</p>
        ) : sessions.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-slate-400">
            Noch keine gespeicherten Chats
          </p>
        ) : (
          <ul className="space-y-1">
            {sessions.map((session) => {
              const active = session.id === activeSessionId;
              return (
                <li key={session.id}>
                  <div
                    className={`group flex items-start gap-1 rounded-xl transition ${
                      active ? "bg-navy/8" : "hover:bg-navy/5"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(session.id)}
                      className="min-w-0 flex-1 px-3 py-2.5 text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <MessagesSquare
                          className={`h-3.5 w-3.5 shrink-0 ${active ? "text-gold" : "text-slate-400"}`}
                        />
                        <span
                          className={`truncate text-sm ${active ? "font-medium text-navy" : "text-navy/80"}`}
                        >
                          {session.title}
                        </span>
                      </div>
                      <p className="mt-0.5 pl-5 text-[10px] text-slate-400">
                        {formatDate(session.updated_at)} · {session.message_count} Nachr.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(session.id);
                      }}
                      className="mr-2 mt-2.5 rounded-lg p-1.5 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                      title="Chat löschen"
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
