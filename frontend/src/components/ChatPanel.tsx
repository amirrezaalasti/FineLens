"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MessageSquare, Send, Mic, MicOff } from "lucide-react";
import { getChatSession, sendChat } from "@/lib/api";
import type { ChatMessage, LegalForm } from "@/lib/types";
import { AssistantMessage } from "@/components/AssistantMessage";

interface ChatPanelProps {
  userId: string;
  sessionId: string | null;
  onSessionIdChange: (sessionId: string) => void;
  onResponse: (msg: ChatMessage) => void;
  onFormSuggest: (forms: LegalForm[]) => void;
}

const STARTERS = [
  "Was sind meine Rechte bei einer Mieterhöhung?",
  "Wie stelle ich eine DSGVO-Auskunftsanfrage?",
  "Kann ich gegen eine Kündigung Widerspruch einlegen?",
];

export function ChatPanel({
  userId,
  sessionId,
  onSessionIdChange,
  onResponse,
  onFormSuggest,
}: ChatPanelProps) {
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
        recognition.lang = "de-DE";

        // Timeout to detect if the browser fails to start the microphone silently
        const startTimeout = setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current === recognition) {
            console.warn("Speech recognition did not start within 3 seconds. Possible device or permission block.");
            alert(
              "Die Spracherkennung reagiert nicht (Mikrofon startet nicht).\n\n" +
              "Bitte prüfen Sie:\n" +
              "1. Ist Ihr Mikrofon angeschlossen und aktiv?\n" +
              "2. Haben Sie in den Windows-Datenschutzeinstellungen den Mikrofonzugriff für Apps erlaubt?\n" +
              "3. Erlaubt Chrome/Edge der Webseite den Zugriff auf das Mikrofon?\n" +
              "4. Verwenden Sie ein Ad-Blocker/Privacy-Plugin (z.B. uBlock), das die Verbindung zu den Google-Sprachdiensten blockiert?"
            );
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
            alert("Mikrofon-Zugriff verweigert oder blockiert. Bitte erlauben Sie den Mikrofon-Zugriff in Ihren Browsereinstellungen.\n\nHinweis: Chrome erlaubt Spracheingabe nur auf sicheren Seiten (localhost oder https).");
          } else if (event.error === "no-speech") {
            console.log("No speech detected.");
          } else {
            alert(`Fehler bei der Spracherkennung: ${event.error}`);
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

  const handleSend = async (text?: string) => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }

    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setInput("");
    const userMsg: ChatMessage = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await sendChat(msg, userId, history, sessionId);

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
        content: `Es ist ein Fehler aufgetreten. Bitte prüfen Sie:\n• Backend läuft auf Port 8000\n• OPENAI_API_KEY ist in .env gesetzt\n• FalkorDB läuft (docker compose up -d)\n• Frontend-Port ist in CORS_ORIGINS erlaubt\n\n${err instanceof Error ? err.message : ""}`,
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
          <h2 className="font-semibold text-navy">Rechtsberatung</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Fragen Sie auf Deutsch — Antworten mit Quellennachweisen
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {loadingSession ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chat wird geladen...
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-4 py-8 text-center">
            <p className="font-serif text-lg text-navy">
              Wie kann ich Ihnen helfen?
            </p>
            <p className="mx-auto max-w-md text-sm text-slate-500">
              FineLens durchsucht deutsche Rechtsquellen über einen Graphiti
              Knowledge Graph und zeigt Ihnen transparent, woher jede Information stammt.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {STARTERS.map((s) => (
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
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
                {m.citations && m.citations.length > 0 && (
                  <p className="mt-2 border-t border-navy/10 pt-2 text-[10px] text-slate-400">
                    {m.citations.length} Quelle(n) — siehe Panel rechts
                  </p>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Durchsuche Wissensgraph...
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
              placeholder={isListening ? "Zuhören..." : "Ihre Rechtsfrage stellen..."}
              className="w-full rounded-xl border border-navy/15 bg-white pl-4 pr-12 py-2.5 text-sm outline-none ring-gold/30 focus:ring-2 disabled:opacity-75"
              disabled={loading || loadingSession}
            />
            {isSpeechSupported && (
              <button
                type="button"
                onClick={toggleListening}
                disabled={loading || loadingSession}
                className={`absolute right-3 z-10 cursor-pointer p-1.5 rounded-lg transition-all duration-300 ${
                  isListening
                    ? "text-red-500 bg-red-500/10 shadow-[0_0_10px_rgba(239,68,68,0.3)] animate-pulse"
                    : "text-slate-400 hover:text-navy hover:bg-slate-100"
                }`}
                title={isListening ? "Zuhören stoppen" : "Spracheingabe starten"}
              >
                {isListening ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || loadingSession || !input.trim()}
            className="flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-navy transition hover:bg-gold-light disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Senden</span>
          </button>
        </form>
      </div>
    </div>
  );
}
