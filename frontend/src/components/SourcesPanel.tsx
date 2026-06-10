"use client";

import { useEffect, useState } from "react";
import { Database, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { getHealth, seedData } from "@/lib/api";
import type { SourceInfo } from "@/lib/types";

export function SourcesPanel() {
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [graphConnected, setGraphConnected] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState("");

  const load = () => {
    getHealth()
      .then((h) => {
        setSources(h.sources);
        setGraphConnected(h.graph_connected);
      })
      .catch(() => setSources([]));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMessage("");
    try {
      const res = await seedData();
      setSeedMessage(res.message);
      load();
    } catch (err) {
      setSeedMessage(err instanceof Error ? err.message : "Seed fehlgeschlagen");
    } finally {
      setSeeding(false);
    }
  };

  const statusColor = (status: string) => {
    if (status === "aktiv") return "bg-green-100 text-green-800";
    if (status === "referenz") return "bg-blue-100 text-blue-800";
    return "bg-slate-100 text-slate-600";
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="glass rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Database className="h-8 w-8 text-gold" />
            <div>
              <h2 className="font-serif text-xl font-semibold text-navy">
                Rechtsquellen & Graphiti
              </h2>
              <p className="text-sm text-slate-500">
                Daten werden als Episoden mit Provenienz in den Knowledge Graph eingespielt
              </p>
            </div>
          </div>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-navy hover:bg-gold-light disabled:opacity-50"
          >
            {seeding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Demo-Daten laden
          </button>
        </div>

        {seedMessage && (
          <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
            {seedMessage}
          </p>
        )}

        <div
          className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
            graphConnected ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${graphConnected ? "bg-green-500" : "bg-amber-500"}`}
          />
          Graphiti / FalkorDB: {graphConnected ? "Verbunden" : "Nicht verbunden"}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sources.map((src) => (
          <article
            key={src.id}
            className="glass rounded-2xl p-5 shadow-sm transition hover:shadow-md"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <h3 className="font-semibold text-navy">{src.name}</h3>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor(src.status)}`}>
                {src.status}
              </span>
            </div>
            <p className="mb-3 text-sm text-slate-600">{src.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{src.access_type}</span>
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-navy hover:text-gold"
              >
                Öffnen <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </article>
        ))}
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
        <strong>Hinweis:</strong> beck-online und juris sind lizenzpflichtige Quellen und werden als
        Referenz-Index ins Graphiti eingespielt. Die Volltext-Pipeline nutzt Open Legal Data,
        Gesetze im Internet, recht.bund.de und buzer.de.
      </div>
    </div>
  );
}
