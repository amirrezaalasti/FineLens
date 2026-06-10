"""Reference index episodes for licensed legal databases (no full-text scraping)."""

from app.graphiti_client import add_legal_episode
from app.models.schemas import LegalSource, SOURCE_URLS

REFERENCE_ENTRIES: dict[LegalSource, list[tuple[str, str, str]]] = {
    LegalSource.BECK_ONLINE: [
        (
            "Beck-Online Kommentare",
            "beck-online bietet kommentierte Gesetze, Rechtsprechung und Fachzeitschriften. "
            "Für Volltext-Zugriff ist eine Campus- oder Institutslizenz erforderlich.",
            "https://beck-online.beck.de/Home",
        ),
        (
            "BGB Kommentar (Referenz)",
            "beck-online enthält ausführliche Kommentare zum BGB einschließlich Mietrecht (§§ 535 ff.), "
            "Schuldrecht und Deliktsrecht — als Referenzquelle für vertiefende Recherche.",
            "https://beck-online.beck.de/",
        ),
    ],
    LegalSource.JURIS: [
        (
            "juris Rechtsdatenbank",
            "juris (Bundesanzeiger Verlag) bündelt Urteile, Gesetze und Zeitschriften. "
            "Vollzugriff erfordert in der Regel ein Abonnement.",
            "https://www.juris.de/jportal/nav/index.jsp",
        ),
        (
            "juris Urteile BGH/BVerfG (Referenz)",
            "Über juris sind Entscheidungen des BGH, BVerfG und weiterer Gerichte recherchierbar. "
            "RechtsLens verweist hierauf als ergänzende Referenzquelle.",
            "https://www.juris.de/",
        ),
    ],
}


async def ingest_reference_sources(sources: list[LegalSource] | None = None) -> int:
    targets = sources or list(REFERENCE_ENTRIES.keys())
    count = 0

    for source in targets:
        entries = REFERENCE_ENTRIES.get(source, [])
        base_url = SOURCE_URLS.get(source, "")
        for title, content, url in entries:
            await add_legal_episode(
                content,
                source_name=source.value,
                source_url=url or base_url,
                title=title,
                reference="Referenzindex",
                metadata={"access_type": "license_required", "reference_only": True},
            )
            count += 1

    return count
