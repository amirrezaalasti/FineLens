"""Rescore retrieval hits by query applicability (generalized, not topic-specific)."""

import re
from typing import Any

from app.search.legal_query_analysis import QueryAnalysis, _normalize_token

# Statute-text domain markers: penalize when present in hit but absent from query.
_DOMAIN_MARKERS: dict[str, frozenset[str]] = {
    "mietrecht": frozenset(
        {"mietvertrag", "mieter", "vermieter", "miete", "mietrecht", "wohnraum", "mietwohnung"}
    ),
    "datenschutz": frozenset(
        {"datenschutz", "personenbezogen", "dsgvo", "einwilligung", "verarbeitung"}
    ),
    "erbrecht": frozenset({"erbe", "erbschaft", "testament", "pflichtteil", "nachlass"}),
    "familienrecht": frozenset({"scheidung", "unterhalt", "sorge", "ehegatte"}),
    "arbeitsrecht": frozenset({"arbeitnehmer", "arbeitgeber", "kündigung arbeit", "betriebsrat"}),
    "strafrecht": frozenset({"straftat", "freiheitsstrafe", "geldstrafe", "stgb"}),
}

# Paragraph ranges strongly associated with a domain (BGB) — used as secondary signal.
_PARAGRAPH_DOMAIN: list[tuple[int, int, str]] = [
    (535, 580, "mietrecht"),
    (242, 304, "familienrecht"),
    (1922, 1990, "erbrecht"),
]

_PARA_REF_RE = re.compile(r"§\s*(\d+)", re.I)


def _hit_text(hit: dict[str, Any]) -> str:
    parts = [
        hit.get("title", ""),
        hit.get("law_reference", ""),
        hit.get("fact", ""),
        hit.get("excerpt", ""),
    ]
    return " ".join(p for p in parts if p).lower()


def _lexical_overlap(query_tokens: set[str], hit: dict[str, Any]) -> float:
    if not query_tokens:
        return 0.0
    hit_tokens = {
        _normalize_token(t)
        for t in re.findall(r"\b\w{3,}\b", _hit_text(hit))
    }
    hit_tokens -= {"", "der", "die", "das", "und", "bgb", "gesetz"}
    if not hit_tokens:
        return 0.0
    overlap = query_tokens & hit_tokens
    return len(overlap) / max(len(query_tokens), 1)


def _domain_mismatch_factor(query_tokens: set[str], hit: dict[str, Any]) -> float:
    """Reduce score when hit belongs to a legal subdomain not indicated in the query."""
    hit_lower = _hit_text(hit)
    query_blob = " ".join(query_tokens)
    factor = 1.0

    for domain, markers in _DOMAIN_MARKERS.items():
        hit_in_domain = any(m in hit_lower for m in markers)
        query_in_domain = any(m in query_blob for m in markers)
        if hit_in_domain and not query_in_domain:
            factor *= 0.2

    for match in _PARA_REF_RE.finditer(hit.get("law_reference", "") + " " + hit.get("title", "")):
        para = int(match.group(1))
        for start, end, domain in _PARAGRAPH_DOMAIN:
            if start <= para <= end:
                markers = _DOMAIN_MARKERS.get(domain, frozenset())
                if markers and not any(m in query_blob for m in markers):
                    factor *= 0.25
                break

    return factor


def rescore_hits(
    hits: list[dict[str, Any]],
    analysis: QueryAnalysis,
    min_score: float = 0.05,
) -> list[dict[str, Any]]:
    """Re-rank hits by lexical overlap and domain-query consistency."""
    query_tokens = analysis.token_set | {_normalize_token(t) for t in analysis.salient_terms}

    rescored: list[dict[str, Any]] = []
    for hit in hits:
        base = float(hit.get("score", 0.5))
        overlap = _lexical_overlap(query_tokens, hit)
        domain_factor = _domain_mismatch_factor(query_tokens, hit)

        # BM25-like term overlap is weighted heavily; base retrieval score is secondary.
        final = (overlap * 0.65 + base * 0.35) * domain_factor

        if final < min_score:
            continue

        rescored.append(
            {
                **hit,
                "score": min(final, 1.0),
                "_overlap": overlap,
                "_domain_factor": domain_factor,
            }
        )

    rescored.sort(key=lambda h: h["score"], reverse=True)
    return rescored


def retrieval_quality(hits: list[dict[str, Any]]) -> float:
    """0–1 estimate of whether graph retrieval found applicable norms."""
    if not hits:
        return 0.0
    top = hits[:3]
    return sum(h.get("_overlap", h.get("score", 0)) for h in top) / len(top)
