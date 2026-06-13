"use client";

import {
  Bell,
  CalendarClock,
  FileText,
  MessageSquare,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/i18n";
import type { Tab } from "@/components/Header";

const STORAGE_KEY = "finelens-notifications-v1";

type NotificationIcon = "message" | "deadline" | "form" | "profile";

interface NotificationDef {
  id: string;
  icon: NotificationIcon;
  tab?: Tab;
}

const NOTIFICATION_DEFS: NotificationDef[] = [
  { id: "bafog", icon: "message", tab: "chat" },
  { id: "deadline", icon: "deadline", tab: "forms" },
  { id: "form", icon: "form", tab: "forms" },
  { id: "profile", icon: "profile", tab: "profile" },
];

const ICONS = {
  message: MessageSquare,
  deadline: CalendarClock,
  form: FileText,
  profile: User,
} as const;

interface NotificationState {
  read: string[];
  dismissed: string[];
}

function loadState(): NotificationState {
  if (typeof window === "undefined") {
    return { read: [], dismissed: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { read: [], dismissed: [] };
    const parsed = JSON.parse(raw) as NotificationState;
    return {
      read: Array.isArray(parsed.read) ? parsed.read : [],
      dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed : [],
    };
  } catch {
    return { read: [], dismissed: [] };
  }
}

function saveState(state: NotificationState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

interface NotificationsDropdownProps {
  onTabChange?: (tab: Tab) => void;
}

export function NotificationsDropdown({ onTabChange }: NotificationsDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<NotificationState>({ read: [], dismissed: [] });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setState(loadState());
  }, []);

  const visible = NOTIFICATION_DEFS.filter((n) => !state.dismissed.includes(n.id));
  const unreadCount = visible.filter((n) => !state.read.includes(n.id)).length;

  const persist = useCallback((next: NotificationState) => {
    setState(next);
    saveState(next);
  }, []);

  const markRead = useCallback(
    (id: string) => {
      if (state.read.includes(id)) return;
      persist({ ...state, read: [...state.read, id] });
    },
    [persist, state]
  );

  const markAllRead = useCallback(() => {
    persist({
      ...state,
      read: [...new Set([...state.read, ...visible.map((n) => n.id)])],
    });
  }, [persist, state, visible]);

  const dismiss = useCallback(
    (id: string, event: React.MouseEvent) => {
      event.stopPropagation();
      persist({
        ...state,
        dismissed: [...state.dismissed, id],
        read: state.read.includes(id) ? state.read : [...state.read, id],
      });
    },
    [persist, state]
  );

  const handleSelect = useCallback(
    (def: NotificationDef) => {
      markRead(def.id);
      setOpen(false);
      if (def.tab && onTabChange) {
        onTabChange(def.tab);
      }
    },
    [markRead, onTabChange]
  );

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(max-width: 767px)");
    if (!mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t("header.notifications")}
        className="relative flex h-9 w-9 touch-manipulation items-center justify-center rounded-full bg-surface-warm text-ink-muted transition hover:bg-pink/10 hover:text-pink active:scale-95"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 md:hidden"
            aria-hidden
            onClick={() => setOpen(false)}
          />

          <div
            role="dialog"
            aria-label={t("header.notificationsPanel.title")}
            className="fixed inset-x-3 top-[calc(env(safe-area-inset-top,0px)+4.5rem)] z-50 flex max-h-[min(28rem,calc(100dvh-6rem))] flex-col overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)] md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:w-[min(22rem,calc(100vw-2rem))]"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-ink/6 px-4 py-3">
              <h2 className="text-sm font-bold text-ink">
                {t("header.notificationsPanel.title")}
              </h2>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="touch-manipulation rounded-lg px-2 py-1 text-xs font-semibold text-pink transition hover:bg-pink/10 active:bg-pink/15"
                  >
                    {t("header.notificationsPanel.markAllRead")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t("header.notificationsPanel.close")}
                  className="flex h-8 w-8 touch-manipulation items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-warm hover:text-ink active:bg-ink/5 md:hidden"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {visible.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink-muted">
                  {t("header.notificationsPanel.empty")}
                </p>
              ) : (
                <ul className="divide-y divide-ink/6">
                  {visible.map((def) => {
                    const Icon = ICONS[def.icon];
                    const isUnread = !state.read.includes(def.id);
                    return (
                      <li key={def.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => handleSelect(def)}
                          className={`flex w-full touch-manipulation items-start gap-3 px-4 py-3 pr-12 text-left transition hover:bg-surface-warm active:bg-surface-warm ${
                            isUnread ? "bg-pink/[0.04]" : ""
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                              isUnread ? "bg-pink/15 text-pink" : "bg-surface-warm text-ink-muted"
                            }`}
                          >
                            <Icon className="h-4 w-4" strokeWidth={2} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                              <span
                                className={`text-sm leading-snug ${
                                  isUnread ? "font-semibold text-ink" : "font-medium text-ink/90"
                                }`}
                              >
                                {t(`header.notificationsPanel.items.${def.id}.title`)}
                              </span>
                              {isUnread && (
                                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-pink" />
                              )}
                            </span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                              {t(`header.notificationsPanel.items.${def.id}.body`)}
                            </span>
                            <span className="mt-1 block text-[11px] text-ink-muted/80">
                              {t(`header.notificationsPanel.items.${def.id}.time`)}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => dismiss(def.id, e)}
                          aria-label={t("header.notificationsPanel.dismiss")}
                          className="absolute right-2 top-3 flex h-8 w-8 touch-manipulation items-center justify-center rounded-full text-ink-muted transition hover:bg-ink/5 hover:text-ink active:bg-ink/10 max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
