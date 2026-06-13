"use client";

import { useCallback, useRef, useState } from "react";

export function prefersNativeCamera(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isMobileUa = /Android|iPhone|iPad|iPod/i.test(ua);
  const isCoarseTouch =
    window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 900;
  return isMobileUa || isCoarseTouch;
}

export function hasWebCamera(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

interface UseDocumentCaptureOptions {
  onFilesSelected: (files: FileList) => void;
  disabled?: boolean;
}

export function useDocumentCapture({
  onFilesSelected,
  disabled = false,
}: UseDocumentCaptureOptions) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  const resetInputs = useCallback(() => {
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      onFilesSelected(files);
      resetInputs();
    },
    [onFilesSelected, resetInputs]
  );

  const openFilePicker = useCallback(() => {
    if (disabled) return;
    setMenuOpen(false);
    fileInputRef.current?.click();
  }, [disabled]);

  const openNativeCamera = useCallback(() => {
    if (disabled) return;
    setMenuOpen(false);
    cameraInputRef.current?.click();
  }, [disabled]);

  const openWebCamera = useCallback(() => {
    if (disabled) return;
    setMenuOpen(false);
    setCameraModalOpen(true);
  }, [disabled]);

  const openCamera = useCallback(() => {
    if (disabled) return;
    if (prefersNativeCamera()) {
      openNativeCamera();
      return;
    }
    if (hasWebCamera()) {
      openWebCamera();
      return;
    }
    openFilePicker();
  }, [disabled, openNativeCamera, openWebCamera, openFilePicker]);

  const openScanMenu = useCallback(() => {
    if (disabled) return;
    setMenuOpen(true);
  }, [disabled]);

  const handleWebCapture = useCallback(
    (file: File) => {
      const list = new DataTransfer();
      list.items.add(file);
      onFilesSelected(list.files);
      setCameraModalOpen(false);
      resetInputs();
    },
    [onFilesSelected, resetInputs]
  );

  return {
    cameraInputRef,
    fileInputRef,
    menuOpen,
    setMenuOpen,
    cameraModalOpen,
    setCameraModalOpen,
    handleInputChange,
    openFilePicker,
    openNativeCamera,
    openWebCamera,
    openCamera,
    openScanMenu,
    handleWebCapture,
    showWebCameraOption: hasWebCamera(),
    showNativeCameraOption: prefersNativeCamera() || hasWebCamera(),
  };
}
