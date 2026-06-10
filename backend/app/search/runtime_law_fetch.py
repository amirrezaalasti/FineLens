"""On-demand statute fetch when graph retrieval lacks applicable norms."""

import re
from typing import Any

from app.ingestion.buzer import fetch_law_paragraph
from app.ingestion.oldp import _guess_book_code, fetch_law, search_laws
from app.models.schemas import LegalSource
from app.search.legal_query_analysis import QueryAnalysis


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


async def fetch_runtime_norms(
    analysis: QueryAnalysis,
    limit: int = 6,
) -> list[dict[str, Any]]:
    """
    Search Open Legal Data by salient query terms and return exact statute text.
    Generalized fallback — works for any topic present in OLDP/buzer.
    """
    book = analysis.law_codes[0] if analysis.law_codes else (_guess_book_code(analysis.original) or "BGB")
    search_text = analysis.keyword_query or analysis.original[:400]

    try:
        results = await search_laws(search_text, limit=limit, book_code=book)
    except Exception:
        results = []

    if not results and analysis.salient_terms:
        try:
            results = await search_laws(
                " ".join(analysis.salient_terms[:4]),
                limit=limit,
                book_code=book,
            )
        except Exception:
            results = []

    hits: list[dict[str, Any]] = []
    seen_refs: set[str] = set()

    for law in results[:limit]:
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
                buzer_title, buzer_content, buzer_url = await fetch_law_paragraph(para, law_code)
                if buzer_content:
                    title = buzer_title or title
                    content = buzer_content
                    source_url = buzer_url
                    source = LegalSource.BUZER.value
                else:
                    source = LegalSource.OPEN_LEGAL_DATA.value
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
