import httpx
import xml.etree.ElementTree as ET

from app.graphiti_client import add_legal_episode
from app.models.schemas import LegalSource

TOC_URL = "https://www.gesetze-im-internet.de/gii-toc.xml"
BASE_URL = "https://www.gesetze-im-internet.de"


async def _fetch_toc_entries(limit: int) -> list[tuple[str, str, str]]:
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        resp = await client.get(TOC_URL)
        resp.raise_for_status()
        root = ET.fromstring(resp.content)

    entries: list[tuple[str, str, str]] = []
    for item in root.iter():
        if item.tag.endswith("item") or item.tag == "item":
            link = None
            title = ""
            for child in item:
                tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
                if tag == "link":
                    link = child.text
                elif tag in ("title", "titel"):
                    title = child.text or title
            if link and title:
                entries.append((title, link, f"{BASE_URL}/{link}/index.html"))

    if not entries:
        for link_elem in root.iter():
            tag = link_elem.tag.split("}")[-1] if "}" in link_elem.tag else link_elem.tag
            if tag == "link" and link_elem.text:
                slug = link_elem.text.strip("/")
                entries.append((slug.upper(), slug, f"{BASE_URL}/{slug}/index.html"))

    return entries[:limit]


async def _fetch_law_text(slug: str) -> str:
    xml_url = f"{BASE_URL}/{slug}/xml.zip"
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        try:
            resp = await client.get(f"{BASE_URL}/{slug}/index.html")
            if resp.status_code == 200:
                text = resp.text
                if len(text) > 500:
                    return text[:12000]
        except Exception:
            pass

        try:
            resp = await client.get(xml_url)
            if resp.status_code == 200:
                return f"XML-Daten verfügbar unter {xml_url}"
        except Exception:
            pass

    return ""


async def ingest_from_gesetze(limit: int = 5, slugs: list[str] | None = None) -> int:
    count = 0

    if slugs:
        targets = [(s.upper(), s, f"{BASE_URL}/{s}/index.html") for s in slugs]
    else:
        targets = await _fetch_toc_entries(limit)

    for title, slug, url in targets[:limit]:
        content = await _fetch_law_text(slug)
        if not content:
            content = f"Gesetz: {title} — Volltext unter {url}"

        await add_legal_episode(
            content[:10000],
            source_name=LegalSource.GESETZE_IM_INTERNET.value,
            source_url=url,
            title=title,
            reference=slug.upper(),
        )
        count += 1

    return count
