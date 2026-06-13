"use client";

import { useCallback, useEffect, useState } from "react";
import { Header, MobileBottomNav } from "@/components/Header";
import type { MobileChatPanel } from "@/components/ResizableChatLayout";
import { ChatPanel } from "@/components/ChatPanel";
import { NewChatFlow, type NewChatFlowResult, type FlowPhase, type YellowEnvelopeAnswer } from "@/components/NewChatFlow";
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
  seedBafogDemo,
  sendChat,
  applyRedactions,
} from "@/lib/api";
import { useTranslation } from "@/i18n";
import type { ChatMessage, ChatSessionSummary, Citation, LegalForm, Attachment, ExtractedField, SourceViewPayload } from "@/lib/types";

interface InitialFollowUps {
  sessionId: string;
  questions: string[];
}

type Tab = "chat" | "profile" | "forms" | "sources";

const USER_ID = "default";
const SESSION_STORAGE_KEY = `finelens-active-session-${USER_ID}`;
const DRAFT_ATTACHMENTS_KEY = `finelens-draft-attachments-${USER_ID}`;
const SELECTED_ATTACHMENT_KEY = `finelens-selected-attachment-${USER_ID}`;

function loadStoredJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function storeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota errors for large attachment previews
  }
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function Home() {
  const { t, locale } = useTranslation();
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
  const [initialChatInput, setInitialChatInput] = useState("");
  const [pendingInitialMessage, setPendingInitialMessage] = useState<string | null>(null);
  const [mobileChatPanel, setMobileChatPanel] = useState<MobileChatPanel>("chat");
  const [chatInputFocused, setChatInputFocused] = useState(false);
  const [showNewChatFlow, setShowNewChatFlow] = useState(false);
  const [returnSessionId, setReturnSessionId] = useState<string | null>(null);
  const [initialFollowUps, setInitialFollowUps] = useState<InitialFollowUps | null>(null);

  const [newChatAttachment, setNewChatAttachment] = useState<Attachment | null>(null);
  const [newChatPhase, setNewChatPhase] = useState<FlowPhase>("upload");
  const [newChatEventDate, setNewChatEventDate] = useState(() => toDateString(new Date()));
  const [newChatYellowEnvelope, setNewChatYellowEnvelope] = useState<YellowEnvelopeAnswer | null>(null);
  const [newChatContext, setNewChatContext] = useState("");

  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File>>({});
  const handleUploadFile = useCallback((file: File) => {
    setUploadedFiles(prev => ({ ...prev, [file.name]: file }));
  }, []);

  // Load sessionStorage state on client mount to avoid hydration mismatch
  useEffect(() => {
    const drafts = loadStoredJson<Attachment[]>(DRAFT_ATTACHMENTS_KEY);
    if (drafts) {
      setDraftAttachments(drafts);
    }
    const selected = loadStoredJson<Attachment>(SELECTED_ATTACHMENT_KEY);
    if (selected) {
      setSelectedAttachment(selected);
    }
  }, []);

  const handleTabChange = useCallback((newTab: Tab) => {
    setTab(newTab);
    if (newTab === "chat") {
      setMobileChatPanel("chat");
    }
    setChatInputFocused(false);
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      storeJson(SESSION_STORAGE_KEY, activeSessionId);
    }
  }, [activeSessionId]);

  useEffect(() => {
    storeJson(DRAFT_ATTACHMENTS_KEY, draftAttachments);
  }, [draftAttachments]);

  useEffect(() => {
    if (selectedAttachment) {
      storeJson(SELECTED_ATTACHMENT_KEY, selectedAttachment);
    } else {
      sessionStorage.removeItem(SELECTED_ATTACHMENT_KEY);
    }
  }, [selectedAttachment]);

  const handleUpdateAnalysis = useCallback((updatedFields: ExtractedField[]) => {
    setSelectedAttachment(prev => {
      if (!prev) return null;
      
      const originalRawText = prev.analysis?.raw_text || prev.content || "";
      let redactedText = originalRawText;
      
      updatedFields.forEach(f => {
        if (f.is_pii && f.value) {
          const escapedVal = f.value.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          try {
            const regex = new RegExp(escapedVal, 'g');
            redactedText = redactedText.replace(regex, '█████');
          } catch (e) {
            redactedText = redactedText.split(f.value).join('█████');
          }
        }
      });

      const updated = {
        ...prev,
        content: redactedText,
        analysis: prev.analysis
          ? { ...prev.analysis, fields: updatedFields }
          : { fields: updatedFields, raw_text: originalRawText, preview_image_url: null }
      };
      setDraftAttachments(drafts =>
        drafts.map(d => d.name === prev.name ? updated : d)
      );
      return updated;
    });
  }, []);

  const handleReleaseAttachment = useCallback(async () => {
    if (!selectedAttachment) return;
    
    // Gather active redaction boxes coordinates
    const fields = selectedAttachment.analysis?.fields || [];
    const redactions: number[][] = [];
    fields.forEach(f => {
      if (f.is_pii && f.box) {
        const p = f.page ?? 0;
        if (Array.isArray(f.box[0])) {
          const list = f.box as number[][];
          list.forEach(boxCoords => {
            redactions.push([...boxCoords, p]);
          });
        } else {
          redactions.push([...(f.box as number[]), p]);
        }
      }
    });

    try {
      const fileObj = uploadedFiles[selectedAttachment.name];
      const res = await applyRedactions(fileObj || selectedAttachment.name, redactions);
      
      setSelectedAttachment(prev => {
        if (!prev) return null;
        
        const updated: Attachment = {
          ...prev,
          content: res.redacted_text,
          isPending: false,
          analysis: prev.analysis
            ? {
                ...prev.analysis,
                raw_text: res.redacted_text,
                preview_image_url: res.preview_image_url,
                preview_image_urls: res.preview_image_urls,
                // Clear coordinates and replace values of PII fields since they are now permanently redacted in the image.
                fields: prev.analysis.fields.map(f => 
                  f.is_pii ? { ...f, box: null, value: "█████" } : f
                )
              }
            : {
                fields: [],
                raw_text: res.redacted_text,
                preview_image_url: res.preview_image_url,
                preview_image_urls: res.preview_image_urls,
              }
        };
        
        setDraftAttachments(drafts =>
          drafts.map(d => d.name === prev.name ? updated : d)
        );
        setNewChatAttachment(updated);
        return updated;
      });

    } catch (err) {
      console.error("Failed to apply redactions:", err);
      alert("Fehler beim Anwenden der Schwärzungen auf der Originaldatei: " + (err instanceof Error ? err.message : String(err)));
    }
  }, [selectedAttachment, uploadedFiles]);

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

        const storedId = loadStoredJson<string>(SESSION_STORAGE_KEY);
        if (storedId && list.some((s) => s.id === storedId)) {
          setActiveSessionId(storedId);
        } else if (list.length > 0) {
          if (storedId) {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
          }
          const preferred = list.find((s) => s.message_count > 0) ?? list[0];
          setActiveSessionId(preferred.id);
          storeJson(SESSION_STORAGE_KEY, preferred.id);
        } else {
          const session = await createChatSession(USER_ID);
          if (!cancelled) {
            setActiveSessionId(session.id);
            storeJson(SESSION_STORAGE_KEY, session.id);
            try {
              await seedBafogDemo(session.id, USER_ID, locale);
            } catch (err) {
              console.error("Failed to seed BAföG demo:", err);
            }
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

  const handleNewChat = () => {
    setReturnSessionId(activeSessionId);
    setShowNewChatFlow(true);
    setActiveSessionId(null);
    setCitations([]);
    setTransparencyNote("");
    setSelectedAttachment(null);
    setDraftAttachments([]);
    setActiveRightTab("citations");
    setMobileChatPanel("chat");
    setNewChatAttachment(null);
    setNewChatPhase("upload");
    setNewChatEventDate(toDateString(new Date()));
    setNewChatYellowEnvelope(null);
    setNewChatContext("");
  };

  const handleNewChatCancel = () => {
    setShowNewChatFlow(false);
    if (returnSessionId) {
      setActiveSessionId(returnSessionId);
    }
    setReturnSessionId(null);
    setNewChatAttachment(null);
    setNewChatPhase("upload");
    setNewChatEventDate(toDateString(new Date()));
    setNewChatYellowEnvelope(null);
    setNewChatContext("");
  };

  const handleGoToRedaction = useCallback((att: Attachment) => {
    setNewChatAttachment(att);
    setNewChatPhase("details");
    const pendingAttachment = {
      ...att,
      isPending: true,
    };
    setDraftAttachments([pendingAttachment]);
    setSelectedAttachment(pendingAttachment);
    setActiveRightTab("analysis");
  }, []);

  const buildNewChatMessage = useCallback(
    (result: NewChatFlowResult) => {
      const eventDateLabel = result.eventDate
        ? result.eventDate
        : t("newChat.dateNotSpecified");
      const yellowEnvelopeLabel =
        result.yellowEnvelope === "yes"
          ? t("newChat.envelopeYesLabel")
          : result.yellowEnvelope === "no"
            ? t("newChat.envelopeNoLabel")
            : result.yellowEnvelope === "unknown"
              ? t("newChat.envelopeUnknownLabel")
              : t("newChat.envelopeNotSpecified");

      if (!result.context.trim()) {
        return t("newChat.initialMessageNoContext", {
          fileName: result.attachment.name,
          eventDate: eventDateLabel,
          yellowEnvelope: yellowEnvelopeLabel,
        });
      }

      if (result.eventDate) {
        return t("newChat.initialMessage", {
          fileName: result.attachment.name,
          eventDate: eventDateLabel,
          yellowEnvelope: yellowEnvelopeLabel,
          context: result.context,
        });
      }

      return t("newChat.initialMessageNoDate", {
        fileName: result.attachment.name,
        yellowEnvelope: yellowEnvelopeLabel,
        context: result.context,
      });
    },
    [t]
  );

  const handleNewChatComplete = async (result: NewChatFlowResult) => {
    setShowNewChatFlow(false);
    setReturnSessionId(null);

    // Create new session
    const session = await createChatSession(USER_ID);
    setActiveSessionId(session.id);
    storeJson(SESSION_STORAGE_KEY, session.id);

    // Setup released attachment
    const attachment = {
      ...result.attachment,
      isPending: false,
    };
    setDraftAttachments([attachment]);
    setSelectedAttachment(attachment);

    // Open citations tab
    setActiveRightTab("citations");
    setMobileChatPanel("chat");

    // Pre-populate and auto-submit initial message
    const msg = buildNewChatMessage(result);
    setInitialChatInput(msg);
    setPendingInitialMessage(msg);

    setCitations([]);
    setTransparencyNote("");
    setInitialFollowUps(null);

    // Reset onboarding states
    setNewChatAttachment(null);
    setNewChatPhase("upload");
    setNewChatEventDate(toDateString(new Date()));
    setNewChatYellowEnvelope(null);
    setNewChatContext("");

    await refreshSessions();
  };

  const handleInitialFollowUpsApplied = useCallback(() => {
    setInitialFollowUps(null);
  }, []);

  const handleClearInitialChatInput = useCallback(() => {
    setInitialChatInput("");
    setPendingInitialMessage(null);
  }, []);

  const handleSelectSession = (sessionId: string) => {
    setShowNewChatFlow(false);
    setReturnSessionId(null);
    setInitialFollowUps(null);
    setActiveSessionId(sessionId);
    setActiveRightTab("citations");
    setMobileChatPanel("chat");
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

  const handleDemoLoaded = useCallback((attachment: Attachment, assistantMsg: ChatMessage) => {
    setSelectedAttachment(attachment);
    setCitations(assistantMsg.citations || []);
    setTransparencyNote(assistantMsg.transparency_note || "");
    if (assistantMsg.suggested_forms?.length) {
      handleFormSuggest(assistantMsg.suggested_forms);
    }
    refreshSessions();
  }, [handleFormSuggest, refreshSessions]);

  const handleAttachmentSelect = useCallback((att: Attachment) => {
    setSelectedAttachment(att);
    setActiveRightTab("analysis");
    setMobileChatPanel("sources");
  }, []);

  const handleOpenSources = useCallback((payload?: SourceViewPayload) => {
    if (payload) {
      setCitations(payload.citations);
      setTransparencyNote(payload.transparencyNote || "");
    }
    setActiveRightTab("citations");
    setMobileChatPanel("sources");
  }, []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white">
      <Header activeTab={tab} onTabChange={handleTabChange} graphConnected={graphConnected} />

      <main
        className={`mx-auto w-full min-h-0 flex-1 px-3 sm:px-6 ${
          tab === "chat"
            ? `max-w-[1800px] overflow-hidden py-2 sm:py-3 md:pb-3 ${
                chatInputFocused
                  ? "pb-2"
                  : "pb-[calc(6rem+env(safe-area-inset-bottom,0px))]"
              }`
            : "max-w-7xl overflow-y-auto py-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] sm:py-6 md:pb-6"
        }`}
      >
        {/* Keep chat mounted so uploads and draft state survive tab switches */}
        <div className={tab === "chat" ? "h-full min-h-0" : "hidden"} aria-hidden={tab !== "chat"}>
          {selectedAttachment?.isPending ? (
            <DocumentAnalysisPanel
              attachment={selectedAttachment}
              fileObj={selectedAttachment ? uploadedFiles[selectedAttachment.name] : null}
              onClose={() => {
                setSelectedAttachment(null);
                setDraftAttachments([]);
              }}
              onUpdateAnalysis={handleUpdateAnalysis}
              onReleaseAttachment={handleReleaseAttachment}
            />
          ) : (
            <ResizableChatLayout
              mobilePanel={mobileChatPanel}
            onMobilePanelChange={setMobileChatPanel}
            sourcesBadge={citations.length}
            isAnalysisActive={activeRightTab === "analysis"}
            sidebar={
              <ChatSidebar
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelect={handleSelectSession}
                onNewChat={handleNewChat}
                onDelete={handleDeleteSession}
                onRefresh={refreshSessions}
                loading={sessionsLoading}
              />
            }
            chat={
              showNewChatFlow ? (
                <NewChatFlow
                  attachment={newChatAttachment}
                  setAttachment={setNewChatAttachment}
                  phase={newChatPhase}
                  setPhase={setNewChatPhase}
                  eventDate={newChatEventDate}
                  setEventDate={setNewChatEventDate}
                  yellowEnvelope={newChatYellowEnvelope}
                  setYellowEnvelope={setNewChatYellowEnvelope}
                  context={newChatContext}
                  setContext={setNewChatContext}
                  onComplete={handleNewChatComplete}
                  onCancel={handleNewChatCancel}
                  onGoToRedaction={handleGoToRedaction}
                  onUploadFile={handleUploadFile}
                />
              ) : (
                <ChatPanel
                  userId={USER_ID}
                  sessionId={activeSessionId}
                  sessionsLoading={sessionsLoading}
                  onSessionIdChange={handleSessionIdChange}
                  onResponse={handleResponse}
                  onFormSuggest={handleFormSuggest}
                  onOpenFormsTab={() => handleTabChange("forms")}
                  onAttachmentSelect={handleAttachmentSelect}
                  onDemoLoaded={handleDemoLoaded}
                  onSampleRefreshed={refreshSessions}
                  onOpenSources={handleOpenSources}
                  onOpenChatsList={() => setMobileChatPanel("sidebar")}
                  onInputFocusChange={setChatInputFocused}
                  chatActive={tab === "chat"}
                  sourcesCount={citations.length}
                  attachments={draftAttachments}
                  setAttachments={setDraftAttachments}
                  initialFollowUps={
                    initialFollowUps && initialFollowUps.sessionId === activeSessionId
                      ? initialFollowUps
                      : null
                  }
                  onInitialFollowUpsApplied={handleInitialFollowUpsApplied}
                  initialInput={initialChatInput}
                  onInitialInputApplied={handleClearInitialChatInput}
                  autoSubmitInitialInput={!!pendingInitialMessage}
                  onUploadFile={handleUploadFile}
                />
              )
            }
            citations={
              <div className="flex h-full flex-col min-h-0 gap-3">
                <div className="flex bg-ink/5 p-1 rounded-xl border border-ink/10 shrink-0">
                  <button
                    onClick={() => setActiveRightTab("citations")}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      activeRightTab === "citations"
                        ? "bg-pink text-white shadow-sm"
                        : "text-ink/60 hover:text-ink hover:bg-ink/5"
                    }`}
                  >
                    {t("citations.title")}
                  </button>
                  <button
                    onClick={() => setActiveRightTab("analysis")}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      activeRightTab === "analysis"
                        ? "bg-pink text-white shadow-sm"
                        : "text-ink/60 hover:text-ink hover:bg-ink/5"
                    }`}
                  >
                    {t("analysis.tab")}
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
                      fileObj={selectedAttachment ? uploadedFiles[selectedAttachment.name] : null}
                      onClose={() => {
                        setSelectedAttachment(null);
                        setActiveRightTab("citations");
                      }}
                      onUpdateAnalysis={handleUpdateAnalysis}
                      onReleaseAttachment={handleReleaseAttachment}
                    />
                  )}
                </div>
              </div>
            }
          />
          )}
        </div>

        {tab === "profile" && (
          <ProfileWizard
            userId={USER_ID}
            onComplete={() => handleTabChange("chat")}
          />
        )}

        {tab === "forms" && (
          <FormsPanel userId={USER_ID} suggestedForms={suggestedForms} />
        )}

        {tab === "sources" && <SourcesPanel />}
      </main>

      <MobileBottomNav
        activeTab={tab}
        onTabChange={handleTabChange}
        graphConnected={graphConnected}
        hideBottomNav={tab === "chat" && chatInputFocused}
      />

      <footer className="hidden shrink-0 border-t border-ink/10 bg-ink/5 py-2 text-center text-xs text-slate-500 md:block">
        FineLens · {t("footer.disclaimer")} · {t("footer.dataSources")} · {t("footer.engine")}{" "}
        <a
          href="https://github.com/getzep/graphiti"
          className="text-ink hover:text-pink"
          target="_blank"
          rel="noopener noreferrer"
        >
          Graphiti
        </a>
      </footer>
    </div>
  );
}
