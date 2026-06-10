"""Weighted hybrid retrieval with relevance filtering and runtime statute fetch."""

import re
from collections import defaultdict
from typing import Any

from graphiti_core.edges import EntityEdge
from graphiti_core.nodes import EntityNode

from app.config import settings
from app.graphiti_client import LEGAL_GROUP, _parse_provenance, get_graphiti
from app.search.legal_query_analysis import analyze_query
from app.search.legal_search_config import (
    bm25_only_edge_search,
    citation_first_edge_search,
    legal_hybrid_edge_search,
)
from app.search.relevance_scorer import rescore_hits, retrieval_quality
from app.search.runtime_law_fetch import fetch_runtime_norms

_CITATION_RE = re.compile(
    r"§\s*\d|abs\.|satz\s*\d|\b(bgb|stgb|gg|dsgvo|zpo|hgb)\b",
    re.I,
)


def enhance_legal_query(query: str) -> str:
    expanded = query
    expansions = {
        r"\bAbs\.?\s*(\d+)": r"Absatz \1",
        r"\bS\.?\s*(\d+)": r"Satz \1",
        r"\bNr\.?\s*(\d+)": r"Nummer \1",
    }
    for pattern, replacement in expansions.items():
        expanded = re.sub(pattern, replacement, expanded, flags=re.I)
    return expanded


def is_citation_heavy_query(query: str) -> bool:
    return bool(_CITATION_RE.search(query))


def _edge_to_hit(edge: EntityEdge, score: float) -> dict[str, Any]:
    fact = getattr(edge, "fact", "") or getattr(edge, "name", "") or str(edge)
    source_url = ""
    source_name = ""
    title = ""
    reference = ""
    episode_id = getattr(edge, "episode_id", "") or ""

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

    return {
        "fact": fact,
        "source_url": source_url,
        "source": source_name,
        "title": title,
        "law_reference": reference,
        "episode_id": episode_id,
        "score": score,
        "uuid": getattr(edge, "uuid", ""),
    }


def _node_to_hit(node: EntityNode, score: float) -> dict[str, Any]:
    name = getattr(node, "name", "") or str(node)
    summary = getattr(node, "summary", "") or ""
    labels = getattr(node, "labels", []) or []
    label_str = ", ".join(labels) if labels else "Entity"
    return {
        "fact": f"{name}: {summary}" if summary else name,
        "source_url": "",
        "source": "graphiti",
        "title": f"{label_str}: {name}",
        "law_reference": name if "§" in name else "",
        "episode_id": "",
        "score": score,
        "uuid": getattr(node, "uuid", ""),
    }


def weighted_rrf_merge(
    ranked_lists: list[tuple[list[tuple[str, dict[str, Any]]], float]],
    limit: int,
) -> list[dict[str, Any]]:
    scores: dict[str, float] = defaultdict(float)
    hits: dict[str, dict[str, Any]] = {}

    for items, weight in ranked_lists:
        for rank, (uid, hit) in enumerate(items):
            scores[uid] += weight / (rank + 1)
            if uid not in hits or hit.get("_runtime"):
                hits[uid] = hit

    ordered = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [{**hits[uid], "score": min(score, 1.0)} for uid, score in ordered[: limit * 2]]


async def search_legal_context(query: str, limit: int | None = None) -> list[dict[str, Any]]:
    limit = limit or settings.legal_search_limit
    analysis = analyze_query(query)
    graphiti = await get_graphiti()
    driver = graphiti.clients.driver.clone(database=LEGAL_GROUP)
    enhanced = enhance_legal_query(query)
    keyword_enhanced = enhance_legal_query(analysis.keyword_query)
    candidate_limit = limit * 3

    bm25_full = await graphiti.search_(
        query=enhanced,
        group_ids=[LEGAL_GROUP],
        config=bm25_only_edge_search(candidate_limit),
        driver=driver,
    )

    bm25_keyword = await graphiti.search_(
        query=keyword_enhanced,
        group_ids=[LEGAL_GROUP],
        config=bm25_only_edge_search(candidate_limit),
        driver=driver,
    )

    hybrid_config = (
        citation_first_edge_search(candidate_limit)
        if is_citation_heavy_query(query)
        else legal_hybrid_edge_search(candidate_limit)
    )
    hybrid_result = await graphiti.search_(
        query=enhanced,
        group_ids=[LEGAL_GROUP],
        config=hybrid_config,
        driver=driver,
    )

    def to_edge_list(result: Any, base_score: float) -> list[tuple[str, dict[str, Any]]]:
        return [
            (edge.uuid, _edge_to_hit(edge, base_score))
            for edge in result.edges
            if getattr(edge, "uuid", None)
        ]

    merged = weighted_rrf_merge(
        [
            (to_edge_list(bm25_full, 0.9), settings.legal_search_bm25_weight),
            (to_edge_list(bm25_keyword, 0.95), settings.legal_search_bm25_weight * 1.2),
            (to_edge_list(hybrid_result, 0.8), 1.0),
            (
                [
                    (node.uuid, _node_to_hit(node, 0.7))
                    for node in hybrid_result.nodes
                    if getattr(node, "uuid", None)
                ],
                0.75,
            ),
        ],
        limit=candidate_limit,
    )

    rescored = rescore_hits(merged, analysis)

    quality = retrieval_quality(rescored)
    if settings.legal_search_runtime_fetch and quality < settings.legal_search_min_quality:
        runtime_hits = await fetch_runtime_norms(analysis, limit=limit)
        if runtime_hits:
            runtime_list = [
                (h["uuid"], h) for h in rescore_hits(runtime_hits, analysis, min_score=0.01)
            ]
            merged_with_runtime = weighted_rrf_merge(
                [
                    (runtime_list, settings.legal_search_runtime_weight),
                    ([(h["uuid"], h) for h in rescored], 1.0),
                ],
                limit=candidate_limit,
            )
            rescored = rescore_hits(merged_with_runtime, analysis)

    return rescored[:limit]
