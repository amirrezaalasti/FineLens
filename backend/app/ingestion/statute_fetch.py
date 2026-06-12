"""Fetch individual statute paragraphs from gesetze-im-internet.de (primary) or buzer.de."""

import logging
import re
from html import unescape

import httpx

from app.ingestion.buzer import fetch_law_paragraph as fetch_buzer_paragraph
from app.models.schemas import LegalSource

logger = logging.getLogger(__name__)

GESETZE_BASE = "https://www.gesetze-im-internet.de"

# gesetze-im-internet.de directory slugs (not always equal to law code).
_GESETZE_SLUGS: dict[str, str] = {
    "OWIG": "owig_1968",
    "OWI": "owig_1968",
    "STVG": "stvg",
    "STVO": "stvo_2013",
    "BGB": "bgb",
    "STGB": "stgb",
    "HGB": "hgb",
    "ZPO": "zpo",
    "STPO": "stpo",
    "GG": "gg",
    "AO": "ao",
    "DSGVO": "dsgvo",
}

_NORM_REF_RE = re.compile(
    r"§\s*(\d+[a-z]?)\s*(?:Abs\.?\s*\d+)?\s*(?:S\.?\s*\d+)?\s*([A-ZÄÖÜ]{2,10})",
    re.I,
)


def normalize_law_code(law_code: str) -> str:
    return law_code.strip().upper().replace("Ö", "O").replace("Ü", "U").replace("Ä", "A")


def extract_norm_references(text: str, limit: int = 8) -> list[str]:
    """Extract § references from document or query text."""
    if not text:
        return []
    seen: set[str] = set()
    refs: list[str] = []
    for match in _NORM_REF_RE.finditer(text):
        para, code = match.group(1), normalize_law_code(match.group(2))
        ref = f"§ {para} {code}"
        key = ref.lower()
        if key not in seen:
            seen.add(key)
            refs.append(ref)
        if len(refs) >= limit:
            break
    return refs


def _strip_html(html: str) -> str:
    text = re.sub(r"(?is)<script[^>]*>.*?</script>", " ", html)
    text = re.sub(r"(?is)<style[^>]*>.*?</style>", " ", text)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", unescape(text)).strip()


def _extract_gesetze_paragraph_text(html: str) -> str:
    match = re.search(r'class="jnhtml"[^>]*>(.*?)</div>\s*</div>\s*</div>', html, re.S | re.I)
    if not match:
        return _strip_html(html)[:10000]

    block = match.group(1)
    parts = re.findall(r'class="jurAbsatz"[^>]*>(.*?)</div>', block, re.S | re.I)
    if not parts:
        return _strip_html(block)[:10000]

    paragraphs: list[str] = []
    for part in parts:
        text = _strip_html(part)
        if text:
            paragraphs.append(text)
    return "\n".join(paragraphs)[:10000]


def _extract_gesetze_title(html: str, reference: str) -> str:
    match = re.search(r"<title>([^<]+)</title>", html, re.I)
    if match:
        title = unescape(match.group(1)).strip()
        if title and "404" not in title:
            return title
    return reference


async def fetch_gesetze_paragraph(paragraph: str, law_code: str) -> tuple[str, str, str]:
    code = normalize_law_code(law_code)
    slug = _GESETZE_SLUGS.get(code)
    if not slug:
        raise ValueError(f"No gesetze-im-internet slug for {law_code}")

    url = f"{GESETZE_BASE}/{slug}/__{paragraph}.html"
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        resp = await client.get(url, headers={"User-Agent": "FineLens/0.1"})
        resp.raise_for_status()
        html = resp.text

    reference = f"§ {paragraph} {code}"
    title = _extract_gesetze_title(html, reference)
    content = _extract_gesetze_paragraph_text(html)
    return title, content, url


async def fetch_statute_paragraph(paragraph: str, law_code: str) -> tuple[str, str, str, str]:
    """Return (title, content, url, source_name). Prefers gesetze-im-internet for full text."""
    code = normalize_law_code(law_code)
    reference = f"§ {paragraph} {code}"

    if code in _GESETZE_SLUGS:
        try:
            title, content, url = await fetch_gesetze_paragraph(paragraph, code)
            if content and len(content.strip()) >= 40:
                return title, content, url, LegalSource.GESETZE_IM_INTERNET.value
        except Exception as exc:
            logger.debug("gesetze fetch failed for %s: %s", reference, exc)

    try:
        title, content, url = await fetch_buzer_paragraph(paragraph, code)
        if content and len(content.strip()) >= 40 and "weitere Fassungen" not in content:
            return title, content, url, LegalSource.BUZER.value
    except Exception as exc:
        logger.debug("buzer fetch failed for %s: %s", reference, exc)

    raise ValueError(f"Could not fetch statute text for {reference}")
