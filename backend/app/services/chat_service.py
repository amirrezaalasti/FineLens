import re

from openai import AsyncOpenAI

from app.config import settings
from app.graphiti_client import add_user_episode, search_legal_context
from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    Citation,
    LegalSource,
    SOURCE_URLS,
    StoredChatMessage,
)
from app.search.query_rewriter import rewrite_query
from app.services.chat_store import append_messages, get_or_create_session
from app.services.form_templates import suggest_forms_for_query
from app.services.law_text import enrich_citations
from app.services.query_router import (
    GUTACHTEN_SYSTEM_PROMPT,
    SIMPLE_SYSTEM_PROMPT,
    AnswerStyle,
    build_user_prompt,
    classify_query,
)
from app.services.user_store import get_profile


def _extract_cited_indices(text: str) -> set[int]:
    return {int(m) for m in re.findall(r"\[(\d+)\]", text)}


def _map_source(name: str) -> LegalSource:
    mapping = {
        "de.openlegaldata.io": LegalSource.OPEN_LEGAL_DATA,
        "gesetze-im-internet.de": LegalSource.GESETZE_IM_INTERNET,
        "recht.bund.de": LegalSource.RECHT_BUND,
        "beck-online.beck.de": LegalSource.BECK_ONLINE,
        "juris.de": LegalSource.JURIS,
        "buzer.de": LegalSource.BUZER,
    }
    for key, source in mapping.items():
        if key in name.lower():
            return source
    return LegalSource.OPEN_LEGAL_DATA


async def generate_answer(request: ChatRequest) -> ChatResponse:
    profile = get_profile(request.user_id)
    session = get_or_create_session(request.user_id, request.session_id)
    answer_style = classify_query(request.message, profile)

    # Run query rewriter to get predicted norms (used for context hints)
    rewritten = await rewrite_query(request.message)

    context_hits = await search_legal_context(
        request.message,
        limit=settings.legal_search_limit,
    )

    citations: list[Citation] = []

    for i, hit in enumerate(context_hits, 1):
        fact = hit.get("fact", "")
        source = _map_source(hit.get("source", ""))
        source_url = hit.get("source_url") or SOURCE_URLS.get(source, "")
        title = hit.get("title", f"Quelle {i}")
        reference = hit.get("law_reference", "")

        citations.append(
            Citation(
                source=source,
                source_url=source_url,
                title=title,
                excerpt=fact,
                law_reference=reference,
                episode_id=hit.get("episode_id", ""),
                confidence=min(hit.get("score", 0.75), 1.0),
                ref_number=i,
            )
        )

    citations = await enrich_citations(citations)

    context_block = ""
    for c in citations:
        context_block += f"\n[{c.ref_number}] {c.title}"
        if c.law_reference:
            context_block += f" ({c.law_reference})"
        context_block += f"\n{c.excerpt}\nURL: {c.source_url}\n"

    # Add predicted norms hint so the LLM knows which norms the system
    # identified as potentially relevant, even if retrieval didn't find them all
    if rewritten.norm_candidates:
        norms_hint = ", ".join(rewritten.norm_candidates)
        context_block += (
            f"\n--- Systemhinweis: Der Suchoptimierer hat folgende Normen als "
            f"potenziell einschlägig identifiziert: {norms_hint}. "
            f"Falls diese Normen oben nicht enthalten sind, prüfe ob du sie "
            f"aus deinem Wissen sicher benennen kannst. ---\n"
        )

    user_context = ""
    if profile.first_name or profile.legal_topic:
        user_context = (
            f"\nNutzerprofil: {profile.first_name} {profile.last_name}, "
            f"Thema: {profile.legal_topic or 'nicht angegeben'}, "
            f"Fall: {profile.case_description[:500] if profile.case_description else 'nicht beschrieben'}"
        )

    system_prompt = (
        GUTACHTEN_SYSTEM_PROMPT
        if answer_style == AnswerStyle.GUTACHTEN
        else SIMPLE_SYSTEM_PROMPT
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in request.history[-6:]:
        messages.append({"role": msg.role, "content": msg.content})

    prompt = build_user_prompt(context_block, user_context, request.message, answer_style)
    messages.append({"role": "user", "content": prompt})

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    completion = await client.chat.completions.create(
        model="gpt-5.5",
        messages=messages,
    )
    answer = completion.choices[0].message.content or ""

    cited_indices = _extract_cited_indices(answer)
    if cited_indices:
        citations = [c for c in citations if c.ref_number in cited_indices]

    suggested_forms = suggest_forms_for_query(request.message, profile)
    if not suggested_forms and profile.legal_topic:
        suggested_forms = suggest_forms_for_query(profile.legal_topic, profile)

    follow_ups: list[str] = []
    follow_ups_marker = "### Mögliche Anschlussfragen:"
    if follow_ups_marker in answer:
        parts = answer.split(follow_ups_marker)
        answer = parts[0].strip()
        follow_ups_text = parts[1].strip()
        for line in follow_ups_text.splitlines():
            clean_line = line.strip().lstrip("-*1234567890. ")
            if clean_line:
                follow_ups.append(clean_line)

    if not follow_ups:
        if answer_style == AnswerStyle.GUTACHTEN:
            follow_ups = [
                "Welche weiteren Tatbestandsmerkmale sind streitig?",
                "Welche Ausnahmen oder Verjährungsfristen gelten?",
            ]
        elif "miet" in request.message.lower():
            follow_ups = [
                "Welche Fristen gelten für einen Widerspruch?",
                "Brauche ich einen Anwalt für diesen Fall?",
            ]
        elif "datenschutz" in request.message.lower() or "dsgvo" in request.message.lower():
            follow_ups = [
                "Wie lange hat das Unternehmen Zeit zu antworten?",
                "Was tun bei fehlender Antwort?",
            ]

    style_label = (
        "Gutachtenstil (Obersatz–Definition–Subsumtion–Ergebnis)"
        if answer_style == AnswerStyle.GUTACHTEN
        else "Standardantwort"
    )
    transparency = (
        f"Diese Antwort ({style_label}) basiert auf {len(citations)} Quelle(n) "
        f"aus der Graphiti-Wissensdatenbank (BM25-gewichtete Hybrid-Suche, BFS-Tiefe "
        f"{settings.legal_search_bfs_depth}). "
        "Dies ist keine Rechtsberatung."
    )

    try:
        await add_user_episode(
            request.user_id,
            f"Frage: {request.message}\nStil: {answer_style.value}\nAntwort-Zusammenfassung: {answer[:500]}",
            label="chat_interaction",
        )
    except Exception:
        pass

    append_messages(
        session.id,
        StoredChatMessage(role="user", content=request.message),
        StoredChatMessage(
            role="assistant",
            content=answer,
            citations=citations,
            transparency_note=transparency,
            suggested_forms=suggested_forms,
        ),
    )

    return ChatResponse(
        answer=answer,
        citations=citations,
        suggested_forms=suggested_forms,
        follow_up_questions=follow_ups,
        transparency_note=transparency,
        session_id=session.id,
    )
