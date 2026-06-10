"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { ChatPanel } from "@/components/ChatPanel";
import { CitationsPanel } from "@/components/CitationsPanel";
import { ProfileWizard } from "@/components/ProfileWizard";
import { FormsPanel } from "@/components/FormsPanel";
import { SourcesPanel } from "@/components/SourcesPanel";
import { getHealth } from "@/lib/api";
import type { Citation, LegalForm } from "@/lib/types";

type Tab = "chat" | "profile" | "forms" | "sources";

const USER_ID = "default";

export default function Home() {
  const [tab, setTab] = useState<Tab>("chat");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [transparencyNote, setTransparencyNote] = useState("");
  const [suggestedForms, setSuggestedForms] = useState<LegalForm[]>([]);
  const [graphConnected, setGraphConnected] = useState<boolean | null>(null);

  useEffect(() => {
    getHealth()
      .then((h) => setGraphConnected(h.graph_connected))
      .catch(() => setGraphConnected(false));
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-cream via-white to-cream">
      <Header activeTab={tab} onTabChange={setTab} graphConnected={graphConnected} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {tab === "chat" && (
          <div className="grid h-[calc(100vh-10rem)] gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <ChatPanel
                userId={USER_ID}
                onResponse={(msg) => {
                  setCitations(msg.citations || []);
                  setTransparencyNote(msg.transparency_note || "");
                }}
                onFormSuggest={(forms) => {
                  setSuggestedForms(forms);
                }}
              />
            </div>
            <div className="lg:col-span-2">
              <CitationsPanel citations={citations} transparencyNote={transparencyNote} />
            </div>
          </div>
        )}

        {tab === "profile" && (
          <ProfileWizard
            userId={USER_ID}
            onComplete={() => setTab("chat")}
          />
        )}

        {tab === "forms" && (
          <FormsPanel userId={USER_ID} suggestedForms={suggestedForms} />
        )}

        {tab === "sources" && <SourcesPanel />}
      </main>

      <footer className="border-t border-navy/10 bg-navy/5 py-4 text-center text-xs text-slate-500">
        RechtsLens · Keine Rechtsberatung · Daten: Open Legal Data, Gesetze im Internet,
        recht.bund.de · Engine:{" "}
        <a
          href="https://github.com/getzep/graphiti"
          className="text-navy hover:text-gold"
          target="_blank"
          rel="noopener noreferrer"
        >
          Graphiti
        </a>
      </footer>
    </div>
  );
}
