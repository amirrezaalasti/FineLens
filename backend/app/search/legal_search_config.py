"""Graphiti search configurations tuned for German legal retrieval."""

from graphiti_core.search.search_config import (
    EdgeReranker,
    EdgeSearchConfig,
    EdgeSearchMethod,
    NodeReranker,
    NodeSearchConfig,
    NodeSearchMethod,
    SearchConfig,
)

from app.config import settings


def _bfs_depth() -> int:
    return settings.legal_search_bfs_depth


def bm25_only_edge_search(limit: int = 20) -> SearchConfig:
    """Keyword-only pass — prioritizes exact § / Abs. / Satz citations."""
    return SearchConfig(
        edge_config=EdgeSearchConfig(
            search_methods=[EdgeSearchMethod.bm25],
            reranker=EdgeReranker.rrf,
        ),
        limit=limit,
    )


def citation_first_edge_search(limit: int = 16) -> SearchConfig:
    """BM25 + deep BFS, no semantic drift for statutory citation queries."""
    return SearchConfig(
        edge_config=EdgeSearchConfig(
            search_methods=[EdgeSearchMethod.bm25, EdgeSearchMethod.bfs],
            reranker=EdgeReranker.rrf,
            bfs_max_depth=_bfs_depth(),
        ),
        node_config=NodeSearchConfig(
            search_methods=[NodeSearchMethod.bm25, NodeSearchMethod.bfs],
            reranker=NodeReranker.rrf,
            bfs_max_depth=_bfs_depth(),
        ),
        limit=limit,
    )


def legal_hybrid_edge_search(limit: int = 16) -> SearchConfig:
    """BM25-heavy hybrid with deep graph traversal for Verweisungsstil."""
    return SearchConfig(
        edge_config=EdgeSearchConfig(
            search_methods=[
                EdgeSearchMethod.bm25,
                EdgeSearchMethod.bfs,
                EdgeSearchMethod.cosine_similarity,
            ],
            reranker=EdgeReranker.rrf,
            bfs_max_depth=_bfs_depth(),
            sim_min_score=0.65,
        ),
        node_config=NodeSearchConfig(
            search_methods=[
                NodeSearchMethod.bm25,
                NodeSearchMethod.bfs,
                NodeSearchMethod.cosine_similarity,
            ],
            reranker=NodeReranker.rrf,
            bfs_max_depth=_bfs_depth(),
            sim_min_score=0.65,
        ),
        limit=limit,
    )


def node_bm25_search(limit: int = 12) -> SearchConfig:
    """Node-level BM25 + BFS — finds LegalSubject/LegalNorm nodes by keyword,
    then traverses graph edges to pull in connected norms and edges.
    No cosine similarity to avoid vector-gravity drift."""
    return SearchConfig(
        node_config=NodeSearchConfig(
            search_methods=[NodeSearchMethod.bm25, NodeSearchMethod.bfs],
            reranker=NodeReranker.rrf,
            bfs_max_depth=_bfs_depth(),
        ),
        edge_config=EdgeSearchConfig(
            search_methods=[EdgeSearchMethod.bm25, EdgeSearchMethod.bfs],
            reranker=EdgeReranker.rrf,
            bfs_max_depth=_bfs_depth(),
        ),
        limit=limit,
    )

