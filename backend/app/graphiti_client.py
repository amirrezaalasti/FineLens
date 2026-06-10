import logging
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from graphiti_core.nodes import EpisodeType

from app.config import settings

logger = logging.getLogger(__name__)

_graphiti = None
_graph_backend_in_use: str | None = None


def _apply_env() -> None:
    os.environ.setdefault("OPENAI_API_KEY", settings.openai_api_key)
    os.environ["GRAPHITI_TELEMETRY_ENABLED"] = str(settings.graphiti_telemetry_enabled).lower()
    os.environ["SEMAPHORE_LIMIT"] = str(settings.semaphore_limit)


async def _verify_falkordb_server(host: str, port: int) -> None:
    """Ensure the target speaks FalkorDB graph commands, not plain Redis."""
    from redis.asyncio import Redis

    client = Redis(host=host, port=port)
    try:
        await client.execute_command("GRAPH.QUERY", "default_db", "RETURN 1")
    except Exception as exc:
        msg = str(exc)
        if "GRAPH.QUERY" in msg or "unknown command" in msg.lower():
            raise RuntimeError(
                f"Port {port} on {host} is plain Redis, not FalkorDB. "
                "Start FalkorDB with `docker compose up -d` (maps to host port 6380), "
                "or set GRAPH_BACKEND=embedded in .env for a local embedded graph."
            ) from exc
        raise RuntimeError(f"Cannot reach FalkorDB at {host}:{port}: {exc}") from exc
    finally:
        await client.aclose()


def _create_embedded_driver():
    from graphiti_core.driver.falkordb_driver import FalkorDriver
    from redislite.async_falkordb_client import AsyncFalkorDB

    db_path = Path(settings.embedded_db_path)
    if not db_path.is_absolute():
        db_path = Path(__file__).resolve().parent.parent / db_path
    db_path.parent.mkdir(parents=True, exist_ok=True)

    client = AsyncFalkorDB(dbfilename=str(db_path))
    return FalkorDriver(falkor_db=client)


async def get_graphiti():
    global _graphiti, _graph_backend_in_use
    if _graphiti is not None:
        return _graphiti

    _apply_env()

    from graphiti_core import Graphiti

    backend = settings.graph_backend.lower()

    if backend == "neo4j":
        _graphiti = Graphiti(
            settings.neo4j_uri,
            settings.neo4j_user,
            settings.neo4j_password,
        )
        _graph_backend_in_use = "neo4j"
    elif backend == "embedded":
        driver = _create_embedded_driver()
        _graphiti = Graphiti(graph_driver=driver)
        _graph_backend_in_use = "embedded"
        logger.info("Graphiti using embedded FalkorDB Lite at %s", settings.embedded_db_path)
    else:
        await _verify_falkordb_server(settings.falkordb_host, settings.falkordb_port)
        from graphiti_core.driver.falkordb_driver import FalkorDriver

        driver = FalkorDriver(
            host=settings.falkordb_host,
            port=settings.falkordb_port,
        )
        _graphiti = Graphiti(graph_driver=driver)
        _graph_backend_in_use = "falkordb"
        logger.info(
            "Graphiti connected to FalkorDB at %s:%s",
            settings.falkordb_host,
            settings.falkordb_port,
        )

    await _graphiti.build_indices_and_constraints()
    return _graphiti


def get_graph_backend_in_use() -> str | None:
    return _graph_backend_in_use


async def close_graphiti() -> None:
    global _graphiti, _graph_backend_in_use
    if _graphiti is not None:
        driver = _graphiti.driver
        if _graph_backend_in_use == "embedded":
            falkor_client = getattr(driver, "client", None)
            redis_client = getattr(falkor_client, "client", None) if falkor_client else None
            sync_client = getattr(redis_client, "_sync_client", None) if redis_client else None
            if sync_client is not None:
                sync_client._async_managed = False
                sync_client.shutdown(save=True, now=True, force=True)
            elif falkor_client is not None and hasattr(falkor_client, "close"):
                await falkor_client.close()
        else:
            await _graphiti.close()
        _graphiti = None
        _graph_backend_in_use = None


async def graph_episode_count() -> int:
    graphiti = await get_graphiti()
    try:
        graph = graphiti.driver.client.select_graph(LEGAL_GROUP)
        result = await graph.query("MATCH (e:Episodic) RETURN count(e)")
        if result.result_set:
            return int(result.result_set[0][0])
    except Exception:
        pass
    return 0


LEGAL_GROUP = "german_legal_corpus"
USER_GROUP_PREFIX = "user_"

_PROVENANCE_RE = re.compile(
    r"\[Quelle:\s*([^|\]]+?)\s*\|\s*([^|\]]+?)(?:\s*\|\s*([^|\]]+?))?\s*\|\s*URL:\s*([^\]]+)\]",
    re.I,
)


def _parse_provenance(text: str) -> dict[str, str]:
    match = _PROVENANCE_RE.search(text)
    if not match:
        return {}
    return {
        "source": match.group(1).strip(),
        "title": match.group(2).strip(),
        "law_reference": (match.group(3) or "").strip(),
        "source_url": match.group(4).strip(),
    }


def user_group(user_id: str) -> str:
    return f"{USER_GROUP_PREFIX}{user_id}"


async def add_legal_episode(
    content: str,
    *,
    source_name: str,
    source_url: str,
    title: str,
    reference: str = "",
    metadata: dict[str, Any] | None = None,
) -> str:
    graphiti = await get_graphiti()
    episode_id = str(uuid.uuid4())

    header = f"[Quelle: {source_name} | {title}"
    if reference:
        header += f" | {reference}"
    header += f" | URL: {source_url}]"

    body = metadata or {}
    body.update(
        {
            "source": source_name,
            "source_url": source_url,
            "title": title,
            "law_reference": reference,
        }
    )

    await graphiti.add_episode(
        name=episode_id,
        episode_body=f"{header}\n\n{content}",
        source=EpisodeType.text,
        source_description=f"{source_name}: {title}",
        reference_time=datetime.now(timezone.utc),
        group_id=LEGAL_GROUP,
    )
    return episode_id


async def add_user_episode(user_id: str, content: str, label: str = "user_context") -> str:
    graphiti = await get_graphiti()
    episode_id = str(uuid.uuid4())
    await graphiti.add_episode(
        name=episode_id,
        episode_body=content,
        source=EpisodeType.text,
        source_description=label,
        reference_time=datetime.now(timezone.utc),
        group_id=user_group(user_id),
    )
    return episode_id


async def search_legal_context(query: str, limit: int = 8) -> list[dict[str, Any]]:
    graphiti = await get_graphiti()
    driver = graphiti.clients.driver.clone(database=LEGAL_GROUP)

    try:
        from graphiti_core.search.search_config_recipes import EDGE_HYBRID_SEARCH_CROSS_ENCODER

        search_config = EDGE_HYBRID_SEARCH_CROSS_ENCODER
        search_config.limit = limit
        results_obj = await graphiti.search_(
            query=query,
            group_ids=[LEGAL_GROUP],
            config=search_config,
            driver=driver,
        )
        results = results_obj.edges
    except Exception:
        results = await graphiti.search(
            query=query,
            group_ids=[LEGAL_GROUP],
            num_results=limit,
            driver=driver,
        )

    citations: list[dict[str, Any]] = []

    for edge in results:
        fact = getattr(edge, "fact", "") or getattr(edge, "name", "") or str(edge)
        source_url = ""
        source_name = ""
        title = ""
        reference = ""
        episode_id = ""

        for attr in ("attributes", "metadata", "custom_attributes"):
            meta = getattr(edge, attr, None)
            if isinstance(meta, dict):
                source_url = meta.get("source_url", source_url)
                source_name = meta.get("source", source_name)
                title = meta.get("title", title)
                reference = meta.get("law_reference", reference)

        provenance = _parse_provenance(fact)
        source_name = source_name or provenance.get("source", "")
        title = title or provenance.get("title", "")
        reference = reference or provenance.get("law_reference", "")
        source_url = source_url or provenance.get("source_url", "")

        if fact.startswith("[Quelle:"):
            body_start = fact.find("]\n\n")
            if body_start != -1:
                fact = fact[body_start + 3 :]

        citations.append(
            {
                "fact": fact,
                "source_url": source_url,
                "source": source_name,
                "title": title,
                "law_reference": reference,
                "episode_id": episode_id,
                "score": getattr(edge, "score", 0.75),
            }
        )

    if not citations:
        try:
            node_results = await graphiti.search(
                query=query,
                group_ids=[LEGAL_GROUP],
                num_results=limit,
                driver=driver,
            )
            for node in node_results:
                name = getattr(node, "name", "") or str(node)
                summary = getattr(node, "summary", "") or ""
                citations.append(
                    {
                        "fact": f"{name}: {summary}" if summary else name,
                        "source_url": "",
                        "source": "graphiti",
                        "title": name,
                        "law_reference": "",
                        "episode_id": "",
                        "score": 0.6,
                    }
                )
        except Exception:
            pass

    return citations
