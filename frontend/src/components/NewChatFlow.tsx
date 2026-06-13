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
import type { Attachment } from "@/lib/types";
import {
  DocumentCaptureInputs,
  DocumentCaptureSheet,
} from "@/components/DocumentCaptureSheet";
import { CameraScannerModal } from "@/components/CameraScannerModal";
import { prefersNativeCamera, useDocumentCapture } from "@/hooks/useDocumentCapture";

export type YellowEnvelopeAnswer = "yes" | "no" | "unknown";
export type FlowPhase = "upload" | "details" | "context";

export interface NewChatFlowResult {
  attachment: Attachment;
  eventDate: string;
  yellowEnvelope: YellowEnvelopeAnswer | null;
  context: string;
}

interface NewChatFlowProps {
  attachment: Attachment | null;
  setAttachment: (att: Attachment | null) => void;
  phase: FlowPhase;
  setPhase: (phase: FlowPhase) => void;
  eventDate: string;
  setEventDate: (date: string) => void;
  yellowEnvelope: YellowEnvelopeAnswer | null;
  setYellowEnvelope: (ans: YellowEnvelopeAnswer | null) => void;
  context: string;
  setContext: (text: string) => void;
  onComplete: (result: NewChatFlowResult) => void;
  onCancel: () => void;
  onGoToRedaction: (att: Attachment) => void;
  onUploadFile?: (file: File) => void;
}

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

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
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-ink/5 hover:text-ink cursor-pointer"
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
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-ink/5 hover:text-ink cursor-pointer"
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
              className={`flex h-9 w-full items-center justify-center rounded-full text-sm font-medium transition cursor-pointer ${
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
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-white text-ink shadow-sm transition hover:border-pink/30 active:scale-95 cursor-pointer"
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

export function NewChatFlow({
  attachment,
  setAttachment,
  phase,
  setPhase,
  eventDate,
  setEventDate,
  yellowEnvelope,
  setYellowEnvelope,
  context,
  setContext,
  onComplete,
  onCancel,
  onGoToRedaction,
  onUploadFile,
}: NewChatFlowProps) {
  const { t, locale, speechLocale } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const isSpeechSupported = useMemo(() => {
    if (typeof window === "undefined") return false;
    const w = window as any;
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  }, []);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseContextRef = useRef("");
  const isListeningRef = useRef(false);

  const weekdayLabels = useMemo(
    () =>
      Object.fromEntries(
        WEEKDAY_KEYS.map((key) => [key, t(`newChat.weekdays.${key}`)])
      ) as Record<(typeof WEEKDAY_KEYS)[number], string>,
    [t]
  );

  const processFiles = useCallback(
    async (files: FileList) => {
      if (files.length === 0) return;
      setUploading(true);
      try {
        const att = await uploadFile(files[0]);
        setAttachment(att);
        onUploadFile?.(files[0]);
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
    [t, onUploadFile]
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
    const w = window as any;
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

      recognition.onresult = (event: any) => {
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

  const startAnalysis = (contextValue: string) => {
    if (!attachment) return;
    stopListening();
    const result: NewChatFlowResult = {
      attachment,
      eventDate,
      yellowEnvelope,
      context: contextValue.trim(),
    };
    onComplete(result);
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
                  className="mt-3 text-xs font-medium text-green-800 underline-offset-2 hover:underline cursor-pointer"
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
                  className="flex w-full items-center gap-3 rounded-2xl bg-pink px-4 py-4 text-left text-white shadow-md transition hover:bg-pink-dark active:scale-[0.99] touch-manipulation disabled:opacity-50 cursor-pointer"
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
                    className="flex w-full items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-4 text-left shadow-sm transition hover:border-pink/30 active:scale-[0.99] touch-manipulation disabled:opacity-50 cursor-pointer"
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
                  className="flex w-full items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-4 text-left shadow-sm transition hover:border-pink/30 active:scale-[0.99] touch-manipulation disabled:opacity-50 cursor-pointer"
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
              <div className="flex items-center gap-2 text-sm text-slate-500 justify-center">
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
                    className={`rounded-xl border px-5 py-2.5 text-sm font-medium transition cursor-pointer ${
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
                className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition cursor-pointer ${
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
              className="text-sm text-slate-500 transition hover:text-ink cursor-pointer"
            >
              {t("newChat.cancel")}
            </button>
            <button
              type="button"
              onClick={() => onGoToRedaction(attachment!)}
              disabled={!attachment || uploading}
              className="w-full max-w-xs rounded-2xl bg-pink px-6 py-3.5 text-sm font-bold text-white transition hover:bg-pink-dark disabled:opacity-50 sm:w-auto cursor-pointer"
            >
              Weiter zur Schwärzung
            </button>
          </div>
        )}

        {phase === "details" && (
          <button
            type="button"
            onClick={() => setPhase("context")}
            disabled={!eventDate}
            className="w-full rounded-2xl bg-pink px-6 py-3.5 text-sm font-bold text-white transition hover:bg-pink-dark disabled:opacity-50 cursor-pointer"
          >
            {t("common.next")}
          </button>
        )}

        {phase === "context" && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => startAnalysis(context)}
              className="w-full rounded-2xl bg-pink px-6 py-3.5 text-sm font-bold text-white transition hover:bg-pink-dark cursor-pointer"
            >
              {t("newChat.startAnalysis")}
            </button>
            <button
              type="button"
              onClick={() => startAnalysis("")}
              className="w-full text-center text-sm text-ink-muted transition hover:text-ink cursor-pointer"
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
