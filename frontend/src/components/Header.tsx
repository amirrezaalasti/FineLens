"use client";

import {
  BookOpen,
  FileText,
  Home,
  MessageSquare,
  ScanLine,
  Search,
  User,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";

export type Tab = "chat" | "profile" | "forms" | "sources";

interface HeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  graphConnected: boolean | null;
}

const TAB_IDS: Tab[] = ["chat", "profile", "forms", "sources"];

const TAB_ICONS = {
  chat: MessageSquare,
  profile: User,
  forms: FileText,
  sources: BookOpen,
} as const;

const MOBILE_TAB_ICONS = {
  chat: Home,
  profile: User,
  forms: ScanLine,
  sources: FileText,
} as const;

function getGreetingKey(): "morning" | "afternoon" | "evening" {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function MobileBottomNav({ activeTab, onTabChange }: HeaderProps) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t("layout.mobile.mainNav")}
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:hidden"
    >
      <div className="mx-auto flex max-w-lg items-center justify-around rounded-[1.75rem] bg-white px-2 py-2 shadow-[0_4px_24px_rgba(0,0,0,0.1)]">
        {TAB_IDS.map((tab) => {
          const Icon = MOBILE_TAB_ICONS[tab];
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={`relative flex min-h-[3rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1.5 transition touch-manipulation ${
                isActive
                  ? "bg-pink text-white shadow-sm"
                  : "text-ink-muted active:text-ink"
              }`}
            >
              <Icon
                className="h-5 w-5 shrink-0"
                strokeWidth={isActive ? 2.25 : 1.75}
              />
              <span
                className={`max-w-full truncate text-[10px] font-semibold leading-tight ${
                  isActive ? "text-white" : "font-medium"
                }`}
              >
                {t(`header.tabs.${tab}`)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function Header({ activeTab, onTabChange, graphConnected }: HeaderProps) {
  const { t } = useTranslation();
  const greetingKey = getGreetingKey();

  return (
    <header className="z-40 shrink-0 bg-white px-4 pb-3 pt-safe shadow-[0_2px_12px_rgba(0,0,0,0.04)] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink/15">
              <Search className="h-4 w-4 text-pink" strokeWidth={2.5} />
            </div>
            <h1 className="truncate text-lg font-bold tracking-tight text-ink sm:text-xl">
              FineLens
            </h1>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {TAB_IDS.map((tab) => {
              const Icon = TAB_ICONS[tab];
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => onTabChange(tab)}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    activeTab === tab
                      ? "bg-pink text-white shadow-sm"
                      : "text-ink-muted hover:bg-surface-warm hover:text-ink"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={activeTab === tab ? 2.25 : 1.75} />
                  {t(`header.tabs.${tab}`)}
                </button>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher />
            {graphConnected !== null && (
              <span
                className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium lg:flex ${
                  graphConnected
                    ? "bg-green-50 text-green-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    graphConnected ? "bg-green-500" : "bg-amber-500"
                  }`}
                />
                {t("header.graphLabel")}{" "}
                {graphConnected ? t("header.graphConnected") : t("header.graphOffline")}
              </span>
            )}
            <NotificationsDropdown onTabChange={onTabChange} />
          </div>
        </div>

        {activeTab === "chat" && (
          <div className="md:pb-1">
            <p className="text-sm text-ink-muted">{t("header.greeting.hello")}</p>
            <p className="text-2xl font-bold text-ink sm:text-3xl">
              {t(`header.greeting.${greetingKey}`)}
            </p>
          </div>
        )}
      </div>
    </header>
  );
}
