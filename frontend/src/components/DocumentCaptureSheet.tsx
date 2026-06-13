"use client";

import { Camera, FolderOpen, Image, X } from "lucide-react";
import { useTranslation } from "@/i18n";

interface DocumentCaptureSheetProps {
  open: boolean;
  onClose: () => void;
  onScanWithCamera: () => void;
  onChooseFile: () => void;
  onChooseGallery?: () => void;
  showWebCameraOption?: boolean;
  showGalleryOption?: boolean;
}

export function DocumentCaptureSheet({
  open,
  onClose,
  onScanWithCamera,
  onChooseFile,
  onChooseGallery,
  showWebCameraOption = true,
  showGalleryOption = false,
}: DocumentCaptureSheetProps) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/40">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t("common.back")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("capture.title")}
        className="relative w-full max-w-lg rounded-t-3xl bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink">{t("capture.title")}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-ink-muted transition hover:bg-surface-warm hover:text-ink"
            aria-label={t("common.back")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-ink-muted">{t("capture.subtitle")}</p>

        <div className="space-y-2">
          {showWebCameraOption && (
            <button
              type="button"
              onClick={onScanWithCamera}
              className="flex w-full items-center gap-3 rounded-2xl bg-pink px-4 py-4 text-left text-white shadow-md transition hover:bg-pink-dark active:scale-[0.99] touch-manipulation"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
                <Camera className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-bold">{t("capture.scanCamera")}</span>
                <span className="block text-xs text-white/80">{t("capture.scanCameraHint")}</span>
              </span>
            </button>
          )}

          {showGalleryOption && onChooseGallery && (
            <button
              type="button"
              onClick={onChooseGallery}
              className="flex w-full items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-4 text-left shadow-sm transition hover:border-pink/30 active:scale-[0.99] touch-manipulation"
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
            onClick={onChooseFile}
            className="flex w-full items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-4 text-left shadow-sm transition hover:border-pink/30 active:scale-[0.99] touch-manipulation"
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
      </div>
    </div>
  );
}

interface DocumentCaptureInputsProps {
  cameraInputRef: React.RefObject<HTMLInputElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  galleryInputRef?: React.RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

export function DocumentCaptureInputs({
  cameraInputRef,
  fileInputRef,
  galleryInputRef,
  onChange,
  disabled = false,
}: DocumentCaptureInputsProps) {
  return (
    <>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onChange}
        disabled={disabled}
        className="hidden"
      />
      {galleryInputRef && (
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={onChange}
          disabled={disabled}
          className="hidden"
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,text/*"
        onChange={onChange}
        disabled={disabled}
        className="hidden"
        multiple
      />
    </>
  );
}
