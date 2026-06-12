"use client";

import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { ChatPanel } from "@/components/ChatPanel";
import { ChatSidebar } from "@/components/ChatSidebar";
import { CitationsPanel } from "@/components/CitationsPanel";
import { ResizableChatLayout } from "@/components/ResizableChatLayout";
import { ProfileWizard } from "@/components/ProfileWizard";
import { FormsPanel } from "@/components/FormsPanel";
import { SourcesPanel } from "@/components/SourcesPanel";
import { DocumentAnalysisPanel } from "@/components/DocumentAnalysisPanel";
import {
  createChatSession,
  deleteChatSession,
  getHealth,
  listChatSessions,
} from "@/lib/api";
import { useTranslation } from "@/i18n";
import type { ChatMessage, ChatSessionSummary, Citation, LegalForm, Attachment, ExtractedField } from "@/lib/types";

type Tab = "chat" | "profile" | "forms" | "sources";

const USER_ID = "default";
const SESSION_STORAGE_KEY = `finelens-active-session-${USER_ID}`;

export default function Home() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("chat");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [transparencyNote, setTransparencyNote] = useState("");
  const [suggestedForms, setSuggestedForms] = useState<LegalForm[]>([]);
  const handleFormSuggest = useCallback((forms: LegalForm[]) => {
    const seen = new Set<string>();
    setSuggestedForms(
      forms.filter((f) => {
        if (seen.has(f.id)) return false;
        seen.add(f.id);
        return true;
      })
    );
  }, []);
  const [graphConnected, setGraphConnected] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState<"citations" | "analysis">("citations");
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [draftAttachments, setDraftAttachments] = useState<Attachment[]>([]);

  const handleUpdateAnalysis = useCallback((updatedFields: ExtractedField[]) => {
    setSelectedAttachment(prev => {
      if (!prev) return null;
      const updated = {
        ...prev,
        analysis: prev.analysis
          ? { ...prev.analysis, fields: updatedFields }
          : { fields: updatedFields, raw_text: "", preview_image_url: null }
      };
      setDraftAttachments(drafts =>
        drafts.map(d => d.name === prev.name ? updated : d)
      );
      return updated;
    });
  }, []);

  const refreshSessions = useCallback(async () => {
    const list = await listChatSessions(USER_ID);
    setSessions(list);
    return list;
  }, []);

  useEffect(() => {
    getHealth()
      .then((h) => setGraphConnected(h.graph_connected))
      .catch(() => setGraphConnected(false));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initSessions() {
      setSessionsLoading(true);
      try {
        const list = await refreshSessions();
        if (cancelled) return;

        const emptySession = list.find((s) => s.message_count === 0);
        if (emptySession) {
          setActiveSessionId(emptySession.id);
        } else {
          const session = await createChatSession(USER_ID);
          if (!cancelled) {
            setActiveSessionId(session.id);
            await refreshSessions();
          }
        }
      } catch {
        if (!cancelled) setActiveSessionId(null);
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    }

    initSessions();
    return () => {
      cancelled = true;
    };
  }, [refreshSessions]);

  const handleNewChat = async () => {
    const session = await createChatSession(USER_ID);
    setActiveSessionId(session.id);
    setCitations([]);
    setTransparencyNote("");
    setSelectedAttachment(null);
    setActiveRightTab("citations");
    await refreshSessions();
  };

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setSelectedAttachment(null);
    setActiveRightTab("citations");
  };

  const handleDeleteSession = async (sessionId: string) => {
    await deleteChatSession(sessionId, USER_ID);
    const list = await refreshSessions();

    if (activeSessionId === sessionId) {
      if (list.length > 0) {
        setActiveSessionId(list[0].id);
      } else {
        const session = await createChatSession(USER_ID);
        setActiveSessionId(session.id);
        await refreshSessions();
      }
      setCitations([]);
      setTransparencyNote("");
    }
  };

  const handleResponse = useCallback((msg: ChatMessage) => {
    setCitations(msg.citations || []);
    setTransparencyNote(msg.transparency_note || "");
    refreshSessions();
  }, [refreshSessions]);

  const handleSessionIdChange = useCallback(
    (sessionId: string) => {
      setActiveSessionId(sessionId);
      refreshSessions();
    },
    [refreshSessions]
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-gradient-to-b from-cream via-white to-cream">
      <Header activeTab={tab} onTabChange={setTab} graphConnected={graphConnected} />

      <main
        className={`mx-auto w-full min-h-0 flex-1 px-4 sm:px-6 ${
          tab === "chat"
            ? "max-w-[1800px] overflow-hidden py-3"
            : "max-w-7xl overflow-y-auto py-6"
        }`}
      >
        {tab === "chat" && (
          <div className="h-full min-h-0">
            <ResizableChatLayout
              sidebar={
                <ChatSidebar
                  sessions={sessions}
                  activeSessionId={activeSessionId}
                  onSelect={handleSelectSession}
                  onNewChat={handleNewChat}
                  onDelete={handleDeleteSession}
                  loading={sessionsLoading}
                />
              }
              chat={
                <ChatPanel
                  userId={USER_ID}
                  sessionId={activeSessionId}
                  onSessionIdChange={handleSessionIdChange}
                  onResponse={handleResponse}
                  onFormSuggest={handleFormSuggest}
                  onOpenFormsTab={() => setTab("forms")}
                  onAttachmentSelect={(att) => {
                    setSelectedAttachment(att);
                    setActiveRightTab("analysis");
                  }}
                  attachments={draftAttachments}
                  setAttachments={setDraftAttachments}
                />
              }
              citations={
                <div className="flex h-full flex-col min-h-0 gap-3">
                  <div className="flex bg-navy/5 p-1 rounded-xl border border-navy/10 shrink-0">
                    <button
                      onClick={() => setActiveRightTab("citations")}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        activeRightTab === "citations"
                          ? "bg-navy text-white shadow-sm"
                          : "text-navy/60 hover:text-navy hover:bg-navy/5"
                      }`}
                    >
                      Quellen & Transparenz
                    </button>
                    <button
                      onClick={() => setActiveRightTab("analysis")}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        activeRightTab === "analysis"
                          ? "bg-navy text-white shadow-sm"
                          : "text-navy/60 hover:text-navy hover:bg-navy/5"
                      }`}
                    >
                      Dokumenten-Analyse
                    </button>
                  </div>
                  <div className="flex-1 min-h-0">
                    {activeRightTab === "citations" ? (
                      <CitationsPanel
                        citations={citations}
                        transparencyNote={transparencyNote}
                      />
                    ) : (
                      <DocumentAnalysisPanel
                        attachment={selectedAttachment}
                        onClose={() => {
                          setSelectedAttachment(null);
                          setActiveRightTab("citations");
                        }}
                        onUpdateAnalysis={handleUpdateAnalysis}
                      />
                    )}
                  </div>
                </div>
              }
            />
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

      <footer className="shrink-0 border-t border-navy/10 bg-navy/5 py-2 text-center text-xs text-slate-500">
        FineLens · {t("footer.disclaimer")} · {t("footer.dataSources")} · {t("footer.engine")}{" "}
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
