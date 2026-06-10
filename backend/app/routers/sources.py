from fastapi import APIRouter

from app.graphiti_client import get_graph_backend_in_use, get_graphiti
from app.models.schemas import HealthResponse, LegalSource, SOURCE_URLS, SourceInfo

router = APIRouter(tags=["sources"])


SOURCE_DESCRIPTIONS = {
    LegalSource.GESETZE_IM_INTERNET: (
        "Offizielle Gesetzestexte des Bundes — XML/HTML über gii-toc.xml",
        "Öffentlich",
        "aktiv",
    ),
    LegalSource.RECHT_BUND: (
        "Bundesrechtssammlung mit REST-API (rechtsinformationen.bund.de)",
        "Öffentlich",
        "aktiv",
    ),
    LegalSource.BECK_ONLINE: (
        "Kommentierte Rechtsdatenbank — Lizenzpflichtig, Referenzintegration",
        "Lizenz",
        "referenz",
    ),
    LegalSource.JURIS: (
        "Bundesanzeiger Verlag — Urteile und Normen, teils kostenpflichtig",
        "Lizenz",
        "referenz",
    ),
    LegalSource.BUZER: (
        "Gesetzestexte mit Änderungshistorie — §-weise über buzer.de",
        "Öffentlich",
        "aktiv",
    ),
    LegalSource.OPEN_LEGAL_DATA: (
        "Open Legal Data API — Urteile und Gesetze, maschinenlesbar",
        "API (frei lesbar)",
        "aktiv",
    ),
}


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    graph_ok = False
    backend = None
    try:
        await get_graphiti()
        graph_ok = True
        backend = get_graph_backend_in_use()
    except Exception:
        graph_ok = False

    sources = []
    for src in LegalSource:
        desc, access, status = SOURCE_DESCRIPTIONS[src]
        sources.append(
            SourceInfo(
                id=src,
                name=src.value,
                url=SOURCE_URLS[src],
                description=desc,
                access_type=access,
                status=status,
            )
        )

    return HealthResponse(
        status="ok" if graph_ok else "degraded",
        graph_connected=graph_ok,
        graph_backend=backend,
        sources=sources,
    )
