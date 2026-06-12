"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Brain,
  FileText,
  MessageSquareQuote,
  Network,
  Search,
} from "lucide-react";
import { PIPELINE_STEPS } from "@/lib/demo-graph-data";

const ICONS = {
  book: BookOpen,
  file: FileText,
  brain: Brain,
  network: Network,
  search: Search,
  message: MessageSquareQuote,
} as const;

export function PipelineFlow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % PIPELINE_STEPS.length), 2800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative">
      <div className="absolute left-0 right-0 top-[2.75rem] hidden h-0.5 bg-navy/10 lg:block">
        <div
          className="demo-pipeline-progress h-full bg-gradient-to-r from-gold/80 to-gold transition-all duration-700 ease-out"
          style={{ width: `${((active + 1) / PIPELINE_STEPS.length) * 100}%` }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {PIPELINE_STEPS.map((step, i) => {
          const Icon = ICONS[step.icon];
          const isActive = i === active;
          const isPast = i < active;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setActive(i)}
              className={`group relative rounded-2xl border p-5 text-left transition-all duration-500 ${
                isActive
                  ? "demo-pipeline-card-active border-gold/40 bg-white shadow-lg shadow-gold/10"
                  : isPast
                    ? "border-navy/10 bg-white/80"
                    : "border-navy/8 bg-white/60 hover:border-navy/15 hover:bg-white"
              }`}
            >
              <div
                className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl transition ${
                  isActive
                    ? "bg-gold text-navy"
                    : isPast
                      ? "bg-navy/10 text-navy"
                      : "bg-navy/5 text-navy/50 group-hover:bg-navy/10 group-hover:text-navy"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isActive ? "text-gold" : "text-navy/40"
                  }`}
                >
                  Schritt {i + 1}
                </span>
                {isActive && (
                  <span className="demo-pipeline-dot h-1.5 w-1.5 rounded-full bg-gold" />
                )}
              </div>
              <h4 className="font-semibold text-navy">{step.label}</h4>
              <p
                className={`mt-1.5 text-xs leading-relaxed transition ${
                  isActive ? "text-navy/70" : "text-navy/45"
                }`}
              >
                {step.detail}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-8 rounded-xl border border-navy/10 bg-navy p-5 text-sm text-white/80 lg:hidden">
        <span className="text-xs font-bold uppercase tracking-wider text-gold">Live-Flow</span>
        <p className="mt-2 font-medium text-white">
          {PIPELINE_STEPS[active].label}
        </p>
        <p className="mt-1 text-white/60">{PIPELINE_STEPS[active].detail}</p>
      </div>
    </div>
  );
}
