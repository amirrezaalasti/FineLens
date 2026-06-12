import asyncio
import sys
from pathlib import Path

# Add backend root to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.search.legal_retrieval import search_legal_context
from app.search.query_rewriter import rewrite_query
from app.search.legal_query_analysis import analyze_query

async def main():
    query = (
        "Imker (Beekeeper) Anton owns a colony of bees. One sunny afternoon, the bee swarm unexpectedly "
        "leaves Anton's hive and flies away. Anton immediately notices and starts running after them. "
        "The swarm flies over the fence and settles on an apple tree in the garden of his neighbor, Berta. "
        "Anton, without asking Berta for permission, climbs over her fence and enters her garden to catch "
        "his swarm. While climbing the tree to retrieve the bees, Anton accidentally steps on and destroys "
        "Berta's rare, prized orchids, causing €200 in damage. Before Anton can capture them, the swarm takes "
        "off again and flies two streets over, where they fly directly into an empty, abandoned beehive sitting "
        "in the backyard of Carl. Carl, who used to be a beekeeper, sees this, immediately shuts the entrance "
        "to the hive, and tells Anton: 'Finders keepers! They are in my hive now, so they are my bees.'"
    )
    
    print("--- Query Rewriter ---")
    rewritten = await rewrite_query(query)
    print("Subjects:", rewritten.legal_subjects)
    print("Keywords:", rewritten.search_keywords)
    print("Norm candidates:", rewritten.norm_candidates)
    print("Law codes:", rewritten.law_codes)
    print("Subject Query:", rewritten.subject_query)
    print("Keyword Query:", rewritten.keyword_query)
    
    print("\n--- Query Analysis ---")
    analysis = analyze_query(
        query,
        rewritten_keywords=rewritten.search_keywords,
        norm_candidates=rewritten.norm_candidates,
        legal_subjects=rewritten.legal_subjects,
    )
    print("Salient terms:", analysis.salient_terms)
    print("Law codes:", analysis.law_codes)
    print("Keyword query:", analysis.keyword_query)
    print("Token set:", list(analysis.token_set)[:20])
    
    print("\n--- Searching for query ---")
    hits = await search_legal_context(query, limit=12)
    print(f"Found {len(hits)} hits:")
    for i, h in enumerate(hits, 1):
        print(f"\n[{i}] Score: {h.get('score'):.4f} | Title: {h.get('title')} | Ref: {h.get('law_reference')}")
        print(f"Overlap: {h.get('_overlap', 0):.4f} | Domain factor: {h.get('_domain_factor', 1.0):.4f} | Spec: {h.get('_specificity', 0):.4f} | Norm: {h.get('_norm_match', 0):.4f}")
        print(f"Fact: {h.get('fact')[:200]}...")

if __name__ == "__main__":
    asyncio.run(main())
