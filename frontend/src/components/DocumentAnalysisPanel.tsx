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
} from "lucide-react";
import type { Attachment, ExtractedField } from "@/lib/types";

interface DocumentAnalysisPanelProps {
  attachment: Attachment | null;
  onClose?: () => void;
  onUpdateAnalysis?: (fields: ExtractedField[]) => void;
}

export function DocumentAnalysisPanel({ attachment, onClose, onUpdateAnalysis }: DocumentAnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "redact_data" | "text">("redact_data");
  const [copied, setCopied] = useState(false);
  const [hoveredFieldIdx, setHoveredFieldIdx] = useState<number | null>(null);

  const [localFields, setLocalFields] = useState<ExtractedField[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    if (attachment?.analysis?.fields) {
      setLocalFields(attachment.analysis.fields);
    } else {
      setLocalFields([]);
    }
    setEditingIdx(null);
  }, [attachment]);

  const handleToggleRedaction = (idx: number) => {
    const updated = localFields.map((f, i) =>
      i === idx ? { ...f, is_pii: !f.is_pii } : f
    );
    setLocalFields(updated);
    if (onUpdateAnalysis) {
      onUpdateAnalysis(updated);
    }
  };

  const handleStartEdit = (idx: number, currentVal: string) => {
    setEditingIdx(idx);
    setEditValue(currentVal);
  };

  const handleSaveEdit = (idx: number) => {
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

  if (!attachment) {
    return (
      <aside className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
        <div className="border-b border-ink/10 px-4 py-3">
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

  const handleCopyText = () => {
    navigator.clipboard.writeText(rawText);
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
            {previewImage ? (
              <div className="relative flex-1 min-h-0 flex flex-col items-center justify-start bg-slate-900/5 rounded-xl border border-ink/10 p-4 overflow-y-auto overflow-x-hidden">
                <div className="relative w-full max-w-full shadow-md rounded-lg overflow-hidden shrink-0">
                  <img
                    src={previewImage}
                    alt="Dokument Vorschau"
                    className="w-full h-auto block pointer-events-none select-none"
                  />
                </div>
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
          <div className="space-y-4 h-full flex flex-col min-h-0">
            {/* Top Part: Redacted Preview */}
            {previewImage ? (
              <div className="relative h-[260px] sm:h-[300px] shrink-0 flex flex-col items-center justify-start bg-slate-900/5 rounded-xl border border-ink/10 p-3 overflow-y-auto overflow-x-hidden">
                <div className="relative w-full max-w-full shadow-md rounded-lg overflow-hidden shrink-0">
                  <img
                    src={previewImage}
                    alt="Geschwärztes Dokument"
                    className="w-full h-auto block pointer-events-none select-none"
                  />
                  {/* Static solid black redaction box overlays for PII */}
                  {fields.map((field, idx) => {
                    if (!field.is_pii || !field.box || field.box.length !== 4) return null;
                    const [top, left, width, height] = field.box;
                    return (
                      <div
                        key={idx}
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
                  })}
                </div>
              </div>
            ) : (
              <div className="h-[120px] flex flex-col items-center justify-center text-center p-4 border border-dashed border-ink/15 rounded-xl text-slate-500 shrink-0">
                <Info className="h-6 w-6 text-slate-300 mb-1" />
                <p className="text-xs font-semibold text-ink">Keine visuelle Vorschau verfügbar</p>
              </div>
            )}

            {/* Bottom Part: Schlüsseldaten */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {fields.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Keine strukturierten Daten extrahiert.
                </div>
              ) : (
                <>
                  {/* Mobile: card layout */}
                  <div className="space-y-2 lg:hidden">
                    {fields.map((field, idx) => {
                      const isEditing = editingIdx === idx;
                      return (
                        <div
                          key={idx}
                          className="rounded-xl border border-ink/8 bg-white p-3 shadow-sm"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleRedaction(idx)}
                                className={`shrink-0 rounded p-1.5 transition touch-manipulation ${
                                  field.is_pii ? "text-pink bg-pink/5" : "text-slate-300 active:text-ink"
                                }`}
                                title={field.is_pii ? "Schwärzung aufheben" : "Feld schwärzen"}
                              >
                                {field.is_pii ? (
                                  <Lock className="h-4 w-4 fill-pink/10" />
                                ) : (
                                  <Unlock className="h-4 w-4" />
                                )}
                              </button>
                              <span className="truncate text-xs font-semibold text-ink">{field.field_name}</span>
                              {field.is_pii && (
                                <span className="shrink-0 rounded bg-black px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                                  DSGVO
                                </span>
                              )}
                            </div>
                            <span className="shrink-0 text-[10px] font-semibold text-slate-500">
                              {Math.round(field.confidence * 100)}%
                            </span>
                          </div>
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
                                className="min-w-0 flex-1 rounded border border-ink/30 px-2 py-1.5 text-xs font-mono text-ink focus:border-pink focus:outline-none"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(idx)}
                                className="rounded p-2 text-green-600 active:bg-green-50 touch-manipulation"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="rounded p-2 text-red-500 active:bg-red-50 touch-manipulation"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-2">
                              {field.is_pii ? (
                                <span className="rounded bg-slate-900 px-1.5 py-0.5 text-xs text-transparent select-none">
                                  {field.value}
                                </span>
                              ) : (
                                <span className="break-all text-xs font-mono text-slate-700">{field.value}</span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleStartEdit(idx, field.value)}
                                className="shrink-0 rounded p-2 text-slate-400 active:bg-ink/5 active:text-ink touch-manipulation"
                                title="Wert bearbeiten"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop: table layout */}
                  <div className="hidden overflow-hidden rounded-xl border border-ink/8 bg-white shadow-sm lg:block">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-ink/5 border-b border-ink/10 text-ink font-semibold">
                        <th className="px-3 py-2">Feld</th>
                        <th className="px-3 py-2">Wert</th>
                        <th className="px-3 py-2 text-right">Konfidenz</th>
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
                              isHovered ? "bg-pink/10 font-medium text-ink" : "hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <td className="px-3 py-2.5 font-medium text-ink/95">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleToggleRedaction(idx)}
                                  className={`p-1 rounded hover:bg-ink/10 cursor-pointer transition shrink-0 ${
                                    field.is_pii ? "text-pink bg-pink/5" : "text-slate-300 hover:text-ink"
                                  }`}
                                  title={field.is_pii ? "Schwärzung aufheben" : "Feld schwärzen"}
                                >
                                  {field.is_pii ? (
                                    <Lock className="h-3.5 w-3.5 fill-pink/10" />
                                  ) : (
                                    <Unlock className="h-3.5 w-3.5" />
                                  )}
                                </button>
                                <span>{field.field_name}</span>
                                {field.is_pii && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black text-white text-[9px] font-bold uppercase tracking-wider select-none shrink-0" title="Personenbezogene Daten (geschwärzt)">
                                    DSGVO
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 font-mono break-all max-w-[180px]">
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
                                    onClick={() => handleSaveEdit(idx)}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded cursor-pointer shrink-0"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer shrink-0"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between group gap-2">
                                  {field.is_pii ? (
                                    <span className="bg-slate-900 text-transparent select-none px-1 rounded hover:text-slate-800 hover:bg-ink/5 cursor-pointer transition duration-150 font-semibold" title="Klicken/Hovern zum Aufdecken">
                                      {field.value}
                                    </span>
                                  ) : (
                                    <span>{field.value}</span>
                                  )}
                                  <button
                                    onClick={() => handleStartEdit(idx, field.value)}
                                    className="rounded p-0.5 opacity-100 transition hover:bg-ink/5 hover:text-ink active:bg-ink/10 lg:opacity-0 lg:group-hover:opacity-100"
                                    title="Wert bearbeiten"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right shrink-0">
                              <div className="flex items-center justify-end gap-1.5">
                                <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden hidden sm:block">
                                  <div
                                    className={`h-full rounded-full ${
                                      field.confidence > 0.8
                                        ? "bg-green-500"
                                        : field.confidence > 0.5
                                        ? "bg-amber-500"
                                        : "bg-red-500"
                                    }`}
                                    style={{ width: `${field.confidence * 100}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-semibold text-slate-500">
                                  {Math.round(field.confidence * 100)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </>
              )}
            </div>

            {/* Redaction Info Label */}
            {previewImage && (
              <div className="rounded-lg bg-ink/5 border border-ink/10 p-2.5 text-[11px] text-ink/90 flex items-start gap-2 shrink-0">
                <Lock className="h-3.5 w-3.5 text-ink shrink-0 mt-0.5" />
                <span>
                  Klicken Sie auf das Schloss-Symbol in der Tabelle, um Textstellen auf dem Dokument oben live zu schwärzen oder freizugeben.
                </span>
              </div>
            )}
          </div>
        )}

        {activeTab === "text" && (
          <div className="relative h-full flex flex-col">
            <div className="absolute right-2 top-2 z-10">
              <button
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
                    <Copy className="h-3 w-3" />
                    Text kopieren
                  </>
                )}
              </button>
            </div>
            <pre className="flex-1 w-full bg-slate-50 border border-ink/10 rounded-xl p-4 text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed select-text overflow-auto">
              {rawText}
            </pre>
          </div>
        )}
      </div>
    </aside>
  );
}
