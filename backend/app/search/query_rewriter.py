"""LLM-powered query rewriter: extract legal keywords from narrative user queries.

Intercepts the raw user prompt before retrieval and rewrites it into
structured legal search terms so BM25 can find specific norms (lex specialis)
instead of drowning in generic tort/property results.
"""

import json
import logging
import re
from dataclasses import dataclass, field

from app.config import settings

logger = logging.getLogger(__name__)

_REWRITE_SYSTEM_PROMPT = """\
Du bist ein juristischer Suchoptimierer für deutsches Recht.
Deine Aufgabe: Extrahiere aus einer Nutzeranfrage die relevanten juristischen Suchbegriffe.

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt (kein Markdown, kein Text davor/danach):
{
  "legal_subjects": ["<spezifische Rechtsobjekte, z.B. Biene, Schwarm, Mietsache, Fundstück>"],
  "tatbestand_keywords": ["<Tatbestandsbegriffe, z.B. Verfolgung, Abhandenkommen, gutgläubig>"],
  "norm_candidates": ["<vermutlich einschlägige Normen, z.B. § 961 BGB, § 823 BGB>"],
  "law_codes": ["<Gesetzbücher, z.B. BGB, StGB>"],
  "search_keywords": ["<optimierte Suchbegriffe für Volltextsuche>"]
}

Regeln:
1. Extrahiere ALLE spezifischen Nomen/Substantive die rechtlich relevant sein könnten.
2. Bevorzuge seltene, spezifische Begriffe vor allgemeinen (Biene > Eigentum).
3. Bei Tieren: nenne das Tier UND relevante Rechtsbegriffe (herrenlos, Schwarm, etc.).
4. Nenne auch Lex-specialis-Normen wenn du sie kennst.
5. Ignoriere Personennamen (Anton, Berta, Carl) — nur juristische Begriffe.
6. search_keywords soll 4-8 prägnante Begriffe enthalten, die für BM25-Suche optimal sind.
"""


@dataclass
class RewrittenQuery:
    """Structured output from the query rewriter."""

    legal_subjects: list[str] = field(default_factory=list)
    tatbestand_keywords: list[str] = field(default_factory=list)
    norm_candidates: list[str] = field(default_factory=list)
    law_codes: list[str] = field(default_factory=list)
    search_keywords: list[str] = field(default_factory=list)

    @property
    def keyword_query(self) -> str:
        """Combine all extracted terms into a single BM25-optimized query string."""
        parts = []
        # Specific subjects first — these are the rare, high-signal terms
        parts.extend(self.legal_subjects)
        parts.extend(self.tatbestand_keywords)
        parts.extend(self.search_keywords)
        # Deduplicate while preserving order
        seen: set[str] = set()
        unique: list[str] = []
        for term in parts:
            key = term.lower().strip()
            if key and key not in seen:
                seen.add(key)
                unique.append(term)
        return " ".join(unique[:12])

    @property
    def subject_query(self) -> str:
        """Query focused on legal subjects for node-level search."""
        terms = self.legal_subjects + self.tatbestand_keywords
        return " ".join(terms[:6]) if terms else ""


# ── Regex-based fallback extractor ──────────────────────────────────────────

_LEGAL_NOUN_RE = re.compile(r"\b[A-ZÄÖÜ][a-zäöüß]{2,}\b")
_NORM_RE = re.compile(r"§\s*\d+[a-z]?\s*(?:Abs\.?\s*\d+)?\s*(?:S\.?\s*\d+)?\s*[A-ZÄÖÜ]{2,10}", re.I)
_GERMAN_STOPWORDS = frozenset(
    "eine einer eines einem einen und oder der die das den dem des mit von für auf "
    "bei ist sind war waren wird wurden kann können soll sollen muss müssen nicht "
    "auch nur noch schon sehr mehr als wie wenn dann dass dies diese dieser diesem "
    "sein seine seinem seinen seiner hat haben hatte hatten".split()
)
_PERSON_NAMES = frozenset(
    "anton berta carl dieter emma fritz gustav hans irene julia karl "
    "lisa maria otto peter robert stefan thomas".split()
)

_LEGAL_SUBJECT_HINTS = {
    "biene", "bienen", "schwarm", "bienenschwarm", "bienenstock",
    "fund", "fundstück", "finder", "tier", "wildtier", "haustier",
    "mietsache", "mietwohnung", "grundstück", "fahrzeug", "schiff",
}


def _fallback_extract(query: str) -> RewrittenQuery:
    """Regex-based extraction when LLM call fails."""
    norms = _NORM_RE.findall(query)
    nouns = _LEGAL_NOUN_RE.findall(query)

    subjects: list[str] = []
    keywords: list[str] = []

    for noun in nouns:
        lower = noun.lower()
        if lower in _GERMAN_STOPWORDS or lower in _PERSON_NAMES:
            continue
        if lower in _LEGAL_SUBJECT_HINTS:
            subjects.append(noun)
        else:
            keywords.append(noun)

    law_codes: list[str] = []
    for code in ("BGB", "STGB", "GG", "DSGVO", "HGB", "ZPO"):
        if code in query.upper():
            law_codes.append(code)

    return RewrittenQuery(
        legal_subjects=subjects[:6],
        tatbestand_keywords=[],
        norm_candidates=norms[:4],
        law_codes=law_codes or ["BGB"],
        search_keywords=keywords[:8],
    )


# ── LLM-powered rewriter ───────────────────────────────────────────────────

async def rewrite_query(query: str) -> RewrittenQuery:
    """Rewrite a user query into structured legal search terms.

    Uses gpt-4o-mini for speed and cost (~0.15¢ per call).
    Falls back to regex extraction on any failure.
    """
    if not settings.legal_search_rewrite_queries:
        return _fallback_extract(query)

    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=settings.openai_api_key)
        completion = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _REWRITE_SYSTEM_PROMPT},
                {"role": "user", "content": query},
            ],
            temperature=0.0,
            max_tokens=400,
        )
        raw = completion.choices[0].message.content or ""

        # Strip markdown code fences if present
        raw = raw.strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)

        data = json.loads(raw)

        return RewrittenQuery(
            legal_subjects=data.get("legal_subjects", [])[:8],
            tatbestand_keywords=data.get("tatbestand_keywords", [])[:8],
            norm_candidates=data.get("norm_candidates", [])[:6],
            law_codes=data.get("law_codes", [])[:4] or ["BGB"],
            search_keywords=data.get("search_keywords", [])[:10],
        )

    except Exception as exc:
        logger.warning("Query rewriter failed, using fallback: %s", exc)
        return _fallback_extract(query)
