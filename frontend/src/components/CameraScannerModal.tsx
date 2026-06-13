"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface CameraScannerModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  title: string;
  hint: string;
  captureLabel: string;
  cancelLabel: string;
  permissionError: string;
}

export function CameraScannerModal({
  open,
  onClose,
  onCapture,
  title,
  hint,
  captureLabel,
  cancelLabel,
  permissionError,
}: CameraScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setError(null);
      return;
    }

    let cancelled = false;

    async function startCamera() {
      setError(null);
      setReady(false);

      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        };

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch {
        if (!cancelled) setError(permissionError);
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, permissionError, stopStream]);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || !ready) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `scan-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(file);
      },
      "image/jpeg",
      0.92
    );
  }, [onCapture, ready]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="border-b border-ink/10 px-4 py-3">
          <h3 className="font-bold text-ink">{title}</h3>
          <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>
        </div>

        <div className="relative aspect-[3/4] bg-black sm:aspect-video">
          {error ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/90">
              {error}
            </div>
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="h-full w-full object-cover"
            />
          )}
          {!error && (
            <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-white/50" />
          )}
        </div>

        <div className="flex gap-2 border-t border-ink/10 p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-ink/10 px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface-warm"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={capturePhoto}
            disabled={!ready || Boolean(error)}
            className="flex-1 rounded-2xl bg-pink px-4 py-3 text-sm font-bold text-white transition hover:bg-pink-dark disabled:opacity-50"
          >
            {captureLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
