"""Seed the Graphiti knowledge graph from all configured legal sources."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.graphiti_client import close_graphiti
from app.ingestion.seed_corpus import seed_legal_corpus


async def main() -> None:
    print("Seeding FineLens knowledge graph from all sources...")
    results = await seed_legal_corpus()
    total = sum(results.values())
    for source, count in results.items():
        print(f"  {source}: {count} episodes")
    print(f"Done. Total: {total} episodes")
    await close_graphiti()


if __name__ == "__main__":
    asyncio.run(main())
