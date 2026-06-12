"""Rescore retrieval hits by query applicability (generalized, not topic-specific)."""

import re
from collections import Counter
from typing import Any

from app.config import settings
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
    "sachenrecht": frozenset(
        {"eigentum", "besitz", "herrenlos", "aneignung", "biene", "schwarm",
         "bienenschwarm", "bienenstock", "fund", "fundstück", "finder", "wildtier"}
    ),
    "nachbarrecht": frozenset(
        {"nachbar", "grundstück", "grenze", "überbau", "notwegrecht",
         "immission", "betreten", "verfolgungsrecht"}
    ),
    "handelsrecht": frozenset(
        {"kaufmann", "handelsregister", "hgb", "firma", "prokura"}
    ),
}

# Paragraph ranges strongly associated with a domain (BGB) — used as secondary signal.
_PARAGRAPH_DOMAIN: list[tuple[int, int, str]] = [
    (535, 580, "mietrecht"),
    (242, 304, "familienrecht"),
    (1922, 1990, "erbrecht"),
    (958, 966, "sachenrecht"),
    (823, 853, "deliktsrecht"),
    (903, 924, "sachenrecht"),
]

_PARA_REF_RE = re.compile(r"§\s*(\d+)", re.I)
_NORM_REF_RE = re.compile(r"§\s*\d+[a-z]?\s*(?:Abs\.?\s*\d+)?\s*(?:S\.?\s*\d+)?\s*[A-ZÄÖÜ]{2,10}", re.I)


def _hit_text(hit: dict[str, Any]) -> str:
    parts = [
        hit.get("title", ""),
        hit.get("law_reference", ""),
        hit.get("fact", ""),
        hit.get("excerpt", ""),
    ]
    return " ".join(p for p in parts if p).lower()


def _hit_tokens(hit: dict[str, Any]) -> set[str]:
    """Extract normalized tokens from a hit for overlap/specificity analysis."""
    tokens = {
        _normalize_token(t)
        for t in re.findall(r"\b\w{3,}\b", _hit_text(hit))
    }
    tokens -= {"", "der", "die", "das", "und", "bgb", "gesetz"}
    return tokens


def _lexical_overlap(query_tokens: set[str], hit: dict[str, Any]) -> float:
    if not query_tokens:
        return 0.0
    hit_tok = _hit_tokens(hit)
    if not hit_tok:
        return 0.0
    # Exact token overlap
    overlap = query_tokens & hit_tok
    # German compound word (Komposita) matching: "Bienenschwärme" contains "biene" + "schwarm"
    # Check if query tokens appear as substrings in longer hit tokens
    unmatched_query = query_tokens - overlap
    if unmatched_query:
        for q_token in unmatched_query:
            if len(q_token) < 4:
                continue
            for h_token in hit_tok:
                if len(h_token) > len(q_token) and q_token in h_token:
                    overlap.add(q_token)
                    break
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


def _compound_overlap(query_tokens: set[str], hit_tok: set[str]) -> set[str]:
    """Find query tokens that match hit tokens, including German compound word matching."""
    overlap = query_tokens & hit_tok
    unmatched = query_tokens - overlap
    if unmatched:
        for q_token in unmatched:
            if len(q_token) < 4:
                continue
            for h_token in hit_tok:
                if len(h_token) > len(q_token) and q_token in h_token:
                    overlap.add(q_token)
                    break
    return overlap


def _specificity_bonus(
    query_tokens: set[str],
    hit: dict[str, Any],
    term_frequency: Counter,
) -> float:
    """Boost hits that contain query terms appearing in few other hits.

    If a query term like "biene" appears in only 1-2 of all retrieval hits,
    the hit that contains it gets a strong bonus. This counteracts vector-gravity
    where common terms like "Eigentum" dominate.
    """
    hit_tok = _hit_tokens(hit)
    overlapping = _compound_overlap(query_tokens, hit_tok)
    if not overlapping:
        return 0.0

    bonus = 0.0
    for term in overlapping:
        freq = term_frequency.get(term, 0)
        if freq <= 1:
            # Term appears in only this hit — very specific, strong bonus
            bonus += 1.0
        elif freq <= 3:
            # Term appears in a few hits — moderate bonus
            bonus += 0.5
        # Terms appearing in many hits (freq > 3) get no specificity bonus

    # Normalize by number of query tokens so bonus is 0-1 range
    return min(bonus / max(len(query_tokens), 1), 1.0)


def _norm_candidate_bonus(
    hit: dict[str, Any],
    norm_candidates: list[str],
) -> float:
    """Boost hits that reference norms predicted by the query rewriter.

    If the LLM predicted "§ 961 BGB" as relevant and a hit mentions that
    exact norm, give it a strong boost.
    """
    if not norm_candidates:
        return 0.0

    hit_text_lower = _hit_text(hit)
    bonus = 0.0
    for norm in norm_candidates:
        # Normalize the norm reference for matching
        norm_lower = norm.lower().replace("§", "").strip()
        # Extract just the paragraph number for fuzzy matching
        norm_match = re.search(r"(\d+[a-z]?)", norm_lower)
        if norm_match:
            para = norm_match.group(1)
            # Check if this paragraph appears in the hit
            if re.search(rf"§\s*{re.escape(para)}\b", hit_text_lower):
                bonus += 0.5
            elif para in hit_text_lower:
                bonus += 0.25

    return min(bonus, 1.0)


def _build_term_frequency(hits: list[dict[str, Any]], query_tokens: set[str]) -> Counter:
    """Count how many hits each query token appears in (document frequency).
    Uses compound word matching for German Komposita."""
    freq: Counter = Counter()
    for hit in hits:
        hit_tok = _hit_tokens(hit)
        matched = _compound_overlap(query_tokens, hit_tok)
        for term in matched:
            freq[term] += 1
    return freq


def rescore_hits(
    hits: list[dict[str, Any]],
    analysis: QueryAnalysis,
    min_score: float = 0.05,
) -> list[dict[str, Any]]:
    """Re-rank hits by lexical overlap, domain consistency, specificity, and norm matching."""
    query_tokens = analysis.token_set | {_normalize_token(t) for t in analysis.salient_terms}

    # Pre-compute term frequency across all hits for specificity scoring
    term_freq = _build_term_frequency(hits, query_tokens)
    specificity_weight = settings.legal_search_specificity_bonus

    rescored: list[dict[str, Any]] = []
    for hit in hits:
        base = float(hit.get("score", 0.5))
        overlap = _lexical_overlap(query_tokens, hit)
        domain_factor = _domain_mismatch_factor(query_tokens, hit)
        spec_bonus = _specificity_bonus(query_tokens, hit, term_freq)
        norm_bonus = _norm_candidate_bonus(hit, analysis.norm_candidates)

        # BM25-like term overlap is weighted heavily; base retrieval score is secondary.
        # Specificity and norm bonuses are additive — they can promote rare-term hits.
        # Predicted-norm hits get a floor boost so they never score below useful threshold
        predicted_floor = 0.15 if hit.get("_predicted") else 0.0
        final = (
            (overlap * 0.50 + base * 0.20 + spec_bonus * specificity_weight + norm_bonus * 0.25 + predicted_floor)
            * domain_factor
        )

        if final < min_score:
            continue

        rescored.append(
            {
                **hit,
                "score": min(final, 1.0),
                "_overlap": overlap,
                "_domain_factor": domain_factor,
                "_specificity": spec_bonus,
                "_norm_match": norm_bonus,
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

