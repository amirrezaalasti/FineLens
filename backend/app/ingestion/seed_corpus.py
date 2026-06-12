"""Seed the Graphiti knowledge graph from all configured legal sources."""

import logging

from app.ingestion.bund import ingest_from_bund
from app.ingestion.buzer import ingest_from_buzer
from app.ingestion.gesetze import ingest_from_gesetze
from app.ingestion.oldp import ingest_laws
from app.ingestion.reference import ingest_reference_sources
from app.ingestion.statute_fetch import fetch_statute_paragraph
from app.graphiti_client import add_legal_episode
from app.models.schemas import LegalSource

logger = logging.getLogger(__name__)

# Diverse OLDP anchors across broad domains + fine/traffic domains
OLDP_SEED_QUERIES = [
    "903 BGB",
    "823 BGB",
    "558 BGB",
    "15 DSGVO",
    "17 OWiG",
    "35 OWiG",
    "67 OWiG",
    "24a StVG",
    "26 StVG",
    "49 StVG",
]

# Key norms fetched with full text from gesetze-im-internet.de
STATUTE_SEED_TARGETS: dict[str, list[str]] = {
    "OWIG": ["17", "31", "35", "67", "68"],
    "STVG": ["21", "24", "24a", "26", "49"],
    "BGB": ["903", "823", "558", "961"],
}


async def ingest_statute_paragraphs(targets: dict[str, list[str]]) -> int:
    count = 0
    for law_code, paragraphs in targets.items():
        for para in paragraphs:
            try:
                title, content, url, source_name = await fetch_statute_paragraph(para, law_code)
                if not content or len(content.strip()) < 30:
                    continue
                await add_legal_episode(
                    content,
                    source_name=source_name,
                    source_url=url,
                    title=title,
                    reference=f"§ {para} {law_code}",
                )
                count += 1
            except Exception as exc:
                logger.warning("Statute seed failed for § %s %s: %s", para, law_code, exc)
    return count


async def seed_legal_corpus() -> dict[str, int]:
    """Ingest a balanced corpus across major BGB domains."""
    results: dict[str, int] = {}

    results[LegalSource.OPEN_LEGAL_DATA.value] = 0
    for query in OLDP_SEED_QUERIES:
        try:
            results[LegalSource.OPEN_LEGAL_DATA.value] += await ingest_laws(query, 2)
        except Exception as exc:
            logger.warning("OLDP seed failed for %s: %s", query, exc)

    results[LegalSource.GESETZE_IM_INTERNET.value] = await ingest_from_gesetze(
        5, ["bgb", "dsgvo", "owig_1968", "stvg", "stgb"]
    )

    try:
        results[LegalSource.RECHT_BUND.value] = await ingest_from_bund("Bußgeld Ordnungswidrigkeit", 3)
    except Exception as exc:
        logger.warning("Bund seed failed: %s", exc)
        results[LegalSource.RECHT_BUND.value] = 0

    results[LegalSource.BUZER.value] = await ingest_from_buzer("", 5, "OWiG")
    results[LegalSource.BUZER.value] += await ingest_from_buzer("", 5, "StVG")
    results[LegalSource.BUZER.value] += await ingest_from_buzer("", 5, "BGB")
    results[LegalSource.GESETZE_IM_INTERNET.value] += await ingest_statute_paragraphs(
        STATUTE_SEED_TARGETS
    )

    results[LegalSource.BECK_ONLINE.value] = await ingest_reference_sources(
        [LegalSource.BECK_ONLINE]
    )
    results[LegalSource.JURIS.value] = await ingest_reference_sources([LegalSource.JURIS])

    total = sum(results.values())
    logger.info("Seed complete: %s episodes (%s)", total, results)
    return results
