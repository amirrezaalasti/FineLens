"use client";

import { useCallback, useRef, useState } from "react";
import {
  Camera,
  FileImage,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Calendar,
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
}

interface NewChatFlowProps {
  onComplete: (result: NewChatFlowResult) => void;
  onCancel: () => void;
}

export function NewChatFlow({ onComplete, onCancel }: NewChatFlowProps) {
  const { t } = useTranslation();
  const [attachment, setAttachment] = useState<Attachment | null>(null);
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

  const handleNext = () => {
    if (!attachment) return;
    onComplete({ attachment });
  };

  return (
    <div className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
      <div className="border-b border-ink/10 px-4 py-3 sm:px-5 sm:py-4 shrink-0">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-pink" />
          <h2 className="font-semibold text-ink">{t("newChat.title")}</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">{t("newChat.subtitle")}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col justify-center">
        <div className="mx-auto w-full max-w-md space-y-5">
          <div className="text-center mb-6">
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
            <div className="space-y-3">
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
      </div>

      <div className="border-t border-ink/10 px-4 py-4 sm:px-6 shrink-0 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-slate-500 transition hover:text-ink cursor-pointer"
        >
          {t("newChat.cancel")}
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!attachment || uploading}
          className="w-full max-w-xs rounded-2xl bg-pink px-6 py-3.5 text-sm font-bold text-white transition hover:bg-pink-dark disabled:opacity-50 sm:w-auto cursor-pointer"
        >
          Weiter zur Schwärzung
        </button>
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
