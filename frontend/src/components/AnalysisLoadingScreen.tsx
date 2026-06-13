"use client";

import { Search } from "lucide-react";

export const LOADING_STEP_IDS = ["reading", "deadline", "amounts", "recommendation"] as const;

interface AnalysisLoadingScreenProps {
  activeStep: number;
  title: string;
  subtitle: string;
  stepLabels: Record<(typeof LOADING_STEP_IDS)[number], string>;
  error?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
}

export function AnalysisLoadingScreen({
  activeStep,
  title,
  subtitle,
  stepLabels,
  error,
  onRetry,
  retryLabel,
}: AnalysisLoadingScreenProps) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center bg-gradient-to-b from-pink via-pink-dark to-plum px-6 py-10 text-white rounded-3xl">
      <div className="relative mb-8 flex h-24 w-24 items-center justify-center">
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="#facc15"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${((activeStep + 0.5) / LOADING_STEP_IDS.length) * 276} 276`}
          />
        </svg>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
          <Search className="h-7 w-7 text-white animate-pulse" />
        </div>
      </div>

      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-2 text-center text-sm text-white/80">
        {error ?? subtitle}
      </p>

      {error && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-pink transition hover:bg-white/90"
        >
          {retryLabel}
        </button>
      )}

      <ul className={`mt-10 w-full max-w-xs space-y-4 ${error ? "opacity-40" : ""}`}>
        {LOADING_STEP_IDS.map((id, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          const pending = i > activeStep;

          return (
            <li
              key={id}
              className={`flex items-center gap-3 text-sm transition ${
                pending ? "text-white/35" : "text-white"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  done
                    ? "bg-yellow-400 text-plum animate-scale-in"
                    : active
                      ? "border-2 border-white bg-white/10 animate-pulse"
                      : "border border-white/25 bg-white/5"
                }`}
              >
                {done ? (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M4.5 9.5L1.5 6.5l1-1 2 2 5-5 1 1-6 6z" />
                  </svg>
                ) : active ? (
                  <span className="h-2 w-2 rounded-full bg-white" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                )}
              </span>
              <span className={pending ? "font-normal" : "font-medium"}>{stepLabels[id]}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
