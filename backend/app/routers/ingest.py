from fastapi import APIRouter, HTTPException

from app.ingestion.bund import ingest_from_bund
from app.ingestion.buzer import ingest_from_buzer
from app.ingestion.gesetze import ingest_from_gesetze
from app.ingestion.oldp import ingest_laws
from app.ingestion.reference import ingest_reference_sources
from app.ingestion.seed_corpus import seed_legal_corpus
from app.models.schemas import IngestRequest, IngestStatus, LegalSource

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("", response_model=IngestStatus)
async def ingest_data(request: IngestRequest) -> IngestStatus:
    try:
        if request.source == LegalSource.OPEN_LEGAL_DATA:
            count = await ingest_laws(request.query, request.limit)
        elif request.source == LegalSource.GESETZE_IM_INTERNET:
            slugs = [request.law_book] if request.law_book else None
            count = await ingest_from_gesetze(request.limit, slugs)
        elif request.source == LegalSource.RECHT_BUND:
            count = await ingest_from_bund(request.query or "BGB", request.limit)
        elif request.source == LegalSource.BUZER:
            count = await ingest_from_buzer(
                request.query,
                request.limit,
                request.law_book or "BGB",
            )
        elif request.source in (LegalSource.BECK_ONLINE, LegalSource.JURIS):
            count = await ingest_reference_sources([request.source])
        else:
            raise HTTPException(status_code=400, detail=f"Unbekannte Quelle: {request.source}")

        return IngestStatus(
            ingested=count,
            source=request.source,
            message=f"{count} Episoden in Graphiti eingespielt.",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion fehlgeschlagen: {e}") from e


@router.post("/seed", response_model=IngestStatus)
async def seed_demo() -> IngestStatus:
    """Seed the knowledge graph from all six configured legal source domains."""
    results = await seed_legal_corpus()
    total = sum(results.values())
    breakdown = ", ".join(f"{src}: {n}" for src, n in results.items() if n)
    return IngestStatus(
        ingested=total,
        source=LegalSource.OPEN_LEGAL_DATA,
        message=f"Graph-Seed abgeschlossen: {total} Episoden ({breakdown}).",
    )
