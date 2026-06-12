"""Seed the Graphiti knowledge graph from all configured legal sources."""

import logging

from app.ingestion.bund import ingest_from_bund
from app.ingestion.buzer import bgb_seed_paragraphs, ingest_from_buzer
from app.ingestion.gesetze import ingest_from_gesetze
from app.ingestion.oldp import ingest_laws
from app.ingestion.reference import ingest_reference_sources
from app.models.schemas import LegalSource

logger = logging.getLogger(__name__)

# Diverse OLDP anchors across OWiG and StVG domains (fines, traffic, violations)
OLDP_SEED_QUERIES = [
    "17 OWiG",
    "35 OWiG",
    "24a StVG",
    "21 StVG",
    "28 StVG",
]


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
        3, ["owig", "stvg", "stgb"]
    )

    try:
        results[LegalSource.RECHT_BUND.value] = await ingest_from_bund("Bußgeld Ordnungswidrigkeit", 3)
    except Exception as exc:
        logger.warning("Bund seed failed: %s", exc)
        results[LegalSource.RECHT_BUND.value] = 0

    bgb_paras = bgb_seed_paragraphs()
    results[LegalSource.BUZER.value] = await ingest_from_buzer(
        "", len(bgb_paras), "OWiG"
    )

    results[LegalSource.BECK_ONLINE.value] = await ingest_reference_sources(
        [LegalSource.BECK_ONLINE]
    )
    results[LegalSource.JURIS.value] = await ingest_reference_sources([LegalSource.JURIS])

    total = sum(results.values())
    logger.info("Seed complete: %s episodes (%s)", total, results)
    return results
