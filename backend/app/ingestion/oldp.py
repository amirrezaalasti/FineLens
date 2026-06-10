import re

import httpx

from app.config import settings
from app.graphiti_client import add_legal_episode
from app.models.schemas import LegalSource

BOOK_CODE_PATTERN = re.compile(r"\b([A-ZÄÖÜ]{2,10})\b")


async def _headers() -> dict[str, str]:
    headers = {"Accept": "application/json"}
    if settings.oldp_api_key:
        headers["Authorization"] = f"Token {settings.oldp_api_key}"
    return headers


def _guess_book_code(query: str) -> str | None:
    upper = query.upper()
    for code in ("BGB", "STGB", "GG", "DSGVO", "HGB", "ZPO", "STPO", "AO", "VVG"):
        if code in upper:
            return code
    match = BOOK_CODE_PATTERN.search(upper)
    return match.group(1) if match else None


def _normalize_search_query(query: str) -> str:
    cleaned = query.replace("§", " ").strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    book_code = _guess_book_code(cleaned)
    if book_code:
        cleaned = cleaned.replace(book_code, " ").strip()
    section_match = re.search(r"\b(\d+[a-z]?)\b", cleaned, re.I)
    if section_match:
        return section_match.group(1)
    return cleaned or query


async def search_laws(query: str, limit: int = 10, book_code: str | None = None) -> list[dict]:
    params: dict[str, str | int] = {"text": query, "page_size": limit}
    if book_code:
        params["book_code"] = book_code

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{settings.oldp_api_base}/laws/search/",
            params=params,
            headers=await _headers(),
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("results", data if isinstance(data, list) else [])


async def fetch_law(law_id: int) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{settings.oldp_api_base}/laws/{law_id}/",
            headers=await _headers(),
        )
        resp.raise_for_status()
        return resp.json()


async def ingest_laws(query: str = "", limit: int = 10) -> int:
    book_code = _guess_book_code(query) if query else None
    search_query = _normalize_search_query(query) if query else ""

    if search_query:
        laws = await search_laws(search_query, limit, book_code)
    else:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{settings.oldp_api_base}/laws/",
                params={"page_size": limit},
                headers=await _headers(),
            )
            resp.raise_for_status()
            data = resp.json()
            laws = data.get("results", [])

    count = 0
    for law in laws[:limit]:
        law_id = law.get("id")
        if not law_id:
            continue

        try:
            full = await fetch_law(law_id)
        except Exception:
            full = law

        title = full.get("title", full.get("slug", f"Gesetz {law_id}"))
        content = full.get("content", "") or full.get("text", "")

        if not content:
            snippets = law.get("snippets", [])
            if snippets:
                content = "\n".join(s.get("text", "") for s in snippets if s.get("text"))
        if not content:
            content = f"Titel: {title}\nBuch: {full.get('book_code', full.get('book', ''))}"

        reference = full.get("book_code", "") or str(full.get("book", ""))
        section = full.get("section", "")
        if section:
            reference = f"{reference} {section}".strip()

        slug = full.get("slug", "")
        book_slug = full.get("book_slug", "")
        if book_slug and slug:
            source_url = f"https://de.openlegaldata.io/laws/{book_slug}/{slug}"
        elif slug:
            source_url = f"https://de.openlegaldata.io/laws/{slug}"
        else:
            source_url = LegalSource.OPEN_LEGAL_DATA.value

        text_chunk = content[:8000] if len(content) > 8000 else content
        await add_legal_episode(
            text_chunk,
            source_name=LegalSource.OPEN_LEGAL_DATA.value,
            source_url=source_url,
            title=title,
            reference=reference.strip(),
        )
        count += 1

    return count
