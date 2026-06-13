"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  FileImage,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Info,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Search,
} from "lucide-react";
import { uploadFile } from "@/lib/api";
import { useTranslation } from "@/i18n";
import type { Attachment, ChatMessage } from "@/lib/types";
import {
  DocumentCaptureInputs,
  DocumentCaptureSheet,
} from "@/components/DocumentCaptureSheet";
import { CameraScannerModal } from "@/components/CameraScannerModal";
import { prefersNativeCamera, useDocumentCapture } from "@/hooks/useDocumentCapture";

export type YellowEnvelopeAnswer = "yes" | "no" | "unknown";

export interface NewChatFlowResult {
  attachment: Attachment;
  eventDate: string;
  yellowEnvelope: YellowEnvelopeAnswer | null;
  context: string;
}

export interface NewChatAnalysisResult {
  sessionId: string;
  attachment: Attachment;
  assistantMessage: ChatMessage;
  followUpQuestions: string[];
}

interface NewChatFlowProps {
  onAnalyze: (result: NewChatFlowResult) => Promise<NewChatAnalysisResult>;
  onComplete: (result: NewChatAnalysisResult) => void;
  onCancel: () => void;
}

type FlowPhase = "upload" | "details" | "context" | "analyzing";

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const LOADING_STEP_IDS = ["reading", "deadline", "amounts", "recommendation"] as const;

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateString(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function CalendarPicker({
  value,
  onChange,
  locale,
  weekdayLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  locale: string;
  weekdayLabel: (key: (typeof WEEKDAY_KEYS)[number]) => string;
}) {
  const selected = parseDateString(value) ?? new Date();
  const [viewDate, setViewDate] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1)
  );

  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
    [locale]
  );

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstWeekday = (new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const prevMonth = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const selectDay = (day: number) => {
    onChange(toDateString(new Date(viewDate.getFullYear(), viewDate.getMonth(), day)));
  };

  const selectedParsed = parseDateString(value);

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-ink/5 hover:text-ink"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold capitalize text-ink">
          {monthFormatter.format(viewDate)}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-ink/5 hover:text-ink"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-ink-muted">
        {WEEKDAY_KEYS.map((key) => (
          <span key={key}>{weekdayLabel(key)}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) =>
          day === null ? (
            <span key={`empty-${i}`} />
          ) : (
            <button
              key={day}
              type="button"
              onClick={() => selectDay(day)}
              className={`flex h-9 w-full items-center justify-center rounded-full text-sm font-medium transition ${
                selectedParsed &&
                selectedParsed.getDate() === day &&
                selectedParsed.getMonth() === viewDate.getMonth() &&
                selectedParsed.getFullYear() === viewDate.getFullYear()
                  ? "bg-pink text-white shadow-sm"
                  : "text-ink hover:bg-pink/10"
              }`}
            >
              {day}
            </button>
          )
        )}
      </div>
    </div>
  );
}

function StepHeader({
  step,
  total,
  onBack,
}: {
  step: number;
  total: number;
  onBack: () => void;
}) {
  const progress = (step / total) * 100;

  return (
    <div className="flex items-center gap-3 border-b border-ink/10 px-4 py-3">
      <button
        type="button"
        onClick={onBack}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-white text-ink shadow-sm transition hover:border-pink/30 active:scale-95"
        aria-label="Back"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full bg-pink transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-medium text-ink-muted">
          {step} / {total}
        </span>
      </div>
    </div>
  );
}

function AnalysisLoadingScreen({
  activeStep,
  title,
  subtitle,
  stepLabels,
  error,
  onRetry,
  retryLabel,
}: {
  activeStep: number;
  title: string;
  subtitle: string;
  stepLabels: Record<(typeof LOADING_STEP_IDS)[number], string>;
  error?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center bg-gradient-to-b from-pink via-pink-dark to-plum px-6 py-10 text-white">
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
          <Search className="h-7 w-7 text-white" />
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
                    ? "bg-yellow-400 text-plum"
                    : active
                      ? "border-2 border-white bg-white/10"
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

export function NewChatFlow({ onAnalyze, onComplete, onCancel }: NewChatFlowProps) {
  const { t, locale, speechLocale } = useTranslation();
  const [phase, setPhase] = useState<FlowPhase>("upload");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [eventDate, setEventDate] = useState(() => toDateString(new Date()));
  const [yellowEnvelope, setYellowEnvelope] = useState<YellowEnvelopeAnswer | null>(null);
  const [context, setContext] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisAttempt, setAnalysisAttempt] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const isSpeechSupported = useMemo(() => {
    if (typeof window === "undefined") return false;
    const w = window as Window & {
      SpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onend: (() => void) | null;
        onerror: ((event: { error: string }) => void) | null;
        onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onend: (() => void) | null;
        onerror: ((event: { error: string }) => void) | null;
        onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
        start: () => void;
        stop: () => void;
      };
    };
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  }, []);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const baseContextRef = useRef("");
  const isListeningRef = useRef(false);
  const pendingResultRef = useRef<NewChatFlowResult | null>(null);

  const weekdayLabels = useMemo(
    () =>
      Object.fromEntries(
        WEEKDAY_KEYS.map((key) => [key, t(`newChat.weekdays.${key}`)])
      ) as Record<(typeof WEEKDAY_KEYS)[number], string>,
    [t]
  );

  const loadingStepLabels = useMemo(
    () =>
      Object.fromEntries(
        LOADING_STEP_IDS.map((id) => [id, t(`newChat.loadingSteps.${id}`)])
      ) as Record<(typeof LOADING_STEP_IDS)[number], string>,
    [t]
  );

  const processFiles = useCallback(
    async (files: FileList) => {
      if (files.length === 0) return;
      setUploading(true);
      try {
        const att = await uploadFile(files[0]);
        setAttachment(att);
      } catch (err) {
        alert(
          t("chat.uploadError", {
            fileName: files[0].name,
            error: err instanceof Error ? err.message : t("chat.unknownError"),
          })
        );
      } finally {
        setUploading(false);
      }
    },
    [t]
  );

  const capture = useDocumentCapture({
    onFilesSelected: processFiles,
    disabled: uploading,
  });

  const openGallery = useCallback(() => {
    if (uploading) return;
    capture.setMenuOpen(false);
    galleryInputRef.current?.click();
  }, [capture, uploading]);

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

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  const getSpeechRecognition = () => {
    if (typeof window === "undefined") return null;
    const w = window as Window & {
      SpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onend: (() => void) | null;
        onerror: ((event: { error: string }) => void) | null;
        onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onend: (() => void) | null;
        onerror: ((event: { error: string }) => void) | null;
        onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
        start: () => void;
        stop: () => void;
      };
    };
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
  };

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    isListeningRef.current = false;
    setIsListening(false);
    recognitionRef.current = null;
  }, []);

  const toggleListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    if (isListeningRef.current) {
      stopListening();
      return;
    }

    isListeningRef.current = true;
    setIsListening(true);
    baseContextRef.current = context;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = speechLocale;

      recognition.onend = () => {
        isListeningRef.current = false;
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.onerror = (event: { error: string }) => {
        if (event.error === "not-allowed") {
          alert(t("chat.micDenied"));
        } else if (event.error !== "no-speech") {
          alert(t("chat.speechError", { error: event.error }));
        }
        isListeningRef.current = false;
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.onresult = (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        const base = baseContextRef.current;
        const separator = base && !base.endsWith(" ") ? " " : "";
        setContext(base + separator + transcript);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      isListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current = null;
    }
  }, [context, speechLocale, stopListening, t]);

  useEffect(() => {
    if (phase !== "analyzing" || !pendingResultRef.current) return;

    let cancelled = false;
    const flowResult = pendingResultRef.current;
    const stepTimers: ReturnType<typeof setTimeout>[] = [];

    LOADING_STEP_IDS.forEach((_, i) => {
      if (i === 0) return;
      stepTimers.push(
        setTimeout(() => {
          if (!cancelled) {
            setLoadingStep((current) => Math.max(current, i));
          }
        }, i * 1200)
      );
    });

    void onAnalyze(flowResult)
      .then((analysis) => {
        if (cancelled) return;
        setLoadingStep(LOADING_STEP_IDS.length);
        const finishTimer = setTimeout(() => {
          if (!cancelled) onComplete(analysis);
        }, 600);
        stepTimers.push(finishTimer);
      })
      .catch((err) => {
        if (cancelled) return;
        setAnalysisError(
          err instanceof Error ? err.message : t("newChat.analysisFailed")
        );
      });

    return () => {
      cancelled = true;
      stepTimers.forEach(clearTimeout);
    };
  }, [phase, analysisAttempt, onAnalyze, onComplete, t]);

  const startAnalysis = (contextValue: string) => {
    if (!attachment) return;
    stopListening();
    setAnalysisError(null);
    setLoadingStep(0);
    pendingResultRef.current = {
      attachment,
      eventDate,
      yellowEnvelope,
      context: contextValue.trim(),
    };
    setAnalysisAttempt((n) => n + 1);
    setPhase("analyzing");
  };

  const retryAnalysis = () => {
    if (!pendingResultRef.current) return;
    setAnalysisError(null);
    setLoadingStep(0);
    setAnalysisAttempt((n) => n + 1);
  };

  const handleBack = () => {
    stopListening();
    if (phase === "details") {
      setPhase("upload");
    } else if (phase === "context") {
      setPhase("details");
    } else {
      onCancel();
    }
  };

  const envelopeOptions: { value: YellowEnvelopeAnswer; label: string }[] = [
    { value: "yes", label: t("newChat.envelopeYes") },
    { value: "no", label: t("newChat.envelopeNo") },
    { value: "unknown", label: t("newChat.envelopeUnknown") },
  ];

  if (phase === "analyzing") {
    return (
      <div className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
        <AnalysisLoadingScreen
          activeStep={loadingStep}
          title={analysisError ? t("newChat.loadingErrorTitle") : t("newChat.loadingTitle")}
          subtitle={t("newChat.loadingSubtitle")}
          stepLabels={loadingStepLabels}
          error={analysisError}
          onRetry={analysisError ? retryAnalysis : undefined}
          retryLabel={t("newChat.retryAnalysis")}
        />
      </div>
    );
  }

  return (
    <div className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
      {phase === "upload" ? (
        <div className="border-b border-ink/10 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0 text-pink" />
            <h2 className="font-semibold text-ink">{t("newChat.title")}</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">{t("newChat.subtitle")}</p>
        </div>
      ) : (
        <StepHeader
          step={phase === "details" ? 1 : 2}
          total={2}
          onBack={handleBack}
        />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {phase === "upload" && (
          <div className="mx-auto max-w-lg space-y-5">
            <div>
              <h3 className="text-lg font-bold text-ink">{t("newChat.uploadTitle")}</h3>
              <p className="mt-1 text-sm text-ink-muted">{t("newChat.uploadDescription")}</p>
            </div>

            {attachment ? (
              <div className="rounded-2xl border border-green-200 bg-green-50/60 p-4">
                <div className="flex items-start gap-3">
                  {attachment.file_type.startsWith("image/") ? (
                    <FileImage className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
                  ) : (
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-green-900">{t("newChat.uploaded")}</p>
                    <p className="mt-0.5 truncate text-sm text-green-800">{attachment.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  className="mt-3 text-xs font-medium text-green-800 underline-offset-2 hover:underline"
                >
                  {t("newChat.changeDocument")}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleScanWithCamera}
                  disabled={uploading}
                  className="flex w-full items-center gap-3 rounded-2xl bg-pink px-4 py-4 text-left text-white shadow-md transition hover:bg-pink-dark active:scale-[0.99] touch-manipulation disabled:opacity-50"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
                    <Camera className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{t("capture.scanCamera")}</span>
                    <span className="block text-xs text-white/80">{t("capture.scanCameraHint")}</span>
                  </span>
                </button>

                {prefersNativeCamera() && (
                  <button
                    type="button"
                    onClick={openGallery}
                    disabled={uploading}
                    className="flex w-full items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-4 text-left shadow-sm transition hover:border-pink/30 active:scale-[0.99] touch-manipulation disabled:opacity-50"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-pink/15">
                      <ImageIcon className="h-5 w-5 text-pink" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-ink">{t("capture.chooseGallery")}</span>
                      <span className="block text-xs text-ink-muted">{t("capture.chooseGalleryHint")}</span>
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={capture.openFilePicker}
                  disabled={uploading}
                  className="flex w-full items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-4 text-left shadow-sm transition hover:border-pink/30 active:scale-[0.99] touch-manipulation disabled:opacity-50"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-pink/15">
                    <FolderOpen className="h-5 w-5 text-pink" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-ink">{t("capture.chooseFile")}</span>
                    <span className="block text-xs text-ink-muted">{t("capture.chooseFileHint")}</span>
                  </span>
                </button>
              </div>
            )}

            {uploading && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-pink" />
                {t("newChat.processingDocument")}
              </div>
            )}

            <DocumentCaptureInputs
              cameraInputRef={capture.cameraInputRef}
              fileInputRef={capture.fileInputRef}
              galleryInputRef={galleryInputRef}
              onChange={handleCaptureInputChange}
              disabled={uploading}
            />
          </div>
        )}

        {phase === "details" && (
          <div className="mx-auto max-w-lg space-y-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100">
                <Calendar className="h-5 w-5 text-orange-700" />
              </span>
              <h3 className="pt-1.5 text-xl font-bold leading-snug text-ink">
                {t("newChat.receivedDateTitle")}
              </h3>
            </div>

            <CalendarPicker
              value={eventDate}
              onChange={setEventDate}
              locale={locale}
              weekdayLabel={(key) => weekdayLabels[key]}
            />

            <div>
              <div className="mb-3 flex items-center gap-2">
                <p className="text-sm font-bold text-ink">{t("newChat.envelopeQuestion")}</p>
                <button
                  type="button"
                  title={t("newChat.envelopeHint")}
                  className="text-ink-muted transition hover:text-ink"
                  aria-label={t("newChat.envelopeHint")}
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {envelopeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setYellowEnvelope(opt.value)}
                    className={`rounded-xl border px-5 py-2.5 text-sm font-medium transition ${
                      yellowEnvelope === opt.value
                        ? "border-pink bg-pink/10 text-pink"
                        : "border-ink/15 bg-white text-ink hover:border-pink/30"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {phase === "context" && (
          <div className="mx-auto max-w-lg space-y-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink/15">
                <MessageSquare className="h-5 w-5 text-pink" />
              </span>
              <h3 className="pt-1.5 text-xl font-bold leading-snug text-ink">
                {t("newChat.contextTitle")}
              </h3>
            </div>

            <textarea
              rows={6}
              className="w-full resize-none rounded-2xl border border-ink/15 bg-white px-4 py-3.5 text-sm outline-none placeholder:text-ink-muted/70 focus:ring-2 focus:ring-pink/40"
              placeholder={t("newChat.contextPlaceholder")}
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />

            {isSpeechSupported && (
              <button
                type="button"
                onClick={toggleListening}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                  isListening
                    ? "border-pink bg-pink/10 text-pink"
                    : "border-ink/15 bg-white text-ink hover:border-pink/30"
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="h-4 w-4" />
                    {t("chat.stopSpeech")}
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 text-pink" />
                    {t("newChat.speakInstead")}
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-ink/10 px-4 py-4 sm:px-6">
        {phase === "upload" && (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-slate-500 transition hover:text-ink"
            >
              {t("newChat.cancel")}
            </button>
            <button
              type="button"
              onClick={() => setPhase("details")}
              disabled={!attachment || uploading}
              className="w-full max-w-xs rounded-2xl bg-pink px-6 py-3.5 text-sm font-bold text-white transition hover:bg-pink-dark disabled:opacity-50 sm:w-auto"
            >
              {t("common.next")}
            </button>
          </div>
        )}

        {phase === "details" && (
          <button
            type="button"
            onClick={() => setPhase("context")}
            disabled={!eventDate}
            className="w-full rounded-2xl bg-pink px-6 py-3.5 text-sm font-bold text-white transition hover:bg-pink-dark disabled:opacity-50"
          >
            {t("common.next")}
          </button>
        )}

        {phase === "context" && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => startAnalysis(context)}
              className="w-full rounded-2xl bg-pink px-6 py-3.5 text-sm font-bold text-white transition hover:bg-pink-dark"
            >
              {t("newChat.startAnalysis")}
            </button>
            <button
              type="button"
              onClick={() => startAnalysis("")}
              className="w-full text-center text-sm text-ink-muted transition hover:text-ink"
            >
              {t("newChat.skip")}
            </button>
          </div>
        )}
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
