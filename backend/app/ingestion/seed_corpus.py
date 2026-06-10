"""Seed the Graphiti knowledge graph from all configured legal sources."""

import logging

from app.ingestion.bund import ingest_from_bund
from app.ingestion.buzer import ingest_from_buzer
from app.ingestion.gesetze import ingest_from_gesetze
from app.ingestion.oldp import ingest_laws
from app.ingestion.reference import ingest_reference_sources
from app.models.schemas import LegalSource

logger = logging.getLogger(__name__)


async def seed_legal_corpus() -> dict[str, int]:
    """Ingest demo corpus from all six configured source domains."""
    results: dict[str, int] = {}

    results[LegalSource.OPEN_LEGAL_DATA.value] = await ingest_laws("558 BGB", 5)
    results[LegalSource.OPEN_LEGAL_DATA.value] += await ingest_laws("15 DSGVO", 3)

    results[LegalSource.GESETZE_IM_INTERNET.value] = await ingest_from_gesetze(
        3, ["bgb", "stgb", "gg"]
    )

    results[LegalSource.RECHT_BUND.value] = await ingest_from_bund("BGB Mietrecht", 3)

    results[LegalSource.BUZER.value] = await ingest_from_buzer("", 5, "BGB")

    results[LegalSource.BECK_ONLINE.value] = await ingest_reference_sources(
        [LegalSource.BECK_ONLINE]
    )
    results[LegalSource.JURIS.value] = await ingest_reference_sources([LegalSource.JURIS])

    total = sum(results.values())
    logger.info("Seed complete: %s episodes (%s)", total, results)
    return results
