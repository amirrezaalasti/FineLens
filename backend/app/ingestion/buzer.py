import re
import xml.etree.ElementTree as ET
from html import unescape

import httpx

from app.graphiti_client import add_legal_episode
from app.models.schemas import LegalSource

BASE_URL = "https://www.buzer.de"

# buzer.de uses mixed-case slugs for some codes (e.g. StVG, not STVG).
_BUZER_LAW_SLUGS: dict[str, str] = {
    "STVG": "StVG",
    "STGB": "StGB",
    "STPO": "StPO",
    "ZPO": "ZPO",
    "AO": "AO",
    "GG": "GG",
    "BGB": "BGB",
    "HGB": "HGB",
    "DSGVO": "DSGVO",
}


def buzer_law_slug(law_code: str) -> str:
    """Return the path segment buzer.de expects for a law code."""
    normalized = law_code.strip().upper()
    return _BUZER_LAW_SLUGS.get(normalized, normalized)

# Diverse clusters for fine, penalty, and civil law seeding
BGB_SEED_CLUSTERS: dict[str, list[str]] = {
    "geldbusse_allgemein": ["17", "18", "19"],
    "verjaehrung": ["31", "32", "33", "34"],
    "einspruchsverfahren": ["67", "68", "69", "70", "71"],
    "verkehrsstrafen_stvg": ["21", "24", "24a"],
    "rechtsbeschwerde": ["79", "80"],
    "eigentum_allgemein": ["903", "985", "986"],
    "tierbesitz_fundrecht": ["958", "959", "960", "961"],
    "mietrecht": ["535", "536", "558", "559"],
}


def bgb_seed_paragraphs() -> list[str]:
    seen: list[str] = []
    for paragraphs in BGB_SEED_CLUSTERS.values():
        for para in paragraphs:
            if para not in seen:
                seen.append(para)
    return seen


DEFAULT_PARAGRAPHS: dict[str, list[str]] = {
    "OWIG": ["17", "35", "67"],
    "BGB": ["903", "823", "558"],
    "STVG": ["21", "24", "24a"],
    "STGB": ["1", "2", "3"],
    "DSGVO": ["15", "17", "77"],
}


def _strip_html(html: str) -> str:
    html = re.sub(r"(?is)<script[^>]*>.*?</script>", " ", html)
    html = re.sub(r"(?is)<style[^>]*>.*?</style>", " ", html)
    text = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", unescape(text)).strip()


def _parse_title(html: str) -> str:
    match = re.search(r"<title>([^<]+)</title>", html, re.I)
    if not match:
        return "buzer.de"
    return unescape(re.sub(r"\s+", " ", match.group(1))).strip()


def _extract_paragraph_text(html: str) -> str:
    section = html
    ad_match = re.search(
        r"google_ad_section_start(.*?)google_ad_section_end",
        html,
        re.S | re.I,
    )
    if ad_match:
        section = ad_match.group(1)

    for block in re.split(r'<div class="g">|<br\s*/?>', section):
        text = _strip_html(block)
        if text.startswith("(1)") or text.startswith("(2)") or text.startswith("Artikel"):
            return text[:10000]
        if len(text) > 120 and "§" in text and "Buzer" not in text:
            return text[:10000]

    description = re.search(r'<meta name="description" content="([^"]+)"', html)
    if description:
        return unescape(description.group(1))[:10000]

    return _strip_html(section)[:10000]


def _parse_query(query: str) -> tuple[str | None, str | None]:
    """Parse queries like '558 BGB' or '§ 15 DSGVO'."""
    cleaned = query.strip().replace("§", "").strip()
    if not cleaned:
        return None, None

    parts = cleaned.split()
    if len(parts) >= 2 and parts[0].replace("a", "").replace("b", "").isdigit():
        return parts[0], parts[-1].upper()
    if len(parts) == 1 and parts[0].isalpha():
        return None, parts[0].upper()
    return None, cleaned.upper()


async def fetch_law_paragraph(paragraph: str, law_code: str) -> tuple[str, str, str]:
    slug = buzer_law_slug(law_code)
    path = f"/{paragraph}_{slug}.htm"
    url = f"{BASE_URL}{path}"
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        resp = await client.get(url, headers={"User-Agent": "FineLens/0.1"})
        resp.raise_for_status()
        html = resp.text

    title = _parse_title(html)
    content = _extract_paragraph_text(html)
    reference = f"§ {paragraph} {law_code.upper()}"
    return title, content, url


async def _fetch_toc_paragraphs(law_code: str, limit: int) -> list[str]:
    slug = buzer_law_slug(law_code)
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        resp = await client.get(
            f"{BASE_URL}/{slug}.htm",
            headers={"User-Agent": "FineLens/0.1"},
        )
        resp.raise_for_status()
        html = resp.text

    links = re.findall(rf'href="(/(\d+[a-z]?)_{re.escape(slug)}\.htm)"', html, re.I)
    seen: set[str] = set()
    paragraphs: list[str] = []
    for _, paragraph in links:
        if paragraph not in seen:
            seen.add(paragraph)
            paragraphs.append(paragraph)
        if len(paragraphs) >= limit:
            break
    return paragraphs


async def _fetch_feed_items(limit: int) -> list[tuple[str, str, str]]:
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        resp = await client.get(
            f"{BASE_URL}/gesetze_feed.xml",
            headers={"User-Agent": "FineLens/0.1"},
        )
        resp.raise_for_status()
        root = ET.fromstring(resp.content)

    items: list[tuple[str, str, str]] = []
    for item in root.findall(".//item")[:limit]:
        title = item.findtext("title", default="Gesetzesänderung")
        link = item.findtext("link", default=BASE_URL)
        description = _strip_html(item.findtext("description", default=""))
        items.append((title, description or title, link))
    return items


async def ingest_from_buzer(
    query: str = "",
    limit: int = 5,
    law_book: str = "OWiG",
) -> int:
    law_code = (law_book or "OWiG").upper()
    paragraph, parsed_law = _parse_query(query)
    if parsed_law:
        law_code = parsed_law

    targets: list[str] = []
    if paragraph:
        targets = [paragraph]
    elif law_code in DEFAULT_PARAGRAPHS:
        targets = DEFAULT_PARAGRAPHS[law_code][:limit]
    else:
        targets = await _fetch_toc_paragraphs(law_code, limit)

    count = 0
    for para in targets[:limit]:
        try:
            title, content, url = await fetch_law_paragraph(para, law_code)
            if not content:
                continue
            await add_legal_episode(
                content,
                source_name=LegalSource.BUZER.value,
                source_url=url,
                title=title,
                reference=f"§ {para} {law_code}",
            )
            count += 1
        except Exception:
            continue

    if count == 0 and not query:
        for title, description, url in (await _fetch_feed_items(limit))[:limit]:
            await add_legal_episode(
                description,
                source_name=LegalSource.BUZER.value,
                source_url=url,
                title=title,
                reference="Gesetzesänderung",
            )
            count += 1

    return count
