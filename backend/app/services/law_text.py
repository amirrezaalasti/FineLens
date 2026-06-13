import asyncio
import re
from urllib.parse import urlparse

from app.ingestion.statute_fetch import (
    build_statute_url,
    fetch_statute_paragraph,
    format_law_display_name,
    normalize_law_code,
)
from app.models.schemas import Citation, LegalSource, SOURCE_URLS

_LAW_REF_RE = re.compile(
    r"§\s*(\d+[a-z]?)(?:\s*(?:Abs\.?|abs\.?)\s*\d+)?(?:\s*(?:S\.?|s\.?)\s*\d+)?\s+"
    r"(SGB\s*X|SGB\s*10|BA[fF][öoO]?[gG]|[A-ZÄÖÜ]{2,10})|"
    r"\b(SGB\s*X|SGB\s*10|BA[fF][öoO]?[gG]|[A-ZÄÖÜ]{2,10})\s+§\s*(\d+[a-z]?)|"
    r"\b(SGB\s*X|SGB\s*10|BA[fF][öoO]?[gG]|[A-ZÄÖÜ]{2,10})\s+(\d+[a-z]?)\b",
    re.I,
)

_PORTAL_HOME_PATHS = {"/", "/de/home/home_node.html", "/home", "/jportal/nav/index.jsp"}


def is_portal_homepage_url(url: str) -> bool:
    if not url:
        return True
    normalized = url.rstrip("/")
    if normalized in {portal.rstrip("/") for portal in SOURCE_URLS.values()}:
        return True
    parsed = urlparse(url)
    path = parsed.path.rstrip("/") or "/"
    return path in _PORTAL_HOME_PATHS


def ensure_citation_url(citation: Citation) -> Citation:
    if citation.source_url and not is_portal_homepage_url(citation.source_url):
        return citation

    parsed = extract_law_reference(
        citation.law_reference,
        citation.title,
        citation.excerpt,
    )
    if not parsed:
        return citation

    paragraph, law_code = parsed
    url = build_statute_url(paragraph, law_code)
    if not url:
        return citation

    law_ref = format_law_reference(paragraph, law_code)
    source = (
        LegalSource.GESETZE_IM_INTERNET
        if "gesetze-im-internet" in url
        else LegalSource.BUZER
    )
    return citation.model_copy(
        update={
            "source_url": url,
            "source": source,
            "law_reference": citation.law_reference or law_ref,
        }
    )


def extract_law_reference(*texts: str) -> tuple[str, str] | None:
    for text in texts:
        if not text:
            continue
        for match in _LAW_REF_RE.finditer(text):
            if match.group(1) and match.group(2):
                return match.group(1), normalize_law_code(match.group(2))
            if match.group(3) and match.group(4):
                return match.group(4), normalize_law_code(match.group(3))
            if match.group(5) and match.group(6):
                return match.group(6), normalize_law_code(match.group(5))
    return None


def format_law_reference(paragraph: str, law_code: str) -> str:
    return f"§ {paragraph} {format_law_display_name(law_code)}"


async def enrich_citation_with_exact_text(citation: Citation) -> Citation:
    parsed = extract_law_reference(
        citation.law_reference,
        citation.title,
        citation.excerpt,
    )
    if not parsed:
        return citation

    paragraph, law_code = parsed
    law_ref = format_law_reference(paragraph, law_code)

    try:
        title, content, url, source_name = await fetch_statute_paragraph(paragraph, law_code)
        if not content:
            return citation.model_copy(update={"law_reference": law_ref})

        source = LegalSource.BUZER
        if "gesetze-im-internet" in source_name:
            source = LegalSource.GESETZE_IM_INTERNET

        return citation.model_copy(
            update={
                "excerpt": content,
                "law_reference": law_ref,
                "title": title or law_ref,
                "source_url": url,
                "source": source,
            }
        )
    except Exception:
        updated = citation.model_copy(update={"law_reference": law_ref})
        return ensure_citation_url(updated)


async def enrich_citations(
    citations: list[Citation],
    *,
    max_items: int | None = None,
) -> list[Citation]:
    to_enrich = citations[:max_items] if max_items else citations
    rest = citations[len(to_enrich) :]
    try:
        enriched = await asyncio.wait_for(
            asyncio.gather(*(enrich_citation_with_exact_text(c) for c in to_enrich)),
            timeout=20,
        )
        enriched = [ensure_citation_url(c) for c in enriched]
    except TimeoutError:
        enriched = [ensure_citation_url(c) for c in to_enrich]
    return enriched + [ensure_citation_url(c) for c in rest]
