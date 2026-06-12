"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Scale,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { KnowledgeGraphViz } from "@/components/demo/KnowledgeGraphViz";
import { PipelineFlow } from "@/components/demo/PipelineFlow";

const FEATURES = [
  {
    icon: GitBranch,
    title: "Struktur statt Chunks",
    body: "Normen werden in Tatbestandsmerkmale und Rechtsfolgen zerlegt — wie Juristen Gesetze lesen.",
  },
  {
    icon: Shield,
    title: "Vollständig nachvollziehbar",
    body: "Jede Episode trägt Quelle, Titel, §-Referenz und URL. Antworten zitieren zurück zur Primärquelle.",
  },
  {
    icon: Zap,
    title: "Multi-Hop Retrieval",
    body: "REFERENCES-Kanten erfassen Verweisungsstil — z. B. § 558 → §§ 559–560 für komplexe Fragen.",
  },
  {
    icon: CheckCircle2,
    title: "Produkt-ready",
    body: "Mietwiderspruch, DSGVO-Auskunft und mehr — Formulare an echte Normen im Graph gekoppelt.",
  },
];

const CORPUS = [
  { domain: "Eigentum", refs: "§§ 903, 985, 986" },
  { domain: "Tierbesitz", refs: "§§ 958–964" },
  { domain: "Deliktsrecht", refs: "§§ 823, 826, 831" },
  { domain: "Bereicherung", refs: "§§ 812, 816, 818" },
  { domain: "Mietrecht", refs: "§§ 535, 558, 559" },
  { domain: "DSGVO", refs: "Art. 15, 17, 77" },
];

export default function DemoPage() {
  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-cream">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-navy/10 bg-navy/95 text-white backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Link href="/demo" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/20 ring-1 ring-gold/40">
              <Scale className="h-4 w-4 text-gold-light" />
            </div>
            <span className="font-serif text-lg font-semibold">
              Fine<span className="text-gold-light">Lens</span>
            </span>
            <span className="hidden rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-light sm:inline">
              Demo
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <a
              href="#pipeline"
              className="hidden text-sm text-white/60 hover:text-white sm:inline"
            >
              Pipeline
            </a>
            <a
              href="#graph"
              className="hidden text-sm text-white/60 hover:text-white sm:inline"
            >
              Knowledge Graph
            </a>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-navy transition hover:bg-gold-light"
            >
              App öffnen
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden bg-navy px-5 pb-20 pt-16 text-white sm:pb-28 sm:pt-24">
        <div className="demo-hero-mesh pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl">
          <div className="demo-fade-in max-w-3xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gold-light">
              <Sparkles className="h-3.5 w-3.5" />
              Graph-Enhanced Legal Intelligence
            </p>
            <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Gesetze werden zu einem{" "}
              <span className="text-gold-light">Knowledge Graph</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/65">
              FineLens extrahiert aus deutschen Rechtstexten Normen, Tatbestandsmerkmale,
              Rechtsfolgen und Rechtsobjekte — und durchsucht sie hybrid für nachvollziehbare
              Antworten mit Quellennachweis.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#graph"
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-navy transition hover:bg-gold-light"
              >
                Graph erkunden
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#pipeline"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Pipeline ansehen
              </a>
            </div>
          </div>

          {/* Mini stats */}
          <div className="demo-fade-in-delay mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { value: "4", label: "Entitätstypen" },
              { value: "4", label: "Kantentypen" },
              { value: "6", label: "Rechtsdomänen" },
              { value: "100%", label: "Quellenbeleg" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm"
              >
                <div className="font-serif text-2xl font-semibold text-gold-light">
                  {stat.value}
                </div>
                <div className="text-xs text-white/50">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Pipeline */}
      <section id="pipeline" className="px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-gold">Pipeline</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold text-navy sm:text-4xl">
              Vom Gesetzestext zur belegten Antwort
            </h2>
            <p className="mt-3 text-navy/60">
              Sechs Schritte — jeder mit Provenance. Kein Black-Box-RAG, sondern ein
              nachvollziehbarer Graph-Workflow.
            </p>
          </div>
          <PipelineFlow />

          {/* Architecture strip */}
          <div className="mt-12 overflow-x-auto rounded-2xl border border-navy/10 bg-white p-6">
            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-navy/40">
              Architektur
            </p>
            <div className="flex min-w-[640px] items-center justify-between gap-2 font-mono text-xs text-navy/70">
              {[
                "Next.js UI",
                "FastAPI",
                "Graphiti",
                "FalkorDB",
                "Open Legal Data",
                "buzer.de",
              ].map((node, i, arr) => (
                <div key={node} className="flex items-center gap-2">
                  <span className="rounded-lg border border-navy/15 bg-cream px-3 py-2 font-sans text-xs font-medium text-navy">
                    {node}
                  </span>
                  {i < arr.length - 1 && (
                    <span className="text-navy/25">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Knowledge Graph */}
      <section
        id="graph"
        className="border-y border-white/5 bg-[#0a1220] px-5 py-20 sm:py-28"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-gold-light/80">
              Knowledge Graph
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold text-white sm:text-4xl">
              Jede Kante ist im Gesetz begründet
            </h2>
            <p className="mt-3 text-white/50">
              Hover über Knoten, um Verknüpfungen zu sehen. Wechsle zwischen Tierbesitz (§ 961 BGB)
              und Mietrecht (§ 558 BGB) — beide direkt aus gesetze-im-internet.de.
            </p>
          </div>
          <KnowledgeGraphViz />
        </div>
      </section>

      {/* Features */}
      <section className="px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="font-serif text-3xl font-semibold text-navy">
              Warum ein Graph — nicht nur RAG?
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-navy/10 bg-white p-6 transition hover:border-gold/30 hover:shadow-md hover:shadow-gold/5"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-gold-light">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-navy">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy/60">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Corpus */}
      <section className="border-t border-navy/10 bg-white px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-8 text-center font-serif text-2xl font-semibold text-navy">
            Seed-Korpus im Graph
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CORPUS.map((c) => (
              <div
                key={c.domain}
                className="flex items-center justify-between rounded-xl border border-navy/8 bg-cream px-4 py-3"
              >
                <span className="font-medium text-navy">{c.domain}</span>
                <span className="font-mono text-xs text-navy/45">{c.refs}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy px-5 py-16 text-center text-white">
        <div className="mx-auto max-w-xl">
          <h2 className="font-serif text-2xl font-semibold sm:text-3xl">
            Bereit, FineLens auszuprobieren?
          </h2>
          <p className="mt-3 text-white/60">
            Stellen Sie eine juristische Frage, erhalten Sie Zitate und vorausgefüllte Formulare.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gold px-8 py-3.5 text-sm font-semibold text-navy transition hover:bg-gold-light"
          >
            Zur Live-App
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-navy/10 bg-cream py-6 text-center text-xs text-navy/45">
        FineLens · Keine Rechtsberatung · Engine:{" "}
        <a
          href="https://github.com/getzep/graphiti"
          className="text-navy hover:text-gold"
          target="_blank"
          rel="noopener noreferrer"
        >
          Graphiti
        </a>
      </footer>
    </div>
  );
}
