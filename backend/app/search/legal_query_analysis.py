"""Extract salient terms and signals from legal queries (domain-agnostic)."""

import re
from dataclasses import dataclass, field

_GERMAN_STOPWORDS = frozenset(
    """
    eine einer eines einem einen und oder der die das den dem des mit von für auf
    bei ist sind war waren wird wurden kann können soll sollen muss müssen nicht
    auch nur noch schon sehr mehr als wie wenn dann dass dies diese dieser diesem
    question questions please assess legal situation specifically answering following
    property law damages trespass rights note discuss context entry into garden
    """.split()
)

_LAW_CODE_RE = re.compile(
    r"\b(BGB|STGB|GG|DSGVO|HGB|ZPO|STPO|AO|VVG|BGB-AT)\b",
    re.I,
)

_QUESTION_BOILERPLATE = re.compile(
    r"(?i)\b(please|question|questions|assess|situation|following|note|discuss)\b"
)


@dataclass
class QueryAnalysis:
    original: str
    salient_terms: list[str] = field(default_factory=list)
    law_codes: list[str] = field(default_factory=list)
    keyword_query: str = ""
    token_set: set[str] = field(default_factory=set)


def _normalize_token(token: str) -> str:
    return token.lower().strip(".,;:!?\"'()[]")


def extract_salient_terms(text: str, max_terms: int = 10) -> list[str]:
    """Extract domain-relevant content words (not scenario-specific lists)."""
    cleaned = _QUESTION_BOILERPLATE.sub(" ", text)
    candidates: list[str] = []

    for match in re.finditer(r"\b[A-ZÄÖÜ][a-zäöüß]{2,}\b", cleaned):
        candidates.append(match.group())

    for match in re.finditer(r"\b[a-zäöüßA-ZÄÖÜ]{4,}\b", cleaned):
        word = match.group()
        norm = _normalize_token(word)
        if norm not in _GERMAN_STOPWORDS and norm not in candidates:
            candidates.append(word)

    seen: set[str] = set()
    unique: list[str] = []
    for term in candidates:
        key = _normalize_token(term)
        if key in seen or len(key) < 4:
            continue
        seen.add(key)
        unique.append(term)
        if len(unique) >= max_terms:
            break
    return unique


def analyze_query(query: str) -> QueryAnalysis:
    law_codes = [m.upper() for m in _LAW_CODE_RE.findall(query)]
    salient = extract_salient_terms(query)
    tokens = {_normalize_token(t) for t in re.findall(r"\b\w{3,}\b", query.lower())}
    tokens -= _GERMAN_STOPWORDS

    keyword_query = " ".join(salient[:8]) if salient else query[:400]

    return QueryAnalysis(
        original=query,
        salient_terms=salient,
        law_codes=law_codes or ["BGB"],
        keyword_query=keyword_query,
        token_set=tokens,
    )
