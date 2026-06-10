import re
from html import unescape

import httpx

from app.config import settings
from app.graphiti_client import add_legal_episode
from app.models.schemas import LegalSource

FALLBACK_API_BASES = (
    "https://testphase.rechtsinformationen.bund.de",
    "https://www.rechtsinformationen.bund.de",
)


def _strip_html(html: str) -> str:
    html = re.sub(r"(?is)<script[^>]*>.*?</script>", " ", html)
    html = re.sub(r"(?is)<style[^>]*>.*?</style>", " ", html)
    text = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", unescape(text)).strip()


async def _api_get(path: str, params: dict | None = None) -> dict | list | None:
    bases = [settings.bund_recht_api.rstrip("/")]
    for base in FALLBACK_API_BASES:
        if base not in bases:
            bases.append(base)

    async with httpx.AsyncClient(timeout=45, follow_redirects=True) as client:
        for base in bases:
            url = f"{base}{path}"
            try:
                resp = await client.get(
                    url,
                    params=params,
                    headers={"Accept": "application/json"},
                )
                if resp.status_code == 200:
                    return resp.json()
            except Exception:
                continue
    return None


async def _fetch_content(base: str, content_path: str) -> str:
    if not content_path:
        return ""

    url = content_path if content_path.startswith("http") else f"{base.rstrip('/')}{content_path}"
    async with httpx.AsyncClient(timeout=45, follow_redirects=True) as client:
        try:
            resp = await client.get(url, headers={"Accept": "text/html,application/xml"})
            if resp.status_code != 200:
                return ""
            content_type = resp.headers.get("content-type", "")
            if "html" in content_type or content_path.endswith(".html"):
                return _strip_html(resp.text)[:10000]
            return resp.text[:10000]
        except Exception:
            return ""


def _text_matches(item: dict) -> str:
    matches = item.get("textMatches", [])
    chunks = [m.get("text", "") for m in matches if m.get("text")]
    return "\n".join(chunks)[:10000]


async def search_bund_recht(query: str, limit: int = 10) -> list[dict]:
    data = await _api_get(
        "/v1/legislation",
        {"searchTerm": query, "size": limit, "pageIndex": 0},
    )
    if not isinstance(data, dict):
        return []

    members = data.get("member", [])
    results: list[dict] = []
    for entry in members[:limit]:
        item = entry.get("item", entry)
        title = item.get("name", item.get("title", "Bundesrecht"))
        abbreviation = item.get("abbreviation", "")
        content = _text_matches(entry)

        html_path = ""
        for encoding in item.get("encoding", []):
            if encoding.get("encodingFormat") == "text/html":
                html_path = encoding.get("contentUrl", "")
                break

        results.append(
            {
                "title": title,
                "content": content,
                "html_path": html_path,
                "reference": abbreviation or query,
                "legislation_id": item.get("legislationIdentifier", ""),
            }
        )
    return results


async def ingest_from_bund(query: str = "BGB", limit: int = 5) -> int:
    items = await search_bund_recht(query, limit)
    count = 0
    base = settings.bund_recht_api.rstrip("/")

    for item in items:
        title = item.get("title", "Bundesrecht")
        content = item.get("content", "")
        html_path = item.get("html_path", "")

        if html_path:
            fetched = await _fetch_content(base, html_path)
            if len(fetched) > len(content):
                content = fetched

        if not content:
            content = (
                f"Bundesrecht: {title}. "
                f"Quelle: recht.bund.de / rechtsinformationen.bund.de"
            )

        legislation_id = item.get("legislation_id", "")
        source_url = "https://www.recht.bund.de/de/home/home_node.html"
        if legislation_id:
            source_url = f"https://testphase.rechtsinformationen.bund.de/v1/legislation/{legislation_id}"

        await add_legal_episode(
            content[:10000],
            source_name=LegalSource.RECHT_BUND.value,
            source_url=source_url,
            title=title,
            reference=item.get("reference", query),
        )
        count += 1

    if count == 0 and query:
        await add_legal_episode(
            f"Bundesrecht-Dokumentensuche: {query}. "
            "Quelle: recht.bund.de / rechtsinformationen.bund.de (NeuRIS API).",
            source_name=LegalSource.RECHT_BUND.value,
            source_url="https://www.recht.bund.de/de/home/home_node.html",
            title=f"Suche: {query}",
            reference=query,
        )
        count = 1

    return count
