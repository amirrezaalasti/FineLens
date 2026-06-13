"""On-demand statute fetch when graph retrieval lacks applicable norms.

Two main entry points:
- fetch_predicted_norms(): High-confidence direct fetch from buzer.de using
  LLM-predicted norm candidates (e.g. ["§ 961 BGB", "§ 962 BGB"]).
  Runs in parallel with graph search for maximum recall.
- fetch_runtime_norms(): Broader fallback via OLDP text search when graph
  retrieval quality is low.
"""

import asyncio
import logging
import re
from typing import Any

from app.ingestion.statute_fetch import (
    fetch_statute_paragraph,
    format_law_display_name,
    normalize_law_code,
)
from app.ingestion.oldp import _guess_book_code, fetch_law, search_laws
from app.models.schemas import LegalSource
from app.search.legal_query_analysis import QueryAnalysis

logger = logging.getLogger(__name__)

# How many neighboring paragraphs to fetch around each predicted norm.
# German law groups related provisions together (e.g. §§ 961-964 BGB = Bienenrecht).
_NEIGHBOR_RANGE = 3

_NORM_PARSE_RE = re.compile(
    r"§\s*(\d+[a-z]?)(?:\s*(?:Abs\.?|abs\.?)\s*\d+)?(?:\s*(?:S\.?|s\.?)\s*\d+)?\s*"
    r"(SGB\s*X|SGB\s*10|BA[fF][öoO]?[gG]|[A-ZÄÖÜ]{2,10})",
    re.I,
)

_PARA_ONLY_RE = re.compile(r"(\d+[a-z]?)")


def _parse_norm_reference(norm: str) -> tuple[str, str] | None:
    """Parse '§ 961 BGB' or '961 BGB' into ('961', 'BGB')."""
    match = _NORM_PARSE_RE.search(norm)
    if match:
        return match.group(1), normalize_law_code(match.group(2))
    # Try just number + code
    parts = norm.replace("§", "").strip().split()
    if len(parts) >= 2:
        num_match = _PARA_ONLY_RE.search(parts[0])
        if num_match:
            return num_match.group(1), normalize_law_code(parts[-1])
    return None


def _paragraph_from_law_record(law: dict) -> tuple[str, str] | None:
    book = (law.get("book_code") or law.get("book") or "BGB").upper()
    section = str(law.get("section", "") or "")
    match = re.search(r"(\d+[a-z]?)", section)
    if match:
        return match.group(1), book
    title = str(law.get("title", ""))
    match = re.search(r"§\s*(\d+[a-z]?)", title)
    if match:
        return match.group(1), book
    return None


def _neighboring_paragraphs(para: str, law_code: str, distance: int = _NEIGHBOR_RANGE) -> list[tuple[str, str]]:
    """Generate neighboring paragraph numbers for related-norm fetching.

    Example: para='961', distance=3 → ['962', '963', '964'] (forward only,
    since we assume the predicted norm is the starting point of a cluster).
    """
    num_match = re.match(r"(\d+)", para)
    if not num_match:
        return []
    base = int(num_match.group(1))
    suffix = para[len(num_match.group(1)):]  # e.g. 'a' from '961a'
    if suffix:
        # Don't generate neighbors for lettered paragraphs (too unpredictable)
        return []
    neighbors = []
    for offset in range(1, distance + 1):
        neighbors.append((str(base + offset), law_code))
    return neighbors


async def _fetch_norm_hit(
    para: str,
    law_code: str,
    *,
    score: float,
    prefix: str,
    overlap: float,
) -> dict[str, Any] | None:
    try:
        title, content, url, source_name = await fetch_statute_paragraph(para, law_code)
        if not content or len(content.strip()) < 20:
            return None

        display_code = format_law_display_name(law_code)
        reference = f"§ {para} {display_code}"
        logger.info("Fetched predicted norm: %s → %d chars", reference, len(content))
        return {
            "fact": content,
            "source_url": url,
            "source": source_name,
            "title": title or reference,
            "law_reference": reference,
            "episode_id": "",
            "score": score,
            "uuid": f"{prefix}-{reference}",
            "_runtime": True,
            "_predicted": True,
            "_overlap": overlap,
        }
    except Exception as exc:
        logger.debug("Failed to fetch predicted norm § %s %s: %s", para, law_code, exc)
        return None


async def fetch_predicted_norms(
    norm_candidates: list[str],
    limit: int = 12,
) -> list[dict[str, Any]]:
    """Fetch exact statute text for LLM-predicted norm candidates from buzer.de.

    This is the highest-signal retrieval path: the query rewriter LLM identifies
    which specific norms are relevant (e.g. §§ 961-964 BGB for bee swarms),
    and we fetch their exact text directly — no fuzzy text search involved.

    Also fetches neighboring paragraphs since German law clusters related
    provisions together.
    """
    if not norm_candidates:
        return []

    # Parse all norm references and deduplicate
    targets: list[tuple[str, str]] = []
    seen: set[str] = set()

    for norm in norm_candidates:
        parsed = _parse_norm_reference(norm)
        if not parsed:
            continue
        para, law_code = parsed
        key = f"{para}_{law_code}"
        if key not in seen:
            seen.add(key)
            targets.append((para, law_code))

    # For each target, also add neighboring paragraphs
    expanded_targets: list[tuple[str, str]] = []
    for para, law_code in targets:
        expanded_targets.append((para, law_code))
        for neighbor_para, neighbor_code in _neighboring_paragraphs(para, law_code):
            key = f"{neighbor_para}_{neighbor_code}"
            if key not in seen:
                seen.add(key)
                expanded_targets.append((neighbor_para, neighbor_code))

    # Fetch explicit norms first (highest priority), then neighbors if room remains
    hits: list[dict[str, Any]] = []
    primary_results = await asyncio.gather(
        *(
            _fetch_norm_hit(
                para,
                law_code,
                score=0.95,
                prefix="predicted",
                overlap=0.7,
            )
            for para, law_code in targets[:limit]
        )
    )
    for hit in primary_results:
        if hit:
            hits.append(hit)

    if len(hits) >= limit:
        return hits[:limit]

    neighbor_targets = [
        (para, code)
        for para, code in expanded_targets
        if (para, code) not in targets
    ]
    neighbor_results = await asyncio.gather(
        *(
            _fetch_norm_hit(
                para,
                law_code,
                score=0.88,
                prefix="predicted-neighbor",
                overlap=0.5,
            )
            for para, law_code in neighbor_targets[: limit - len(hits)]
        )
    )
    for hit in neighbor_results:
        if hit:
            hits.append(hit)

    return hits


async def fetch_runtime_norms(
    analysis: QueryAnalysis,
    limit: int = 6,
) -> list[dict[str, Any]]:
    """Broader fallback: search OLDP by legal terms and return statute text.

    Priority order:
    1. Fetch norm_candidates directly from buzer.de (highest signal)
    2. Search OLDP by legal_subjects (e.g. "Bienenschwarm") — more precise
    3. Search OLDP by keyword_query — last resort
    """
    hits: list[dict[str, Any]] = []
    seen_refs: set[str] = set()

    # ── Priority 1: Direct fetch of norm candidates via buzer.de ─────────
    if analysis.norm_candidates:
        predicted = await fetch_predicted_norms(analysis.norm_candidates, limit=limit)
        for hit in predicted:
            ref = hit.get("law_reference", "")
            if ref and ref not in seen_refs:
                seen_refs.add(ref)
                hits.append(hit)

    if len(hits) >= limit:
        return hits[:limit]

    # ── Priority 2: OLDP search by legal subjects ────────────────────────
    remaining = limit - len(hits)
    book = analysis.law_codes[0] if analysis.law_codes else (_guess_book_code(analysis.original) or "BGB")

    # Use legal_subjects for search (more precise than keyword_query)
    search_terms = []
    if analysis.legal_subjects:
        search_terms.append(" ".join(analysis.legal_subjects[:4]))
    if analysis.salient_terms:
        search_terms.append(" ".join(analysis.salient_terms[:4]))

    # Fallback to keyword_query
    search_text = analysis.keyword_query or analysis.original[:400]
    if search_text not in search_terms:
        search_terms.append(search_text)

    results: list[dict] = []
    for term in search_terms:
        if results:
            break
        try:
            results = await search_laws(term, limit=remaining, book_code=book)
        except Exception:
            continue

    # ── Process OLDP results ─────────────────────────────────────────────
    for law in results[:remaining]:
        law_id = law.get("id")
        try:
            full = await fetch_law(law_id) if law_id else law
        except Exception:
            full = law

        parsed = _paragraph_from_law_record(full)
        title = full.get("title", full.get("slug", "Gesetz"))
        content = full.get("content", "") or full.get("text", "")
        source_url = LegalSource.OPEN_LEGAL_DATA.value
        reference = str(full.get("book_code", book))

        if parsed:
            para, law_code = parsed
            reference = f"§ {para} {law_code}"
            if reference in seen_refs:
                continue
            seen_refs.add(reference)
            try:
                fetched_title, fetched_content, fetched_url, source = await fetch_statute_paragraph(
                    para, law_code
                )
                if fetched_content:
                    title = fetched_title or title
                    content = fetched_content
                    source_url = fetched_url
            except Exception:
                source = LegalSource.OPEN_LEGAL_DATA.value
        else:
            source = LegalSource.OPEN_LEGAL_DATA.value
            if not content:
                snippets = law.get("snippets", [])
                content = "\n".join(s.get("text", "") for s in snippets if s.get("text"))
            if not content:
                continue

        hits.append(
            {
                "fact": content,
                "source_url": source_url,
                "source": source,
                "title": title,
                "law_reference": reference if parsed else title,
                "episode_id": "",
                "score": 0.92,
                "uuid": f"runtime-{reference or title}",
                "_runtime": True,
                "_overlap": 0.5,
            }
        )

    return hits
