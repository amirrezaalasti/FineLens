export type EntityKind = "LegalNorm" | "Tatbestandsmerkmal" | "Rechtsfolge" | "LegalSubject";
export type EdgeKind = "REQUIRES" | "IMPLIES" | "APPLIES_TO" | "REFERENCES";

export type DemoNode = {
  id: string;
  label: string;
  kind: EntityKind;
  x: number;
  y: number;
};

export type DemoEdge = {
  from: string;
  to: string;
  kind: EdgeKind;
};

export type DemoGraph = {
  id: string;
  title: string;
  subtitle: string;
  statute: string;
  sourceUrl: string;
  nodes: DemoNode[];
  edges: DemoEdge[];
};

/** Hand-laid positions (0–100 viewBox) for readable pitch layout */
export const TIERBESITZ_DEMO: DemoGraph = {
  id: "tierbesitz",
  title: "Tierbesitz & Fundrecht",
  subtitle: "§§ 958–964 BGB · Bienenschwarm-Cluster",
  statute:
    "§ 961 BGB: „Zieht ein Bienenschwarm aus, so wird er herrenlos, wenn nicht der Eigentümer ihn unverzüglich verfolgt oder wenn der Eigentümer die Verfolgung aufgibt.“",
  sourceUrl: "https://www.gesetze-im-internet.de/bgb/__961.html",
  nodes: [
    { id: "n961", label: "§ 961 BGB", kind: "LegalNorm", x: 50, y: 12 },
    { id: "n962", label: "§ 962 BGB", kind: "LegalNorm", x: 18, y: 28 },
    { id: "n964", label: "§ 964 BGB", kind: "LegalNorm", x: 82, y: 28 },
    { id: "n958", label: "§ 958 BGB", kind: "LegalNorm", x: 50, y: 88 },
    { id: "s_schwarm", label: "Bienenschwarm", kind: "LegalSubject", x: 8, y: 52 },
    { id: "s_wohnung", label: "Bienenwohnung", kind: "LegalSubject", x: 92, y: 52 },
    { id: "t_auszug", label: "Schwarm zieht aus", kind: "Tatbestandsmerkmal", x: 32, y: 48 },
    { id: "t_verfolgung", label: "Verfolgung", kind: "Tatbestandsmerkmal", x: 18, y: 62 },
    { id: "t_besetzt", label: "Einzug besetzte Wohnung", kind: "Tatbestandsmerkmal", x: 82, y: 62 },
    { id: "t_herrenlos", label: "Sache herrenlos", kind: "Tatbestandsmerkmal", x: 50, y: 72 },
    { id: "r_herrenlos", label: "herrenlos", kind: "Rechtsfolge", x: 50, y: 52 },
    { id: "r_betretung", label: "Betretungsrecht", kind: "Rechtsfolge", x: 8, y: 72 },
    { id: "r_uebergang", label: "Rechtsübergang", kind: "Rechtsfolge", x: 92, y: 72 },
    { id: "r_eigentum", label: "Eigentumserwerb", kind: "Rechtsfolge", x: 68, y: 88 },
  ],
  edges: [
    { from: "n961", to: "s_schwarm", kind: "APPLIES_TO" },
    { from: "n961", to: "t_auszug", kind: "REQUIRES" },
    { from: "n961", to: "r_herrenlos", kind: "IMPLIES" },
    { from: "n962", to: "s_schwarm", kind: "APPLIES_TO" },
    { from: "n962", to: "t_verfolgung", kind: "REQUIRES" },
    { from: "n962", to: "r_betretung", kind: "IMPLIES" },
    { from: "n964", to: "s_wohnung", kind: "APPLIES_TO" },
    { from: "n964", to: "t_besetzt", kind: "REQUIRES" },
    { from: "n964", to: "r_uebergang", kind: "IMPLIES" },
    { from: "n958", to: "t_herrenlos", kind: "REQUIRES" },
    { from: "n958", to: "r_eigentum", kind: "IMPLIES" },
  ],
};

export const MIETRECHT_DEMO: DemoGraph = {
  id: "mietrecht",
  title: "Mietrecht",
  subtitle: "§ 558 BGB · RechtsLens Mietwiderspruch",
  statute:
    "§ 558 Abs. 1 BGB: Der Vermieter kann die Zustimmung zu einer Erhöhung der Miete bis zur ortsüblichen Vergleichsmiete verlangen, wenn die Miete seit 15 Monaten unverändert ist.",
  sourceUrl: "https://www.gesetze-im-internet.de/bgb/__558.html",
  nodes: [
    { id: "n558", label: "§ 558 BGB", kind: "LegalNorm", x: 50, y: 14 },
    { id: "n559", label: "§§ 559–560", kind: "LegalNorm", x: 22, y: 30 },
    { id: "n559a", label: "§ 559a BGB", kind: "LegalNorm", x: 78, y: 30 },
    { id: "s_wohnraum", label: "Mietwohnung", kind: "LegalSubject", x: 8, y: 55 },
    { id: "t_15", label: "15 Monate unverändert", kind: "Tatbestandsmerkmal", x: 28, y: 48 },
    { id: "t_vergleich", label: "ortsübliche Vergleichsmiete", kind: "Tatbestandsmerkmal", x: 50, y: 48 },
    { id: "t_kappung", label: "Kappungsgrenze 20 %", kind: "Tatbestandsmerkmal", x: 72, y: 48 },
    { id: "r_zustimmung", label: "Zustimmungsverlangen", kind: "Rechtsfolge", x: 35, y: 72 },
    { id: "r_unwirksam", label: "Abweichung unwirksam", kind: "Rechtsfolge", x: 65, y: 72 },
    { id: "r_ausschluss", label: "§§ 559–560 ausgenommen", kind: "Rechtsfolge", x: 50, y: 88 },
  ],
  edges: [
    { from: "n558", to: "s_wohnraum", kind: "APPLIES_TO" },
    { from: "n558", to: "t_15", kind: "REQUIRES" },
    { from: "n558", to: "t_vergleich", kind: "REQUIRES" },
    { from: "n558", to: "t_kappung", kind: "REQUIRES" },
    { from: "n558", to: "r_zustimmung", kind: "IMPLIES" },
    { from: "n558", to: "r_unwirksam", kind: "IMPLIES" },
    { from: "n558", to: "r_ausschluss", kind: "IMPLIES" },
    { from: "n558", to: "n559", kind: "REFERENCES" },
    { from: "n558", to: "n559a", kind: "REFERENCES" },
  ],
};

export const DEMO_GRAPHS = [TIERBESITZ_DEMO, MIETRECHT_DEMO];

export const PIPELINE_STEPS = [
  {
    id: "ingest",
    label: "Gesetzestext",
    detail: "Open Legal Data, buzer.de, gesetze-im-internet.de",
    icon: "book" as const,
  },
  {
    id: "episode",
    label: "Graphiti Episode",
    detail: "Volltext + Provenance-Header mit §-Referenz & URL",
    icon: "file" as const,
  },
  {
    id: "extract",
    label: "LLM-Extraktion",
    detail: "4 Entitätstypen · 4 Kantentypen · juristische Ontologie",
    icon: "brain" as const,
  },
  {
    id: "graph",
    label: "Knowledge Graph",
    detail: "FalkorDB · Gruppe german_legal_corpus",
    icon: "network" as const,
  },
  {
    id: "search",
    label: "Hybrid Retrieval",
    detail: "BM25 + Vektor + citation-first Suche",
    icon: "search" as const,
  },
  {
    id: "answer",
    label: "Antwort + Zitate",
    detail: "Transparente Quellen zurück zur Primärquelle",
    icon: "message" as const,
  },
];

export const ONTOLOGY_LEGEND: { kind: EntityKind; color: string; desc: string }[] = [
  { kind: "LegalNorm", color: "#c9a227", desc: "Gesetzesnorm" },
  { kind: "Tatbestandsmerkmal", color: "#599ce7", desc: "Voraussetzung" },
  { kind: "Rechtsfolge", color: "#3fa266", desc: "Rechtsfolge" },
  { kind: "LegalSubject", color: "#a78bfa", desc: "Rechtsobjekt" },
];

export const EDGE_LEGEND: { kind: EdgeKind; dash?: boolean; desc: string }[] = [
  { kind: "REQUIRES", desc: "Norm setzt voraus" },
  { kind: "IMPLIES", desc: "Norm bewirkt" },
  { kind: "APPLIES_TO", desc: "Norm gilt für" },
  { kind: "REFERENCES", dash: true, desc: "Verweisungsstil" },
];
