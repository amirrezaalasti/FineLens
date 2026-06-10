"""Seed the Graphiti knowledge graph from all configured legal sources."""

import logging

from app.ingestion.bund import ingest_from_bund
from app.ingestion.buzer import bgb_seed_paragraphs, ingest_from_buzer
from app.ingestion.gesetze import ingest_from_gesetze
from app.ingestion.oldp import ingest_laws
from app.ingestion.reference import ingest_reference_sources
from app.models.schemas import LegalSource

logger = logging.getLogger(__name__)

# Diverse OLDP anchors across BGB domains (generalized, not single-topic)
OLDP_SEED_QUERIES = [
    "903 BGB",
    "823 BGB",
    "961 BGB",
    "812 BGB",
    "558 BGB",
    "15 DSGVO",
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
        3, ["bgb", "stgb", "gg"]
    )

    try:
        results[LegalSource.RECHT_BUND.value] = await ingest_from_bund("BGB Eigentum", 3)
    except Exception as exc:
        logger.warning("Bund seed failed: %s", exc)
        results[LegalSource.RECHT_BUND.value] = 0

    bgb_paras = bgb_seed_paragraphs()
    results[LegalSource.BUZER.value] = await ingest_from_buzer(
        "", len(bgb_paras), "BGB"
    )

    results[LegalSource.BECK_ONLINE.value] = await ingest_reference_sources(
        [LegalSource.BECK_ONLINE]
    )
    results[LegalSource.JURIS.value] = await ingest_reference_sources([LegalSource.JURIS])

    total = sum(results.values())
    logger.info("Seed complete: %s episodes (%s)", total, results)
    return results
