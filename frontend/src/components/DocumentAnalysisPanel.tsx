"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  FileImage,
  File,
  Copy,
  Check,
  Info,
  Shield,
  Eye,
  List,
  Layers,
  EyeOff,
  Lock,
  Unlock,
  Edit2,
  X,
  Download,
} from "lucide-react";
import type { Attachment, ExtractedField } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface DocumentAnalysisPanelProps {
  attachment: Attachment | null;
  fileObj?: File | null;
  onClose?: () => void;
  onUpdateAnalysis?: (fields: ExtractedField[]) => void;
  onReleaseAttachment?: () => void;
}

export function DocumentAnalysisPanel({
  attachment,
  fileObj,
  onClose,
  onUpdateAnalysis,
  onReleaseAttachment,
}: DocumentAnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "redact_data" | "text">("redact_data");
  const [copied, setCopied] = useState(false);
  const [hoveredFieldIdx, setHoveredFieldIdx] = useState<number | null>(null);

  const [localFields, setLocalFields] = useState<ExtractedField[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const [showPreview, setShowPreview] = useState(true);
  const [showTable, setShowTable] = useState(true);
  const [textViewMode, setTextViewMode] = useState<"original" | "redacted">("redacted");

  useEffect(() => {
    if (attachment?.analysis?.fields) {
      setLocalFields(attachment.analysis.fields);
    } else {
      setLocalFields([]);
    }
    setEditingIdx(null);
  }, [attachment]);

  const handleToggleRedaction = (idx: number) => {
    if (!attachment?.isPending) return;
    const updated = localFields.map((f, i) =>
      i === idx ? { ...f, is_pii: !f.is_pii } : f
    );
    setLocalFields(updated);
    if (onUpdateAnalysis) {
      onUpdateAnalysis(updated);
    }
  };

  const handleStartEdit = (idx: number, currentVal: string) => {
    if (!attachment?.isPending) return;
    setEditingIdx(idx);
    setEditValue(currentVal);
  };

  const handleSaveEdit = (idx: number) => {
    if (!attachment?.isPending) return;
    const updated = localFields.map((f, i) =>
      i === idx ? { ...f, value: editValue } : f
    );
    setLocalFields(updated);
    setEditingIdx(null);
    if (onUpdateAnalysis) {
      onUpdateAnalysis(updated);
    }
  };

  const handleCancelEdit = () => {
    setEditingIdx(null);
  };

  const handleWordClick = (text: string, box: number[]) => {
    if (!attachment?.isPending) return;
    const clickPage = box[4] ?? 0;

    const findFieldIndex = () => {
      return localFields.findIndex((f) => {
        if (!f.box) return false;
        if ((f.page ?? 0) !== clickPage) return false;
        const boxes: number[][] = Array.isArray(f.box[0])
          ? (f.box as number[][])
          : [f.box as number[]];
        return boxes.some(
          (b) => Math.abs(b[0] - box[0]) < 0.1 && Math.abs(b[1] - box[1]) < 0.1
        );
      });
    };

    const fieldIdx = findFieldIndex();
    let updated: ExtractedField[];

    if (fieldIdx !== -1) {
      const field = localFields[fieldIdx];
      if (field.field_name === "Manuelle Schwärzung") {
        updated = localFields.filter((_, i) => i !== fieldIdx);
      } else {
        updated = localFields.map((f, i) =>
          i === fieldIdx ? { ...f, is_pii: !f.is_pii } : f
        );
      }
    } else {
      const newField: ExtractedField = {
        field_name: "Manuelle Schwärzung",
        value: text,
        box: box.slice(0, 4),
        is_pii: true,
        confidence: 1.0,
        page: clickPage,
      };
      updated = [...localFields, newField];
    }

    setLocalFields(updated);
    if (onUpdateAnalysis) {
      onUpdateAnalysis(updated);
    }
  };

  const handleDownloadRedacted = async () => {
    if (!attachment) return;
    try {
      const redactions: number[][] = [];
      localFields.forEach((f) => {
        if (f.is_pii && f.box) {
          const p = f.page ?? 0;
          if (Array.isArray(f.box[0])) {
            const list = f.box as number[][];
            list.forEach((boxCoords) => {
              redactions.push([...boxCoords, p]);
            });
          } else {
            redactions.push([...(f.box as number[]), p]);
          }
        }
      });

      const formData = new FormData();
      if (fileObj) {
        formData.append("file", fileObj);
        formData.append("filename", fileObj.name);
      } else {
        formData.append("filename", attachment.name);
      }
      formData.append("redactions_json", JSON.stringify(redactions));

      const response = await fetch(`${API_BASE}/chat/redact`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const nameParts = attachment.name.split(".");
      if (nameParts.length > 1) {
        nameParts.pop(); // Remove extension
      }
      const baseName = nameParts.join(".");
      link.download = `geschwaerzt_${baseName || "dokument"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download redacted file:", err);
      alert(
        "Fehler beim Herunterladen der geschwärzten Datei: " +
          (err instanceof Error ? err.message : String(err))
      );
    }
  };

  if (!attachment) {
    return (
      <aside className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
        <div className="border-b border-ink/10 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-pink" />
            <h2 className="font-semibold text-ink">Dokumenten-Analyse</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Intelligente Textextraktion und Strukturierung
          </p>
        </div>
        <div className="min-h-0 flex-1 flex flex-col items-center justify-center p-6 text-center text-sm text-slate-500">
          <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300 animate-pulse" />
          <p className="font-medium text-ink">Kein Dokument ausgewählt</p>
          <p className="mt-1 text-xs text-slate-400 max-w-[240px]">
            Laden Sie ein Dokument (PDF oder Bild) hoch, um Schlüsselinformationen automatisch hervorzuheben.
          </p>
        </div>
      </aside>
    );
  }

  const analysis = attachment.analysis;
  const fields = localFields;
  const rawText = analysis?.raw_text || attachment.content || "";
  const previewImage = analysis?.preview_image_url;
  const previewImages =
    analysis?.preview_image_urls && analysis.preview_image_urls.length > 0
      ? analysis.preview_image_urls
      : previewImage
      ? [previewImage]
      : [];

  const handleCopyText = () => {
    const textToCopy = textViewMode === "original" ? rawText : attachment.content || "";
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
      {/* Panel Header */}
      <div className="border-b border-ink/10 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {attachment.file_type.startsWith("image/") ? (
              <FileImage className="h-4 w-4 text-pink shrink-0" />
            ) : attachment.file_type === "application/pdf" ? (
              <FileText className="h-4 w-4 text-pink shrink-0" />
            ) : (
              <File className="h-4 w-4 text-pink shrink-0" />
            )}
            <h2 className="font-semibold text-ink truncate" title={attachment.name}>
              {attachment.name}
            </h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-ink px-1.5 py-0.5 rounded hover:bg-ink/5 cursor-pointer"
            >
              Schließen
            </button>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-slate-400 truncate">
          Typ: {attachment.file_type}
        </p>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-ink/10 bg-ink/5 p-1 shrink-0">
        <button
          onClick={() => setActiveTab("redact_data")}
          className={`flex-[1.4] flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === "redact_data"
              ? "bg-white text-ink shadow-sm"
              : "text-slate-500 hover:text-ink hover:bg-white/40"
          }`}
        >
          <EyeOff className="h-3.5 w-3.5" />
          Schwärzung & Daten
        </button>
        <button
          onClick={() => setActiveTab("preview")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
            activeTab === "preview"
              ? "bg-white text-ink shadow-sm"
              : "text-slate-500 hover:text-ink hover:bg-white/40"
          }`}
        >
          <Eye className="h-3.5 w-3.5" />
          Vorschau
        </button>
        <button
          onClick={() => setActiveTab("text")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
            activeTab === "text"
              ? "bg-white text-ink shadow-sm"
              : "text-slate-500 hover:text-ink hover:bg-white/40"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Volltext
        </button>
      </div>

      {/* Tab Contents */}
      <div className="min-h-0 flex-1 flex flex-col p-4 overflow-hidden">
        {activeTab === "preview" && (
          <div className="space-y-3 h-full flex flex-col min-h-0">
            {previewImages.length > 0 ? (
              <div className="relative flex-1 min-h-0 flex flex-col gap-4 items-center justify-start bg-slate-900/5 rounded-xl border border-ink/10 p-4 overflow-y-auto overflow-x-hidden">
                {previewImages.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="relative w-full max-w-[500px] shadow-md rounded-lg overflow-hidden shrink-0 border border-ink/10"
                  >
                    <img
                      src={imgUrl}
                      alt={`Dokument Vorschau Seite ${idx + 1}`}
                      className="w-full h-auto block pointer-events-none select-none"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-ink/15 rounded-xl text-slate-500">
                <Info className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-ink">Keine visuelle Vorschau verfügbar</p>
                <p className="text-[11px] text-slate-400 max-w-[200px] mt-0.5">
                  Für reine Textdokumente steht keine Vorschau zur Verfügung.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "redact_data" && (
          <div className="flex flex-col h-full min-h-0 overflow-hidden">
            {/* Control Bar for visibility toggles & download button */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 pb-3 mb-3 shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                    showPreview
                      ? "bg-ink/5 text-ink border-ink/20"
                      : "bg-white text-slate-400 border-slate-200 hover:text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Vorschau {showPreview ? "ausblenden" : "einblenden"}
                </button>
                <button
                  onClick={() => setShowTable(!showTable)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                    showTable
                      ? "bg-ink/5 text-ink border-ink/20"
                      : "bg-white text-slate-400 border-slate-200 hover:text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  Tabelle {showTable ? "ausblenden" : "einblenden"}
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {!attachment.isPending && (
                  <button
                    onClick={handleDownloadRedacted}
                    className="flex items-center gap-1.5 bg-ink text-white hover:bg-ink/80 font-bold rounded-lg px-3 py-1.5 text-xs transition cursor-pointer shadow-sm"
                    title="Herunterladen des geschwärzten Dokuments (PDF)"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download PDF
                  </button>
                )}

                {attachment.isPending ? (
                  <button
                    onClick={onReleaseAttachment}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg px-3 py-1.5 text-xs transition cursor-pointer shadow-sm animate-pulse"
                    title="Wendet die Schwärzungen an und gibt das Dokument zur Analyse frei."
                  >
                    <Check className="h-3.5 w-3.5" />
                    Schwärzungen anwenden & freigeben
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 text-xs font-semibold select-none">
                    <Check className="h-3.5 w-3.5" />
                    Dokument freigegeben
                  </div>
                )}
              </div>
            </div>

            {/* Split layout content area */}
            <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 overflow-hidden">
              {/* Left/Top Part: Redacted Preview */}
              {showPreview && (
                previewImages.length > 0 ? (
                  <div
                    className={`min-h-[250px] md:min-h-0 relative flex flex-col gap-4 items-center justify-start bg-slate-900/5 rounded-xl border border-ink/10 p-3 overflow-y-auto overflow-x-hidden ${
                      showTable ? "flex-1 md:w-1/2" : "w-full flex-1"
                    }`}
                  >
                    {previewImages.map((imgUrl, pageIdx) => (
                      <div
                        key={pageIdx}
                        className="relative w-full max-w-[500px] shadow-md rounded-lg overflow-hidden shrink-0 border border-ink/10"
                      >
                        <img
                          src={imgUrl}
                          alt={`Geschwärztes Dokument Seite ${pageIdx + 1}`}
                          className="w-full h-auto block pointer-events-none select-none"
                        />
                        {/* Invisible interactive text selection / click-to-redact overlay */}
                        {attachment.isPending &&
                          analysis?.word_boxes
                            ?.filter((wb) => (wb.page ?? 0) === pageIdx)
                            ?.map((wb, wIdx) => {
                              const [top, left, width, height] = wb.box;
                              return (
                                <button
                                  key={`word-${pageIdx}-${wIdx}`}
                                  onClick={() =>
                                    handleWordClick(wb.text, [...wb.box, pageIdx])
                                  }
                                  className="absolute text-transparent hover:bg-pink/25 select-none cursor-pointer z-20 border border-transparent hover:border-pink/40 rounded-[1px] transition-all duration-75 focus:outline-none"
                                  style={{
                                    top: `${top}%`,
                                    left: `${left}%`,
                                    width: `${width}%`,
                                    height: `${height}%`,
                                  }}
                                  title={`Klicken zum Schwärzen: "${wb.text}"`}
                                />
                              );
                            })}

                        {/* Static solid black redaction box overlays for PII */}
                        {fields
                          .filter((field) => (field.page ?? 0) === pageIdx)
                          .map((field, idx) => {
                            if (!field.is_pii || !field.box) return null;

                            // Normalize to a list of boxes (can be [top, left, width, height] or [[top, left, width, height], ...])
                            const boxes: number[][] = Array.isArray(field.box[0])
                              ? (field.box as number[][])
                              : [field.box as number[]];

                            return boxes.map((boxCoords, boxIdx) => {
                              if (boxCoords.length !== 4) return null;
                              const [top, left, width, height] = boxCoords;
                              return (
                                <div
                                  key={`${idx}-${boxIdx}`}
                                  className="absolute bg-black select-none pointer-events-none rounded-[1px] shadow-[0_0_1px_rgba(0,0,0,0.8)] z-10"
                                  style={{
                                    top: `${top}%`,
                                    left: `${left}%`,
                                    width: `${width}%`,
                                    height: `${height}%`,
                                  }}
                                  title="Geschwärzte personenbezogene Daten"
                                />
                              );
                            });
                          })}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className={`flex flex-col items-center justify-center text-center p-4 border border-dashed border-ink/15 rounded-xl text-slate-500 min-h-[150px] md:min-h-0 ${
                      showTable ? "flex-1 md:w-1/2" : "w-full flex-1"
                    }`}
                  >
                    <Info className="h-6 w-6 text-slate-300 mb-1" />
                    <p className="text-xs font-semibold text-ink">Keine visuelle Vorschau verfügbar</p>
                  </div>
                )
              )}

              {/* Right/Bottom Part: Schlüsseldaten Table */}
              {showTable && (
                <div
                  className={`min-h-0 flex flex-col gap-3 ${
                    showPreview ? "flex-1 md:w-1/2" : "w-full flex-1"
                  }`}
                >
                  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                    {fields.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs">
                        Keine strukturierten Daten extrahiert.
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-ink/8 bg-white shadow-sm">
                        <table className="w-full text-left border-collapse text-xs table-fixed">
                          <thead>
                            <tr className="bg-ink/5 border-b border-ink/10 text-ink font-semibold">
                              <th className="px-3 py-2 w-[40%]">Feld</th>
                              <th className="px-3 py-2 w-[60%]">Wert</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fields.map((field, idx) => {
                              const isHovered = hoveredFieldIdx === idx;
                              const isEditing = editingIdx === idx;
                              return (
                                <tr
                                  key={idx}
                                  onMouseEnter={() => setHoveredFieldIdx(idx)}
                                  onMouseLeave={() => setHoveredFieldIdx(null)}
                                  className={`border-b border-ink/5 transition-all duration-150 ${
                                    isHovered
                                      ? "bg-pink/10 font-medium text-ink"
                                      : "hover:bg-slate-50 text-slate-700"
                                  }`}
                                >
                                  <td className="px-3 py-2.5 font-medium text-ink/95 min-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleRedaction(idx)}
                                        disabled={!attachment.isPending}
                                        className={`p-1 rounded shrink-0 transition ${
                                          attachment.isPending
                                            ? "cursor-pointer hover:bg-ink/10"
                                            : "cursor-default opacity-60"
                                        } ${
                                          field.is_pii
                                            ? "text-pink bg-pink/5"
                                            : "text-slate-300 hover:text-ink"
                                        }`}
                                        title={
                                          !attachment.isPending
                                            ? field.is_pii
                                              ? "Dauerhaft geschwärzt"
                                              : "Nicht geschwärzt"
                                            : field.is_pii
                                            ? "Schwärzung aufheben"
                                            : "Feld schwärzen"
                                        }
                                      >
                                        {field.is_pii ? (
                                          <Lock className="h-3.5 w-3.5 fill-pink/10" />
                                        ) : (
                                          <Unlock className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                      <span
                                        className="break-words min-w-0 flex-1 text-ink"
                                        title={field.field_name}
                                      >
                                        {field.field_name}
                                      </span>
                                      {field.is_pii && (
                                        <span
                                          className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider select-none shrink-0 ${
                                            field.field_name === "Manuelle Schwärzung"
                                              ? "bg-pink text-white"
                                              : "bg-black text-white"
                                          }`}
                                          title={
                                            field.field_name === "Manuelle Schwärzung"
                                              ? "Manuell geschwärzt"
                                              : "Personenbezogene Daten (geschwärzt)"
                                          }
                                        >
                                          {field.field_name === "Manuelle Schwärzung"
                                            ? "Manuell"
                                            : "DSGVO"}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 font-mono break-words whitespace-pre-wrap">
                                    {isEditing ? (
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="text"
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") handleSaveEdit(idx);
                                            if (e.key === "Escape") handleCancelEdit();
                                          }}
                                          className="w-full bg-white border border-ink/30 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-pink font-mono text-ink"
                                          autoFocus
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleSaveEdit(idx)}
                                          className="p-1 text-green-600 hover:bg-green-50 rounded cursor-pointer shrink-0"
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={handleCancelEdit}
                                          className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer shrink-0"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex justify-between items-start group gap-2 min-w-0">
                                        <div className="min-w-0 break-words whitespace-pre-wrap flex-1">
                                          {field.is_pii ? (
                                            attachment.isPending ? (
                                              <span
                                                className="bg-slate-900 text-transparent select-none px-1 rounded hover:text-slate-800 hover:bg-ink/5 cursor-pointer transition duration-150 font-semibold"
                                                title="Klicken/Hovern zum Aufdecken"
                                              >
                                                {field.value}
                                              </span>
                                            ) : (
                                              <span
                                                className="bg-black text-white px-1.5 py-0.5 rounded font-mono select-none"
                                                title="Dauerhaft geschwärzt"
                                              >
                                                █████
                                              </span>
                                            )
                                          ) : (
                                            <span className="text-slate-700">{field.value}</span>
                                          )}
                                        </div>
                                        {attachment.isPending && (
                                          field.field_name === "Manuelle Schwärzung" ? (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const updated = localFields.filter((_, i) => i !== idx);
                                                setLocalFields(updated);
                                                if (onUpdateAnalysis) onUpdateAnalysis(updated);
                                              }}
                                              className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 cursor-pointer transition shrink-0"
                                              title="Manuelle Schwärzung löschen"
                                            >
                                              <X className="h-3 w-3" />
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => handleStartEdit(idx, field.value)}
                                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-ink/5 text-slate-400 hover:text-ink cursor-pointer transition shrink-0"
                                              title="Wert bearbeiten"
                                            >
                                              <Edit2 className="h-3 w-3" />
                                            </button>
                                          )
                                        )}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Redaction Info Label */}
                  {previewImage && (
                    <div className="rounded-lg bg-ink/5 border border-ink/10 p-2.5 text-[11px] text-ink/90 flex items-start gap-2 shrink-0 animate-fade-in">
                      <Lock className="h-3.5 w-3.5 text-ink shrink-0 mt-0.5" />
                      <span>
                        {attachment.isPending ? (
                          "Klicken Sie auf das Schloss-Symbol in der Tabelle, um Textstellen auf dem Dokument live zu schwärzen oder freizugeben. Sie können auch direkt Wörter in der Vorschau anklicken."
                        ) : (
                          "Dieses Dokument ist freigegeben. Die Schwärzungen sind dauerhaft angewendet und können nicht mehr geändert werden."
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Both Hidden Placeholder */}
              {!showPreview && !showTable && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-ink/15 rounded-xl text-slate-500">
                  <Info className="h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-ink">Vorschau und Tabelle ausgeblendet</p>
                  <p className="text-[11px] text-slate-400 max-w-[240px] mt-0.5">
                    Bitte aktivieren Sie mindestens eine Ansicht (Vorschau oder Tabelle) in der Steuerleiste oben.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "text" && (
          <div className="relative h-full flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
              <div className="flex bg-ink/5 p-0.5 rounded-lg border border-ink/10">
                <button
                  type="button"
                  onClick={() => setTextViewMode("original")}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                    textViewMode === "original"
                      ? "bg-white text-ink shadow-sm"
                      : "text-slate-500 hover:text-ink hover:bg-white/40"
                  }`}
                >
                  Originaler Text
                </button>
                <button
                  type="button"
                  onClick={() => setTextViewMode("redacted")}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                    textViewMode === "redacted"
                      ? "bg-white text-ink shadow-sm"
                      : "text-slate-500 hover:text-ink hover:bg-white/40"
                  }`}
                >
                  Modell-Sicht (Geschwärzt)
                </button>
              </div>
              <button
                type="button"
                onClick={handleCopyText}
                className="flex items-center gap-1 bg-white hover:bg-slate-100 border border-ink/10 rounded-lg px-2 py-1 text-[11px] font-medium text-ink transition cursor-pointer shadow-sm"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-green-600" />
                    Kopiert
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Text kopieren
                  </>
                )}
              </button>
            </div>
            <pre className="flex-1 w-full bg-slate-50 border border-ink/10 rounded-xl p-4 text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed select-text overflow-auto">
              {textViewMode === "original" ? rawText : attachment.content || ""}
            </pre>
          </div>
        )}
      </div>
    </aside>
  );
}
