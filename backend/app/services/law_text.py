import asyncio
import re

from app.ingestion.statute_fetch import fetch_statute_paragraph
from app.models.schemas import Citation, LegalSource

_LAW_REF_RE = re.compile(
    r"§\s*(\d+[a-z]?)\s+([A-ZÄÖÜ]{2,10})|"
    r"\b([A-ZÄÖÜ]{2,10})\s+§\s*(\d+[a-z]?)|"
    r"\b([A-ZÄÖÜ]{2,10})\s+(\d+[a-z]?)\b",
    re.I,
)


def extract_law_reference(*texts: str) -> tuple[str, str] | None:
    for text in texts:
        if not text:
            continue
        for match in _LAW_REF_RE.finditer(text):
            if match.group(1) and match.group(2):
                return match.group(1), match.group(2).upper()
            if match.group(3) and match.group(4):
                return match.group(4), match.group(3).upper()
            if match.group(5) and match.group(6):
                return match.group(6), match.group(5).upper()
    return None


def format_law_reference(paragraph: str, law_code: str) -> str:
    return f"§ {paragraph} {law_code.upper()}"


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
        return citation.model_copy(update={"law_reference": law_ref})


async def enrich_citations(citations: list[Citation]) -> list[Citation]:
    return list(await asyncio.gather(*(enrich_citation_with_exact_text(c) for c in citations)))
