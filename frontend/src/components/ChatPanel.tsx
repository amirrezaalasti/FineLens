/* eslint-disable react-hooks/refs */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, MessageSquare, MessagesSquare, RefreshCw, Send, Mic, MicOff, Paperclip, X, FileText, FileImage, File, Shield, ScanLine, Search, Info } from "lucide-react";
import { createChatSession, getChatSession, refreshBafogDemo, sendChat, uploadFile } from "@/lib/api";
import { useTranslation } from "@/i18n";
import type { ChatMessage, LegalForm, Attachment, SourceViewPayload } from "@/lib/types";
import { AssistantMessage } from "@/components/AssistantMessage";
import {
  DocumentCaptureInputs,
  DocumentCaptureSheet,
} from "@/components/DocumentCaptureSheet";
import { CameraScannerModal } from "@/components/CameraScannerModal";
import { prefersNativeCamera, useDocumentCapture } from "@/hooks/useDocumentCapture";
import { AnalysisLoadingScreen } from "@/components/AnalysisLoadingScreen";

interface InitialFollowUps {
  sessionId: string;
  questions: string[];
}

interface ChatPanelProps {
  userId: string;
  sessionId: string | null;
  sessionsLoading?: boolean;
  onSessionIdChange: (sessionId: string) => void;
  onResponse: (msg: ChatMessage) => void;
  onFormSuggest: (forms: LegalForm[]) => void;
  onOpenFormsTab?: () => void;
  onAttachmentSelect?: (attachment: Attachment) => void;
  onOpenSources?: (payload?: SourceViewPayload) => void;
  onOpenChatsList?: () => void;
  onDemoLoaded?: (attachment: Attachment, assistantMsg: ChatMessage) => void;
  onSampleRefreshed?: () => void;
  onInputFocusChange?: (focused: boolean) => void;
  chatActive?: boolean;
  sourcesCount?: number;
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  initialFollowUps?: InitialFollowUps | null;
  onInitialFollowUpsApplied?: () => void;
  initialInput?: string;
  onInitialInputApplied?: () => void;
  autoSubmitInitialInput?: boolean;
}

const STARTERS_KEY = "chat.starters";

export function ChatPanel({
  userId,
  sessionId,
  sessionsLoading = false,
  onSessionIdChange,
  onResponse,
  onFormSuggest,
  onOpenFormsTab,
  onAttachmentSelect,
  onOpenSources,
  onOpenChatsList,
  onDemoLoaded,
  onSampleRefreshed,
  onInputFocusChange,
  chatActive = true,
  sourcesCount = 0,
  attachments,
  setAttachments,
  initialFollowUps = null,
  onInitialFollowUpsApplied,
  initialInput,
  onInitialInputApplied,
  autoSubmitInitialInput,
}: ChatPanelProps) {
  const { t, tArray, locale, speechLocale } = useTranslation();
  const starters = tArray(STARTERS_KEY);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [refreshingSample, setRefreshingSample] = useState(false);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const onResponseRef = useRef(onResponse);
  onResponseRef.current = onResponse;

  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef("");
  const isListeningRef = useRef(false);
  const lastToggleRef = useRef(0);
  const [uploading, setUploading] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputEditable, setInputEditable] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(pointer: coarse)");
    if (!mq.matches) setInputEditable(true);
  }, []);

  const onInitialInputAppliedRef = useRef(onInitialInputApplied);
  onInitialInputAppliedRef.current = onInitialInputApplied;

  useEffect(() => {
    if (initialInput) {
      if (autoSubmitInitialInput) {
        handleSend(initialInput, attachments);
      } else {
        setInput(initialInput);
      }
      onInitialInputAppliedRef.current?.();
    }
  }, [initialInput, autoSubmitInitialInput, attachments]);

  const [analysisLoadingStep, setAnalysisLoadingStep] = useState(0);

  useEffect(() => {
    if (loading && messages.length === 0) {
      setAnalysisLoadingStep(0);
      const timers = [
        setTimeout(() => setAnalysisLoadingStep(1), 1200),
        setTimeout(() => setAnalysisLoadingStep(2), 2400),
        setTimeout(() => setAnalysisLoadingStep(3), 3600),
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [loading, messages.length]);

  useEffect(() => {
    if (chatActive) return;
    inputRef.current?.blur();
    onInputFocusChange?.(false);
  }, [chatActive, onInputFocusChange]);

  const processFiles = useCallback(
    async (files: FileList) => {
      setUploading(true);
      const newAttachments: Attachment[] = [];

      for (let i = 0; i < files.length; i++) {
        try {
          const att = await uploadFile(files[i]);
          att.isPending = true;
          newAttachments.push(att);
        } catch (err) {
          console.error("Failed to upload file:", err);
          alert(
            t("chat.uploadError", {
              fileName: files[i].name,
              error: err instanceof Error ? err.message : t("chat.unknownError"),
            })
          );
        }
      }

      setAttachments((prev) => [...prev, ...newAttachments]);
      setUploading(false);

      if (newAttachments.length > 0 && onAttachmentSelect) {
        onAttachmentSelect(newAttachments[0]);
      }
    },
    [onAttachmentSelect, setAttachments, t]
  );

  const uploadDisabled = loading || loadingSession || uploading || refreshingSample || attachments.some((att) => att.isPending);

  const capture = useDocumentCapture({
    onFilesSelected: processFiles,
    disabled: uploadDisabled,
  });

  const openGallery = useCallback(() => {
    if (uploadDisabled) return;
    capture.setMenuOpen(false);
    galleryInputRef.current?.click();
  }, [capture, uploadDisabled]);

  const handleScanWithCamera = useCallback(() => {
    if (prefersNativeCamera()) {
      capture.openNativeCamera();
      return;
    }
    capture.openWebCamera();
  }, [capture]);

  const handleCaptureInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      capture.handleInputChange(e);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    },
    [capture]
  );

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const openMessageSources = useCallback(
    (msg: ChatMessage) => {
      if (!msg.citations?.length) return;
      onOpenSources?.({
        citations: msg.citations,
        transparencyNote: msg.transparency_note,
      });
    },
    [onOpenSources]
  );

  // Check SpeechRecognition support on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setIsSpeechSupported(true);
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          console.error("Failed to stop SpeechRecognition on unmount:", err);
        }
      }
    };
  }, []);

  const toggleListening = () => {
    const now = Date.now();
    if (now - lastToggleRef.current < 800) {
      console.log("Throttled rapid duplicate click on microphone button.");
      return;
    }
    lastToggleRef.current = now;

    console.log("toggleListening called. Current state:", {
      isListening: isListening,
      isListeningRef: isListeningRef.current,
      hasExistingInstance: !!recognitionRef.current
    });

    const SpeechRecognition =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) return;

    if (isListeningRef.current) {
      console.log("Stopping active speech recognition session...");
      // Stop current session
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          console.error("Failed to stop SpeechRecognition:", err);
        }
      }
      isListeningRef.current = false;
      setIsListening(false);
    } else {
      console.log("Starting new speech recognition session...");
      // Start a clean new session
      isListeningRef.current = true;
      setIsListening(true);
      baseInputRef.current = input;

      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = speechLocale;

        // Timeout to detect if the browser fails to start the microphone silently
        const startTimeout = setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current === recognition) {
            console.warn("Speech recognition did not start within 3 seconds. Possible device or permission block.");
            alert(t("chat.speechTimeout"));
            try {
              recognition.stop();
            } catch (e) {}
            isListeningRef.current = false;
            setIsListening(false);
            recognitionRef.current = null;
          }
        }, 3000);

        recognition.onstart = () => {
          console.log("Speech recognition started successfully");
          clearTimeout(startTimeout);
          isListeningRef.current = true;
          setIsListening(true);
        };

        recognition.onsoundstart = () => {
          console.log("Sound detected (microphone has audio input)");
        };

        recognition.onspeechstart = () => {
          console.log("Speech pattern detected");
        };

        recognition.onnomatch = () => {
          console.log("Audio detected but no matching words could be recognized");
        };

        recognition.onend = () => {
          console.log("Speech recognition ended");
          clearTimeout(startTimeout);
          isListeningRef.current = false;
          setIsListening(false);
          recognitionRef.current = null;
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          clearTimeout(startTimeout);
          if (event.error === "not-allowed") {
            alert(t("chat.micDenied"));
          } else if (event.error === "no-speech") {
            console.log("No speech detected.");
          } else {
            alert(t("chat.speechError", { error: event.error }));
          }
          isListeningRef.current = false;
          setIsListening(false);
          recognitionRef.current = null;
        };

        recognition.onresult = (event: any) => {
          let transcript = "";
          for (let i = 0; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
          }
          console.log("Speech transcript update:", transcript);
          const base = baseInputRef.current;
          const separator = base && !base.endsWith(" ") ? " " : "";
          setInput(base + separator + transcript);
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.error("Failed to start SpeechRecognition:", err);
        isListeningRef.current = false;
        setIsListening(false);
        recognitionRef.current = null;
      }
    }
  };

  const onDemoLoadedRef = useRef(onDemoLoaded);
  onDemoLoadedRef.current = onDemoLoaded;

  const applyLoadedSession = useCallback(
    (session: Awaited<ReturnType<typeof getChatSession>>, followUps?: string[]) => {
      setMessages(session.messages);
      setFollowUps(followUps ?? []);

      const lastAssistant = [...session.messages]
        .reverse()
        .find((m) => m.role === "assistant");
      if (lastAssistant) onResponseRef.current(lastAssistant);

      const userWithAttachment = session.messages.find(
        (m) => m.role === "user" && m.attachments && m.attachments.length > 0
      );
      if (userWithAttachment?.attachments?.[0] && lastAssistant) {
        onDemoLoadedRef.current?.(userWithAttachment.attachments[0], lastAssistant);
      }
    },
    []
  );

  useEffect(() => {
    if (!sessionId || sessionsLoading) {
      if (!sessionId) {
        setMessages([]);
        setFollowUps([]);
      }
      return;
    }

    let cancelled = false;
    setLoadingSession(true);

    (async () => {
      try {
        const session = await getChatSession(sessionId, userId);
        if (cancelled) return;
        const followUps =
          initialFollowUps?.sessionId === sessionId
            ? initialFollowUps.questions
            : undefined;
        applyLoadedSession(session, followUps);
        if (followUps) onInitialFollowUpsApplied?.();
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "";
        if (message.includes("Chat nicht gefunden") || message.includes("404")) {
          try {
            const session = await createChatSession(userId);
            if (!cancelled) onSessionIdChange(session.id);
            return;
          } catch (createErr) {
            console.error("Failed to recover missing chat session:", createErr);
          }
        }
        setMessages([]);
      } finally {
        if (!cancelled) setLoadingSession(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, sessionsLoading, userId, onSessionIdChange, applyLoadedSession, initialFollowUps, onInitialFollowUpsApplied]);

  const handleRefreshSample = async () => {
    setRefreshingSample(true);
    try {
      const session = await refreshBafogDemo(userId, locale);
      if (session.id !== sessionId) {
        onSessionIdChange(session.id);
      }
      applyLoadedSession(session);
      onSampleRefreshed?.();
    } catch (err) {
      alert(
        t("chat.refreshSampleFailed", {
          error: err instanceof Error ? err.message : t("chat.unknownError"),
        })
      );
    } finally {
      setRefreshingSample(false);
    }
  };

  const sampleRefreshButton = (
    <button
      type="button"
      onClick={handleRefreshSample}
      disabled={refreshingSample || sessionsLoading}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-ink/10 bg-ink/5 px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-ink/10 active:bg-ink/10 disabled:opacity-50 touch-manipulation"
      title={t("chat.refreshSample")}
      aria-label={t("chat.refreshSample")}
    >
      {refreshingSample ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
      <span className="hidden md:inline">
        {refreshingSample ? t("chat.refreshingSample") : t("chat.refreshSample")}
      </span>
    </button>
  );

  const handleSend = async (text?: string, currentAttachments?: Attachment[]) => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }

    const msg = (text ?? input).trim();
    const attsToSend = currentAttachments ?? attachments;

    if ((!msg && attsToSend.length === 0) || loading) return;

    setInput("");
    setAttachments([]);
    const userMsg: ChatMessage = { role: "user", content: msg, attachments: attsToSend };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments,
      }));
      const res = await sendChat(msg, userId, history, sessionId, attsToSend, locale);

      if (res.session_id && res.session_id !== sessionId) {
        onSessionIdChange(res.session_id);
      }

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: res.answer,
        citations: res.citations,
        transparency_note: res.transparency_note,
        suggested_forms: res.suggested_forms,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      onResponse(assistantMsg);
      if (res.suggested_forms?.length) onFormSuggest(res.suggested_forms);
      setFollowUps(res.follow_up_questions || []);
    } catch (err) {
      const errMsg: ChatMessage = {
        role: "assistant",
        content: t("chat.apiError", {
          details: err instanceof Error ? err.message : "",
        }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
      <div className="flex items-center justify-between gap-2 border-b border-ink/10 px-3 py-2.5 lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          {onOpenChatsList && (
            <button
              type="button"
              onClick={onOpenChatsList}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-muted transition touch-manipulation active:bg-surface-warm active:text-ink"
              aria-label={t("layout.mobile.chats")}
            >
              <MessagesSquare className="h-4 w-4" />
            </button>
          )}
          <MessageSquare className="h-4 w-4 shrink-0 text-pink" />
          <h2 className="truncate font-semibold text-ink">{t("chat.title")}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {sampleRefreshButton}
          {onOpenSources && sourcesCount > 0 && (
            <button
              type="button"
              onClick={() => onOpenSources()}
              className="relative flex shrink-0 items-center gap-1 rounded-lg border border-ink/10 bg-ink/5 px-2.5 py-1.5 text-xs font-semibold text-ink transition active:bg-ink/10 touch-manipulation"
              aria-label={t("chat.referencesShort", { count: sourcesCount })}
            >
              <Shield className="h-3.5 w-3.5 text-pink" />
              <span>{sourcesCount}</span>
            </button>
          )}
        </div>
      </div>

      <div className="hidden border-b border-ink/10 px-3 py-2.5 sm:block sm:px-4 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <MessageSquare className="h-4 w-4 shrink-0 text-pink" />
            <h2 className="truncate font-semibold text-ink">{t("chat.title")}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {sampleRefreshButton}
            {onOpenSources && sourcesCount > 0 && (
              <button
                type="button"
                onClick={() => onOpenSources()}
                className="relative flex shrink-0 items-center gap-1 rounded-lg border border-ink/10 bg-ink/5 px-2.5 py-1.5 text-xs font-semibold text-ink transition active:bg-ink/10 lg:hidden touch-manipulation"
                aria-label={t("chat.referencesShort", { count: sourcesCount })}
              >
                <Shield className="h-3.5 w-3.5 text-pink" />
                <span>{sourcesCount}</span>
              </button>
            )}
          </div>
        </div>
        <p className="mt-1 hidden text-xs text-slate-500 sm:block">
          {t("chat.subtitle")}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3 sm:p-4">
        {loadingSession ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("chat.loadingSession")}
          </div>
        ) : messages.length === 0 ? (
          loading ? (
            <AnalysisLoadingScreen
              activeStep={analysisLoadingStep}
              title={t("newChat.loadingTitle")}
              subtitle={t("newChat.loadingSubtitle")}
              stepLabels={{
                reading: t("newChat.loadingSteps.reading"),
                deadline: t("newChat.loadingSteps.deadline"),
                amounts: t("newChat.loadingSteps.amounts"),
                recommendation: t("newChat.loadingSteps.recommendation"),
              }}
            />
          ) : (
            <div className="space-y-4 py-4">
              <div className="card-gradient relative overflow-hidden rounded-3xl p-5 text-white shadow-lg">
              <Search className="pointer-events-none absolute -right-4 -top-2 h-32 w-32 text-white/10" strokeWidth={1.25} />
              <div className="relative">
                <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-white/90">
                  <Shield className="h-3.5 w-3.5 text-amber-300" fill="currentColor" />
                  {t("chat.heroSaved")}
                </div>
                <p className="text-4xl font-extrabold tracking-tight">{t("chat.heroAmount")}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleScanWithCamera}
              disabled={uploadDisabled}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-pink px-4 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-pink-dark active:scale-[0.98] touch-manipulation disabled:opacity-50"
            >
              <ScanLine className="h-4 w-4" />
              {t("chat.heroCta")}
            </button>

            <div className="pt-2 text-center">
              <p className="font-bold text-lg text-ink">{t("chat.emptyTitle")}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
                {t("chat.emptyDescription")}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {starters.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs text-ink shadow-sm transition hover:border-pink hover:bg-pink/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-3.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-pink text-white"
                    : "border border-ink/8 bg-white text-ink shadow-sm"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="prose-legal">
                    <AssistantMessage
                      content={m.content}
                      citations={m.citations}
                      onCitationClick={
                        onOpenSources && m.citations?.length
                          ? () => openMessageSources(m)
                          : undefined
                      }
                    />
                    {m.suggested_forms && m.suggested_forms.length > 0 && (
                      <div className="mt-3 border-t border-ink/10 pt-3">
                        <p className="mb-2 text-xs font-semibold text-ink/70">
                          {t("chat.matchingForms")}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {m.suggested_forms.map((form) => (
                            <button
                              key={form.id}
                              type="button"
                              onClick={() => {
                                const others = (m.suggested_forms || []).filter(
                                  (s) => s.id !== form.id
                                );
                                onFormSuggest([form, ...others]);
                                onOpenFormsTab?.();
                              }}
                              className="rounded-lg border border-pink/40 bg-pink/10 px-2.5 py-1.5 text-left text-xs text-ink transition hover:bg-pink/20"
                            >
                              <span className="font-medium">{form.title}</span>
                              <span className="mt-0.5 block text-[10px] text-slate-500">
                                {form.legal_basis.join(" · ")}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
                        {m.attachments.map((att, idx) => (
                          <button
                            key={idx}
                            onClick={() => onAttachmentSelect?.(att)}
                            className="flex items-center gap-1.5 rounded bg-white/10 border border-white/20 hover:bg-white/25 hover:border-white/30 px-2 py-1 text-xs text-white cursor-pointer transition-all duration-150"
                            title="In Dokumenten-Analyse anzeigen"
                          >
                            {att.file_type.startsWith("image/") ? (
                              <FileImage className="h-3 w-3 text-white/80 shrink-0" />
                            ) : att.file_type === "application/pdf" ? (
                              <FileText className="h-3 w-3 text-white/80 shrink-0" />
                            ) : (
                              <File className="h-3 w-3 text-white/80 shrink-0" />
                            )}
                            <span className="max-w-[120px] truncate" title={att.name}>
                              {att.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {m.citations && m.citations.length > 0 && onOpenSources && (
                  <button
                    type="button"
                    onClick={() => openMessageSources(m)}
                    className="mt-2 w-full border-t border-ink/10 pt-2 text-left text-[10px] font-medium text-slate-500 transition hover:text-pink active:text-pink touch-manipulation"
                  >
                    {t("chat.viewReferences", { count: m.citations.length })}
                  </button>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("chat.searching")}
          </div>
        )}
      </div>

      {followUps.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-ink/10 px-4 py-2">
          {followUps.map((q) => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              className="rounded-lg bg-ink/5 px-2.5 py-1 text-xs text-ink hover:bg-pink/20"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-ink/10 p-3 sm:p-4">
        {/* Uploaded attachments preview */}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((att, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-xl bg-ink/5 border border-ink/10 px-3 py-1.5 text-xs text-ink cursor-pointer hover:bg-ink/10 transition-colors"
                onClick={() => onAttachmentSelect?.(att)}
                title="In Dokumenten-Analyse anzeigen"
              >
                {att.file_type.startsWith("image/") ? (
                  <FileImage className="h-3.5 w-3.5 text-ink/70" />
                ) : att.file_type === "application/pdf" ? (
                  <FileText className="h-3.5 w-3.5 text-ink/70" />
                ) : (
                  <File className="h-3.5 w-3.5 text-ink/70" />
                )}
                <span className="font-medium max-w-[150px] truncate" title={att.name}>
                  {att.name}
                </span>
                {att.isPending ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                    Freigabe ausstehend
                  </span>
                ) : (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-green-100 text-green-800 border border-green-200 gap-0.5 shrink-0">
                    <Shield className="h-2.5 w-2.5" />
                    Freigegeben
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAttachment(idx);
                  }}
                  className="rounded-full p-0.5 hover:bg-ink/10 text-slate-400 hover:text-ink transition cursor-pointer shrink-0"
                  title={t("common.remove")}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Uploading progress / loading */}
        {uploading && (
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-pink" />
            <span>{t("chat.processingFile")}</span>
          </div>
        )}

        {attachments.some((att) => att.isPending) && (
          <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-2 flex items-center gap-1.5 animate-pulse shrink-0">
            <Info className="h-4 w-4 shrink-0" />
            <span>
              Bitte überprüfen Sie die Schwärzung der hochgeladenen Dokumente im rechten Panel, bevor Sie die Nachricht absenden.
            </span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end gap-2"
        >
          <div className="relative min-w-0 flex-1">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? t("chat.listening") : t("chat.placeholder")}
              readOnly={!inputEditable}
              enterKeyHint="send"
              inputMode="text"
              onPointerDown={() => {
                if (inputEditable) return;
                setInputEditable(true);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              onFocus={() => onInputFocusChange?.(true)}
              onBlur={() => onInputFocusChange?.(false)}
              className={`w-full rounded-xl border border-ink/15 bg-white py-3 pl-3.5 text-base outline-none ring-pink/30 focus:ring-2 disabled:opacity-75 sm:py-2.5 sm:pl-4 sm:text-sm ${
                isSpeechSupported ? "pr-[4.5rem] sm:pr-20" : "pr-11 sm:pr-12"
              }`}
              disabled={loading || loadingSession || uploading || attachments.some((att) => att.isPending)}
            />
            <div className="pointer-events-none absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 sm:right-2 sm:gap-1">
              {/* File Upload Button */}
              <button
                type="button"
                onClick={capture.openScanMenu}
                disabled={uploadDisabled}
                className="pointer-events-auto cursor-pointer rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-ink active:bg-slate-200 touch-manipulation sm:p-1.5"
                title={t("chat.uploadFile")}
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <DocumentCaptureInputs
                cameraInputRef={capture.cameraInputRef}
                fileInputRef={capture.fileInputRef}
                galleryInputRef={galleryInputRef}
                onChange={handleCaptureInputChange}
                disabled={uploadDisabled}
              />

              {/* Microphone Button */}
              {isSpeechSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={loading || loadingSession || uploading || attachments.some((att) => att.isPending)}
                  className={`pointer-events-auto cursor-pointer rounded-lg p-2 transition-all duration-300 touch-manipulation sm:p-1.5 ${
                    isListening
                      ? "text-red-500 bg-red-500/10 shadow-[0_0_10px_rgba(239,68,68,0.3)] animate-pulse"
                      : "text-slate-400 hover:text-ink hover:bg-slate-100"
                  }`}
                  title={isListening ? t("chat.stopSpeech") : t("chat.startSpeech")}
                >
                  {isListening ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || loadingSession || uploading || attachments.some((att) => att.isPending) || (!input.trim() && attachments.length === 0)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-pink text-white transition hover:bg-pink-dark active:scale-95 disabled:opacity-50 touch-manipulation sm:h-auto sm:w-auto sm:gap-2 sm:px-4 sm:py-2.5"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">{t("common.send")}</span>
          </button>
        </form>
      </div>

      <DocumentCaptureSheet
        open={capture.menuOpen}
        onClose={() => capture.setMenuOpen(false)}
        onScanWithCamera={handleScanWithCamera}
        onChooseFile={capture.openFilePicker}
        onChooseGallery={openGallery}
        showWebCameraOption={capture.showNativeCameraOption}
        showGalleryOption={prefersNativeCamera()}
      />

      <CameraScannerModal
        open={capture.cameraModalOpen}
        onClose={() => capture.setCameraModalOpen(false)}
        onCapture={capture.handleWebCapture}
        title={t("capture.cameraTitle")}
        hint={t("capture.cameraHint")}
        captureLabel={t("capture.cameraCapture")}
        cancelLabel={t("common.back")}
        permissionError={t("capture.cameraPermissionError")}
      />
    </div>
  );
}
