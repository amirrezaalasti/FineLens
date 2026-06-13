"""Weighted hybrid retrieval with relevance filtering and runtime statute fetch."""

import asyncio
import logging
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
    node_bm25_search,
)
from app.search.query_rewriter import RewrittenQuery, rewrite_query
from app.search.relevance_scorer import rescore_hits, retrieval_quality
from app.ingestion.buzer import buzer_law_slug
from app.ingestion.statute_fetch import build_statute_url
from app.ingestion.statute_fetch import extract_norm_references
from app.search.runtime_law_fetch import fetch_predicted_norms, fetch_runtime_norms

logger = logging.getLogger(__name__)

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

    # Build a direct paragraph URL when the graph hit lacks one.
    if not source_url and reference:
        match = re.search(r"§\s*(\d+[a-z]?)\s*([a-zA-Z]+)", reference)
        if match:
            para = match.group(1)
            law_code = match.group(2).upper()
            source_url = build_statute_url(para, law_code) or ""
    if not source_url and "buzer.de" in source_name.lower():
        if not reference:
            # Try to extract the norm from the fact itself
            ref_match = re.search(r"§\s*(\d+[a-z]?)\s*([a-zA-Z]+)", fact)
            if ref_match:
                reference = ref_match.group(0)
        if reference:
            match = re.search(r"§\s*(\d+[a-z]?)\s*([a-zA-Z]+)", reference)
            if match:
                para = match.group(1)
                law_code = match.group(2).upper()
                source_url = f"https://www.buzer.de/{para}_{buzer_law_slug(law_code)}.htm"

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
            if uid not in hits or hit.get("_runtime") or hit.get("_predicted"):
                hits[uid] = hit

    ordered = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [{**hits[uid], "score": min(score, 1.0)} for uid, score in ordered[: limit * 2]]


def _predicted_norms_cover_candidates(
    predicted_hits: list[dict[str, Any]],
    norm_candidates: list[str],
) -> bool:
    """Check if predicted norm hits cover at least some of the LLM-predicted norms."""
    if not norm_candidates or not predicted_hits:
        return False
    hit_refs = {
        (h.get("law_reference", "") or "").lower().replace(" ", "")
        for h in predicted_hits
    }
    for norm in norm_candidates[:5]:
        norm_key = norm.lower().replace(" ", "").replace("abs.", "").replace("sat.", "")
        para_match = re.search(r"§?(\d+[a-z]?)", norm_key)
        code_match = re.search(r"(owig|stvg|stvo|bgb|stgb|dsgvo|bafoeg|sgbx|sgb)", norm_key)
        if not para_match or not code_match:
            continue
        para, code = para_match.group(1), code_match.group(1)
        for ref in hit_refs:
            if para in ref and code in ref:
                return True
    return False


async def search_legal_context(
    query: str,
    limit: int | None = None,
    history: list = None,
    rewritten: RewrittenQuery | None = None,
) -> list[dict[str, Any]]:
    limit = limit or settings.legal_search_limit

    # ── Step 1: Rewrite the query via LLM to extract legal keywords ──────
    if rewritten is None:
        rewritten = await rewrite_query(query, history=history)
    doc_norms = extract_norm_references(query)
    if doc_norms:
        merged = list(rewritten.norm_candidates)
        for norm in doc_norms:
            if norm not in merged:
                merged.append(norm)
        rewritten.norm_candidates = merged[:8]
    logger.info(
        "Query rewriter: subjects=%s, keywords=%s, norms=%s",
        rewritten.legal_subjects,
        rewritten.search_keywords,
        rewritten.norm_candidates,
    )

    # ── Step 2: Analyze query with rewriter enrichment ───────────────────
    analysis = analyze_query(
        query,
        rewritten_keywords=rewritten.search_keywords,
        norm_candidates=rewritten.norm_candidates,
        legal_subjects=rewritten.legal_subjects,
    )

    graphiti = await get_graphiti()
    driver = graphiti.clients.driver.clone(database=LEGAL_GROUP)
    enhanced = enhance_legal_query(query)
    keyword_enhanced = enhance_legal_query(analysis.keyword_query)
    candidate_limit = limit * 2

    # ── Step 3: Fetch predicted norms from buzer.de IN PARALLEL with graph search
    # This is the highest-signal path: the LLM identified specific norms,
    # and we fetch their exact text directly.
    predicted_norms_task = asyncio.create_task(
        fetch_predicted_norms(rewritten.norm_candidates, limit=limit)
    ) if rewritten.norm_candidates else None

    # ── Step 4–7: Run graph searches in parallel ─────────────────────────
    hybrid_config = (
        citation_first_edge_search(candidate_limit)
        if is_citation_heavy_query(query)
        else legal_hybrid_edge_search(candidate_limit)
    )
    subject_query = rewritten.subject_query
    norm_query = (
        " ".join(rewritten.norm_candidates[:4]) if rewritten.norm_candidates else ""
    )

    search_tasks: list[tuple[str, Any]] = [
        (
            "bm25_full",
            graphiti.search_(
                query=enhanced,
                group_ids=[LEGAL_GROUP],
                config=bm25_only_edge_search(candidate_limit),
                driver=driver,
            ),
        ),
        (
            "bm25_keyword",
            graphiti.search_(
                query=keyword_enhanced,
                group_ids=[LEGAL_GROUP],
                config=bm25_only_edge_search(candidate_limit),
                driver=driver,
            ),
        ),
        (
            "hybrid",
            graphiti.search_(
                query=enhanced,
                group_ids=[LEGAL_GROUP],
                config=hybrid_config,
                driver=driver,
            ),
        ),
    ]
    if subject_query:
        search_tasks.append(
            (
                "node",
                graphiti.search_(
                    query=subject_query,
                    group_ids=[LEGAL_GROUP],
                    config=node_bm25_search(candidate_limit),
                    driver=driver,
                ),
            )
        )
    if norm_query:
        search_tasks.append(
            (
                "norm",
                graphiti.search_(
                    query=norm_query,
                    group_ids=[LEGAL_GROUP],
                    config=bm25_only_edge_search(candidate_limit),
                    driver=driver,
                ),
            )
        )

    search_results = await asyncio.gather(
        *(task for _, task in search_tasks),
        return_exceptions=True,
    )
    results_by_name: dict[str, Any] = {}
    for (name, _), result in zip(search_tasks, search_results):
        if isinstance(result, Exception):
            logger.warning("Graph search '%s' failed: %s", name, result)
            continue
        results_by_name[name] = result

    bm25_full = results_by_name.get("bm25_full")
    bm25_keyword = results_by_name.get("bm25_keyword")
    hybrid_result = results_by_name.get("hybrid")

    node_search_edges: list[tuple[str, dict[str, Any]]] = []
    node_search_nodes: list[tuple[str, dict[str, Any]]] = []
    node_result = results_by_name.get("node")
    if node_result:
        node_search_edges = [
            (edge.uuid, _edge_to_hit(edge, 0.95))
            for edge in node_result.edges
            if getattr(edge, "uuid", None)
        ]
        node_search_nodes = [
            (node.uuid, _node_to_hit(node, 0.85))
            for node in node_result.nodes
            if getattr(node, "uuid", None)
        ]
        logger.info(
            "Node search for '%s': %d edges, %d nodes",
            subject_query,
            len(node_search_edges),
            len(node_search_nodes),
        )

    norm_edges: list[tuple[str, dict[str, Any]]] = []
    norm_result = results_by_name.get("norm")
    if norm_result:
        norm_edges = [
            (edge.uuid, _edge_to_hit(edge, 0.95))
            for edge in norm_result.edges
            if getattr(edge, "uuid", None)
        ]

    # ── Step 8: Collect predicted norm hits ───────────────────────────────
    predicted_hits: list[dict[str, Any]] = []
    if predicted_norms_task is not None:
        try:
            predicted_hits = await predicted_norms_task
            logger.info("Predicted norm fetch returned %d hits", len(predicted_hits))
        except Exception as exc:
            logger.warning("Predicted norm fetch failed: %s", exc)

    # ── Step 9: Merge all ranked lists via weighted RRF ──────────────────
    def to_edge_list(result: Any, base_score: float) -> list[tuple[str, dict[str, Any]]]:
        return [
            (edge.uuid, _edge_to_hit(edge, base_score))
            for edge in result.edges
            if getattr(edge, "uuid", None)
        ]

    ranked_lists: list[tuple[list[tuple[str, dict[str, Any]]], float]] = []
    if bm25_full is not None:
        ranked_lists.append(
            (to_edge_list(bm25_full, 0.9), settings.legal_search_bm25_weight)
        )
    if bm25_keyword is not None:
        ranked_lists.append(
            (to_edge_list(bm25_keyword, 0.95), settings.legal_search_bm25_weight * 1.2)
        )
    if hybrid_result is not None:
        ranked_lists.extend(
            [
                (to_edge_list(hybrid_result, 0.8), 1.0),
                (
                    [
                        (node.uuid, _node_to_hit(node, 0.7))
                        for node in hybrid_result.nodes
                        if getattr(node, "uuid", None)
                    ],
                    0.75,
                ),
            ]
        )

    # Add node-search results with high weight (these are the lex specialis hits)
    if node_search_edges:
        ranked_lists.append((node_search_edges, settings.legal_search_bm25_weight * 1.5))
    if node_search_nodes:
        ranked_lists.append((node_search_nodes, settings.legal_search_bm25_weight))
    # Add norm candidate hits
    if norm_edges:
        ranked_lists.append((norm_edges, settings.legal_search_bm25_weight * 1.3))

    # Add predicted norm hits with HIGHEST weight — these are the direct buzer.de fetches
    # based on LLM-predicted norms, the most reliable source of lex specialis
    if predicted_hits:
        predicted_list = [(h["uuid"], h) for h in predicted_hits]
        ranked_lists.append((predicted_list, settings.legal_search_bm25_weight * 2.0))

    merged = weighted_rrf_merge(ranked_lists, limit=candidate_limit)

    # ── Step 10: Rescore and filter ──────────────────────────────────────
    rescored = rescore_hits(merged, analysis)

    # Determine if we need runtime fallback:
    # - Standard quality check
    # - OR: norm candidates were predicted but none appear in results (graph gap)
    quality = retrieval_quality(rescored)
    graph_has_predicted = _predicted_norms_cover_candidates(rescored, rewritten.norm_candidates)
    needs_runtime = (
        settings.legal_search_runtime_fetch
        and (
            quality < settings.legal_search_min_quality
            or (rewritten.norm_candidates and not graph_has_predicted and not predicted_hits)
        )
    )

    if needs_runtime:
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
