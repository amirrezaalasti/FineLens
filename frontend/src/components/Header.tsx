"use client";

import { Scale, Sparkles } from "lucide-react";

type Tab = "chat" | "profile" | "forms" | "sources";

interface HeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  graphConnected: boolean | null;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "chat", label: "Beratung" },
  { id: "profile", label: "Mein Profil" },
  { id: "forms", label: "Formulare" },
  { id: "sources", label: "Quellen" },
];

export function Header({ activeTab, onTabChange, graphConnected }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-navy/10 bg-navy text-white shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/20 ring-1 ring-gold/40">
            <Scale className="h-5 w-5 text-gold-light" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-semibold tracking-tight">
              Rechts<span className="text-gold-light">Lens</span>
            </h1>
            <p className="hidden text-xs text-white/60 sm:block">
              Powered by Graphiti · Transparente Quellen
            </p>
          </div>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-gold text-navy"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {graphConnected !== null && (
            <span
              className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:flex ${
                graphConnected
                  ? "bg-green-500/20 text-green-300"
                  : "bg-amber-500/20 text-amber-300"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  graphConnected ? "bg-green-400" : "bg-amber-400"
                }`}
              />
              Graph {graphConnected ? "verbunden" : "offline"}
            </span>
          )}
          <Sparkles className="h-4 w-4 text-gold-light md:hidden" />
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-white/10 px-4 py-2 md:hidden">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
              activeTab === tab.id ? "bg-gold text-navy" : "text-white/70"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
