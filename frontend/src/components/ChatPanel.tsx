"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MessageSquare, Send, Mic, MicOff, Paperclip, X, FileText, FileImage, File, Info, Shield } from "lucide-react";
import { getChatSession, sendChat, uploadFile } from "@/lib/api";
import { useTranslation } from "@/i18n";
import type { ChatMessage, LegalForm, Attachment } from "@/lib/types";
import { AssistantMessage } from "@/components/AssistantMessage";

interface ChatPanelProps {
  userId: string;
  sessionId: string | null;
  onSessionIdChange: (sessionId: string) => void;
  onResponse: (msg: ChatMessage) => void;
  onFormSuggest: (forms: LegalForm[]) => void;
  onOpenFormsTab?: () => void;
  onAttachmentSelect?: (attachment: Attachment) => void;
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
}

const STARTERS_KEY = "chat.starters";

export function ChatPanel({
  userId,
  sessionId,
  onSessionIdChange,
  onResponse,
  onFormSuggest,
  onOpenFormsTab,
  onAttachmentSelect,
  attachments,
  setAttachments,
}: ChatPanelProps) {
  const { t, tArray, locale, speechLocale } = useTranslation();
  const starters = tArray(STARTERS_KEY);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newAttachments: Attachment[] = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const att = await uploadFile(files[i]);
        att.isPending = true;
        newAttachments.push(att);
      } catch (err) {
        console.error("Failed to upload file:", err);
        alert(t("chat.uploadError", {
          fileName: files[i].name,
          error: err instanceof Error ? err.message : t("chat.unknownError"),
        }));
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    setUploading(false);
    
    if (newAttachments.length > 0 && onAttachmentSelect) {
      onAttachmentSelect(newAttachments[0]);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

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

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      setFollowUps([]);
      return;
    }

    let cancelled = false;
    setLoadingSession(true);

    getChatSession(sessionId, userId)
      .then((session) => {
        if (cancelled) return;
        setMessages(session.messages);
        setFollowUps([]);
        const lastAssistant = [...session.messages]
          .reverse()
          .find((m) => m.role === "assistant");
        if (lastAssistant) onResponseRef.current(lastAssistant);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, userId]);

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
    <div className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-2xl shadow-sm">
      <div className="border-b border-navy/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-gold" />
          <h2 className="font-semibold text-navy">{t("chat.title")}</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {t("chat.subtitle")}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {loadingSession ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("chat.loadingSession")}
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-4 py-8 text-center">
            <p className="font-serif text-lg text-navy">
              {t("chat.emptyTitle")}
            </p>
            <p className="mx-auto max-w-md text-sm text-slate-500">
              {t("chat.emptyDescription")}
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {starters.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="rounded-full border border-navy/15 bg-white px-3 py-1.5 text-xs text-navy transition hover:border-gold hover:bg-gold/10"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-3.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-navy text-white"
                    : "border border-navy/8 bg-white text-navy shadow-sm"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="prose-legal">
                    <AssistantMessage content={m.content} citations={m.citations} />
                    {m.suggested_forms && m.suggested_forms.length > 0 && (
                      <div className="mt-3 border-t border-navy/10 pt-3">
                        <p className="mb-2 text-xs font-semibold text-navy/70">
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
                              className="rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-left text-xs text-navy transition hover:bg-gold/20"
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
                {m.citations && m.citations.length > 0 && (
                  <p className="mt-2 border-t border-navy/10 pt-2 text-[10px] text-slate-400">
                    {t("chat.citationsCount", { count: m.citations.length })}
                  </p>
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
        <div className="flex flex-wrap gap-2 border-t border-navy/10 px-4 py-2">
          {followUps.map((q) => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              className="rounded-lg bg-navy/5 px-2.5 py-1 text-xs text-navy hover:bg-gold/20"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-navy/10 p-4">
        {/* Uploaded attachments preview */}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((att, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-xl bg-navy/5 border border-navy/10 px-3 py-1.5 text-xs text-navy cursor-pointer hover:bg-navy/10 transition-colors"
                onClick={() => onAttachmentSelect?.(att)}
                title="In Dokumenten-Analyse anzeigen"
              >
                {att.file_type.startsWith("image/") ? (
                  <FileImage className="h-3.5 w-3.5 text-navy/70" />
                ) : att.file_type === "application/pdf" ? (
                  <FileText className="h-3.5 w-3.5 text-navy/70" />
                ) : (
                  <File className="h-3.5 w-3.5 text-navy/70" />
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
                  className="rounded-full p-0.5 hover:bg-navy/15 text-slate-400 hover:text-navy transition cursor-pointer shrink-0"
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
            <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />
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
          className="flex gap-2"
        >
          <div className="relative flex-1 flex items-center">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? t("chat.listening") : t("chat.placeholder")}
              className={`w-full rounded-xl border border-navy/15 bg-white pl-4 py-2.5 text-sm outline-none ring-gold/30 focus:ring-2 disabled:opacity-75 ${
                isSpeechSupported ? "pr-20" : "pr-12"
              }`}
              disabled={loading || loadingSession || uploading || attachments.some((att) => att.isPending)}
            />
            <div className="absolute right-2 flex items-center gap-1 z-10">
              {/* File Upload Button */}
              <button
                type="button"
                onClick={triggerFileInput}
                disabled={loading || loadingSession || uploading || attachments.some((att) => att.isPending)}
                className="text-slate-400 hover:text-navy hover:bg-slate-100 p-1.5 rounded-lg transition-all cursor-pointer"
                title={t("chat.uploadFile")}
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,application/pdf,text/*"
                className="hidden"
                multiple
              />

              {/* Microphone Button */}
              {isSpeechSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={loading || loadingSession || uploading || attachments.some((att) => att.isPending)}
                  className={`cursor-pointer p-1.5 rounded-lg transition-all duration-300 ${
                    isListening
                      ? "text-red-500 bg-red-500/10 shadow-[0_0_10px_rgba(239,68,68,0.3)] animate-pulse"
                      : "text-slate-400 hover:text-navy hover:bg-slate-100"
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
            className="flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-navy transition hover:bg-gold-light disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">{t("common.send")}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
