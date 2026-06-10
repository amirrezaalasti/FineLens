"use client";

import { useRef, useState } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { sendChat } from "@/lib/api";
import type { ChatMessage, LegalForm } from "@/lib/types";

interface ChatPanelProps {
  userId: string;
  onResponse: (msg: ChatMessage) => void;
  onFormSuggest: (forms: LegalForm[]) => void;
}

const STARTERS = [
  "Was sind meine Rechte bei einer Mieterhöhung?",
  "Wie stelle ich eine DSGVO-Auskunftsanfrage?",
  "Kann ich gegen eine Kündigung Widerspruch einlegen?",
];

export function ChatPanel({ userId, onResponse, onFormSuggest }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollDown = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setInput("");
    const userMsg: ChatMessage = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    scrollDown();

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await sendChat(msg, userId, history);

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
      scrollDown();
    }
  };

  return (
    <div className="glass flex h-full flex-col rounded-2xl shadow-sm">
      <div className="border-b border-navy/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-gold" />
          <h2 className="font-semibold text-navy">Rechtsberatung</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Fragen Sie auf Deutsch — Antworten mit Quellennachweisen
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-4 py-8 text-center">
            <p className="font-serif text-lg text-navy">
              Wie kann ich Ihnen helfen?
            </p>
            <p className="mx-auto max-w-md text-sm text-slate-500">
              RechtsLens durchsucht deutsche Rechtsquellen über einen Graphiti
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
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-navy text-white"
                  : "border border-navy/8 bg-white text-navy shadow-sm"
              }`}
            >
              <div className="prose-legal whitespace-pre-wrap">{m.content}</div>
              {m.citations && m.citations.length > 0 && (
                <p className="mt-2 border-t border-navy/10 pt-2 text-[10px] text-slate-400">
                  {m.citations.length} Quelle(n) verwendet — siehe Panel rechts
                </p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Durchsuche Wissensgraph...
          </div>
        )}
        <div ref={bottomRef} />
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
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ihre Rechtsfrage stellen..."
            className="flex-1 rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm outline-none ring-gold/30 focus:ring-2"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
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
