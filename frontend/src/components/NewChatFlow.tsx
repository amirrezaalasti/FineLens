"use client";

import { useCallback, useRef, useState } from "react";
import {
  Calendar,
  Camera,
  Check,
  ChevronRight,
  FileImage,
  FileText,
  FolderOpen,
  Image,
  Loader2,
  MessageSquarePlus,
  ScanLine,
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

export interface NewChatFlowResult {
  attachment: Attachment;
  eventDate: string;
  context: string;
}

interface NewChatFlowProps {
  onComplete: (result: NewChatFlowResult) => void;
  onCancel: () => void;
}

const STEP_IDS = ["upload", "details", "chat"] as const;

export function NewChatFlow({ onComplete, onCancel }: NewChatFlowProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [eventDate, setEventDate] = useState("");
  const [context, setContext] = useState("");
  const [uploading, setUploading] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

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

  const stepTitle = (id: (typeof STEP_IDS)[number]) => t(`newChat.steps.${id}`);

  const inputClass =
    "w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink/40";

  const canContinueUpload = Boolean(attachment) && !uploading;
  const canStartChat = context.trim().length > 0;

  const handleStartChat = () => {
    if (!attachment || !canStartChat) return;
    onComplete({ attachment, eventDate, context: context.trim() });
  };

  return (
    <div className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
      <div className="border-b border-ink/10 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2">
          <MessageSquarePlus className="h-4 w-4 shrink-0 text-pink" />
          <h2 className="font-semibold text-ink">{t("newChat.title")}</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">{t("newChat.subtitle")}</p>
      </div>

      <div className="border-b border-ink/10 px-3 py-3 sm:px-4">
        <div className="flex gap-2">
          {STEP_IDS.map((id, i) => (
            <div
              key={id}
              className={`flex flex-1 items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition sm:px-3 ${
                i === step
                  ? "bg-pink text-white"
                  : i < step
                    ? "bg-green-50 text-green-800"
                    : "bg-ink/5 text-slate-500"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  i < step ? "bg-green-500 text-white" : i === step ? "bg-white/20" : "bg-white/60"
                }`}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="hidden truncate sm:inline">{stepTitle(id)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {step === 0 && (
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
                      <Image className="h-5 w-5 text-pink" />
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

        {step === 1 && attachment && (
          <div className="mx-auto max-w-lg space-y-5">
            <div>
              <h3 className="text-lg font-bold text-ink">{t("newChat.detailsTitle")}</h3>
              <p className="mt-1 text-sm text-ink-muted">{t("newChat.detailsDescription")}</p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-ink/10 bg-ink/5 px-3 py-2 text-xs text-ink">
              {attachment.file_type.startsWith("image/") ? (
                <FileImage className="h-3.5 w-3.5 shrink-0 text-ink/70" />
              ) : (
                <FileText className="h-3.5 w-3.5 shrink-0 text-ink/70" />
              )}
              <span className="truncate font-medium">{attachment.name}</span>
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <Calendar className="h-3.5 w-3.5" />
                {t("newChat.eventDate")}
              </label>
              <input
                type="date"
                className={inputClass}
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                {t("newChat.context")}
              </label>
              <textarea
                rows={5}
                className={inputClass}
                placeholder={t("newChat.contextPlaceholder")}
                value={context}
                onChange={(e) => setContext(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-ink/10 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={step === 0 ? onCancel : () => setStep((s) => s - 1)}
          className="text-sm text-slate-500 transition hover:text-ink"
        >
          {step === 0 ? t("newChat.cancel") : t("common.back")}
        </button>

        {step === 0 ? (
          <button
            type="button"
            onClick={() => setStep(1)}
            disabled={!canContinueUpload}
            className="flex items-center gap-2 rounded-xl bg-pink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-pink-dark disabled:opacity-50"
          >
            {t("common.next")} <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStartChat}
            disabled={!canStartChat}
            className="flex items-center gap-2 rounded-xl bg-pink px-5 py-2.5 text-sm font-bold text-white transition hover:bg-pink-dark disabled:opacity-50"
          >
            <ScanLine className="h-4 w-4" />
            {t("newChat.startChat")}
          </button>
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
