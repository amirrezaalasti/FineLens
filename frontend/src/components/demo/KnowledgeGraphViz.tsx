"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DemoEdge, DemoGraph, DemoNode, EdgeKind, EntityKind } from "@/lib/demo-graph-data";
import { DEMO_GRAPHS, EDGE_LEGEND, ONTOLOGY_LEGEND } from "@/lib/demo-graph-data";

const KIND_GLOW: Record<EntityKind, string> = {
  LegalNorm: "rgba(201, 162, 39, 0.55)",
  Tatbestandsmerkmal: "rgba(89, 156, 231, 0.45)",
  Rechtsfolge: "rgba(63, 162, 102, 0.45)",
  LegalSubject: "rgba(167, 139, 250, 0.45)",
};

const KIND_FILL: Record<EntityKind, string> = {
  LegalNorm: "#c9a227",
  Tatbestandsmerkmal: "#1e3a5f",
  Rechtsfolge: "#0f3d2a",
  LegalSubject: "#2d2458",
};

const KIND_STROKE: Record<EntityKind, string> = {
  LegalNorm: "#e8c84a",
  Tatbestandsmerkmal: "#599ce7",
  Rechtsfolge: "#3fa266",
  LegalSubject: "#a78bfa",
};

const EDGE_COLOR: Record<EdgeKind, string> = {
  REQUIRES: "rgba(255,255,255,0.35)",
  IMPLIES: "rgba(201, 162, 39, 0.7)",
  APPLIES_TO: "rgba(167, 139, 250, 0.55)",
  REFERENCES: "rgba(135, 195, 255, 0.65)",
};

function edgePath(from: DemoNode, to: DemoNode): string {
  const fx = from.x;
  const fy = from.y;
  const tx = to.x;
  const ty = to.y;
  const mx = (fx + tx) / 2;
  const my = (fy + ty) / 2;
  const dx = tx - fx;
  const dy = ty - fy;
  const cx = mx - dy * 0.12;
  const cy = my + dx * 0.12;
  return `M ${fx} ${fy} Q ${cx} ${cy} ${tx} ${ty}`;
}

function nodeRadius(kind: EntityKind): number {
  return kind === "LegalNorm" ? 5.2 : 4.2;
}

interface KnowledgeGraphVizProps {
  autoCycle?: boolean;
}

export function KnowledgeGraphViz({ autoCycle = true }: KnowledgeGraphVizProps) {
  const [graphIdx, setGraphIdx] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);

  const graph = DEMO_GRAPHS[graphIdx];
  const nodeMap = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);

  const connected = useMemo(() => {
    if (!hovered) return null;
    const ids = new Set<string>([hovered]);
    for (const e of graph.edges) {
      if (e.from === hovered) ids.add(e.to);
      if (e.to === hovered) ids.add(e.from);
    }
    return ids;
  }, [hovered, graph.edges]);

  useEffect(() => {
    const t = setInterval(() => setPulse((p) => (p + 1) % 100), 50);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!autoCycle) return;
    const t = setInterval(() => setGraphIdx((i) => (i + 1) % DEMO_GRAPHS.length), 12000);
    return () => clearInterval(t);
  }, [autoCycle]);

  const isDimmed = useCallback(
    (id: string) => connected !== null && !connected.has(id),
    [connected]
  );

  return (
    <div className="relative">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-2xl font-semibold text-white">{graph.title}</h3>
          <p className="mt-1 text-sm text-white/50">{graph.subtitle}</p>
        </div>
        <div className="flex gap-2">
          {DEMO_GRAPHS.map((g, i) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGraphIdx(i)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                i === graphIdx
                  ? "bg-gold text-navy"
                  : "bg-white/10 text-white/70 hover:bg-white/15"
              }`}
            >
              {g.title}
            </button>
          ))}
        </div>
      </div>

      <blockquote className="mb-6 border-l-2 border-gold/60 pl-4 text-sm italic leading-relaxed text-white/75">
        {graph.statute}
        <a
          href={graph.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block text-xs not-italic text-gold-light/80 hover:text-gold-light"
        >
          {graph.sourceUrl}
        </a>
      </blockquote>

      <div className="demo-graph-frame relative overflow-hidden rounded-2xl border border-white/10 bg-[#060d18]">
        <div className="demo-graph-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="demo-graph-glow pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" aria-hidden />

        <svg
          viewBox="0 0 100 100"
          className="relative z-10 aspect-[16/10] w-full"
          role="img"
          aria-label={`Knowledge Graph: ${graph.title}`}
        >
          <defs>
            <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {graph.edges.map((edge, i) => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) return null;
            const dimmed =
              connected !== null &&
              !(connected.has(edge.from) && connected.has(edge.to));
            const d = edgePath(from, to);
            return (
              <g key={`${edge.from}-${edge.to}-${i}`} opacity={dimmed ? 0.12 : 1}>
                <path
                  d={d}
                  fill="none"
                  stroke={EDGE_COLOR[edge.kind]}
                  strokeWidth={edge.kind === "REFERENCES" ? 0.35 : 0.45}
                  strokeDasharray={edge.kind === "REFERENCES" ? "1.2 0.8" : undefined}
                  className="demo-edge-base"
                />
                <path
                  d={d}
                  fill="none"
                  stroke={EDGE_COLOR[edge.kind]}
                  strokeWidth={0.9}
                  strokeDasharray="2 98"
                  strokeDashoffset={-pulse * 0.4}
                  opacity={0.85}
                  className="demo-edge-pulse"
                />
              </g>
            );
          })}

          {graph.nodes.map((node) => {
            const r = nodeRadius(node.kind);
            const dim = isDimmed(node.id);
            const active = hovered === node.id;
            const lines = wrapLabel(node.label, node.kind === "LegalNorm" ? 14 : 18);
            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                opacity={dim ? 0.2 : 1}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-pointer transition-opacity duration-200"
              >
                {active && (
                  <circle
                    r={r + 3}
                    fill="none"
                    stroke={KIND_STROKE[node.kind]}
                    strokeWidth={0.4}
                    opacity={0.6}
                    className="demo-node-ring"
                  />
                )}
                <circle
                  r={r + 1.5}
                  fill={KIND_GLOW[node.kind]}
                  className="demo-node-halo"
                />
                <circle
                  r={r}
                  fill={KIND_FILL[node.kind]}
                  stroke={KIND_STROKE[node.kind]}
                  strokeWidth={node.kind === "LegalNorm" ? 0.5 : 0.35}
                  filter="url(#nodeGlow)"
                />
                <text
                  y={r + 3.8}
                  textAnchor="middle"
                  fill={active ? "#fff" : "rgba(255,255,255,0.82)"}
                  fontSize={node.kind === "LegalNorm" ? 2.4 : 2.1}
                  fontWeight={node.kind === "LegalNorm" ? 600 : 400}
                  className="select-none"
                >
                  {lines.map((line, idx) => (
                    <tspan key={idx} x={0} dy={idx === 0 ? 0 : 2.6}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
        </svg>

        {hovered && (
          <div className="absolute bottom-4 left-4 z-20 rounded-lg border border-white/10 bg-navy/90 px-3 py-2 text-xs text-white/80 backdrop-blur-sm">
            {(() => {
              const n = nodeMap.get(hovered);
              if (!n) return null;
              const edges = graph.edges.filter((e) => e.from === hovered || e.to === hovered);
              return (
                <>
                  <span className="font-semibold text-gold-light">{n.label}</span>
                  <span className="text-white/40"> · {n.kind}</span>
                  {edges.length > 0 && (
                    <div className="mt-1 text-white/50">
                      {edges.length} Verknüpfung{edges.length > 1 ? "en" : ""}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
        {ONTOLOGY_LEGEND.map((item) => (
          <div key={item.kind} className="flex items-center gap-2 text-xs text-white/60">
            <span
              className="h-2.5 w-2.5 rounded-full ring-1 ring-white/20"
              style={{ background: item.color }}
            />
            <span>{item.desc}</span>
          </div>
        ))}
        <span className="hidden text-white/20 sm:inline">|</span>
        {EDGE_LEGEND.map((item) => (
          <div key={item.kind} className="flex items-center gap-2 text-xs text-white/50">
            <span
              className="h-px w-4"
              style={{
                background: EDGE_COLOR[item.kind],
                borderTop: item.dash ? "1px dashed rgba(255,255,255,0.4)" : undefined,
              }}
            />
            <span>{item.kind}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function wrapLabel(text: string, max: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= max) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}
