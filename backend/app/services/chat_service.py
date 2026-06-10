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
from app.services.chat_store import append_messages, get_or_create_session
from app.services.form_templates import suggest_forms_for_query
from app.services.law_text import enrich_citations
from app.services.user_store import get_profile

SYSTEM_PROMPT = """Du bist RechtsLens, ein transparenter juristischer Assistent für deutsches Recht.

Regeln:
1. Beantworte Fragen klar und verständlich auf Deutsch.
2. Nenne Gesetzesnormen EXAKT wie im bereitgestellten Kontext (z.B. „§ 558 BGB") — erfinde keine Paragraphen.
3. Verweise auf Quellen NUR mit den exakten Nummern aus dem Kontext: [1], [2], etc.
4. Jede Quellennummer in deiner Antwort muss im Kontext existieren; zitiere nur Quellen, die du tatsächlich verwendest.
5. Gib KEINE verbindliche Rechtsberatung — weise auf einen Anwalt hin bei komplexen Fällen.
6. Wenn ein Formular hilfreich wäre, erwähne es.
7. Formatiere Antworten als Markdown: kurze ###-Überschrift, nummerierte Punkte mit **Fettdruck** für Schlüsselbegriffe, Absätze mit Leerzeile dazwischen.
8. Setze Quellenverweise [1], [2] direkt am Ende des jeweiligen Satzes.
9. Schließe mit einem kurzen >-Hinweis ab, dass dies keine Rechtsberatung ist.
10. Sei ehrlich wenn der Kontext nicht ausreicht."""


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
    context_hits = await search_legal_context(request.message, limit=8)

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

    user_context = ""
    if profile.first_name or profile.legal_topic:
        user_context = (
            f"\nNutzerprofil: {profile.first_name} {profile.last_name}, "
            f"Thema: {profile.legal_topic or 'nicht angegeben'}, "
            f"Fall: {profile.case_description[:300] if profile.case_description else 'nicht beschrieben'}"
        )

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in request.history[-6:]:
        messages.append({"role": msg.role, "content": msg.content})

    prompt = f"""Rechtskontext aus der Wissensdatenbank:
{context_block or '(Noch keine passenden Quellen im Graph — antworte allgemein und weise darauf hin.)'}
{user_context}

Frage des Nutzers: {request.message}

Antworte auf Deutsch im Markdown-Format (### Überschrift, nummerierte Liste mit **Fettdruck**, Quellenverweise [1] am Satzende, abschließender >-Hinweis). Verwende die exakte Gesetzesreferenz und Quellennummer aus dem Kontext."""

    messages.append({"role": "user", "content": prompt})

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    completion = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.3,
    )
    answer = completion.choices[0].message.content or ""

    cited_indices = _extract_cited_indices(answer)
    if cited_indices:
        citations = [c for c in citations if c.ref_number in cited_indices]

    suggested_forms = suggest_forms_for_query(request.message, profile)
    if not suggested_forms and profile.legal_topic:
        suggested_forms = suggest_forms_for_query(profile.legal_topic, profile)

    follow_ups: list[str] = []
    if "miet" in request.message.lower():
        follow_ups = [
            "Welche Fristen gelten für einen Widerspruch?",
            "Brauche ich einen Anwalt für diesen Fall?",
        ]
    elif "datenschutz" in request.message.lower() or "dsgvo" in request.message.lower():
        follow_ups = [
            "Wie lange hat das Unternehmen Zeit zu antworten?",
            "Was tun bei fehlender Antwort?",
        ]

    transparency = (
        f"Diese Antwort basiert auf {len(citations)} Quelle(n) aus der Graphiti-Wissensdatenbank. "
        "Jede Aussage ist auf Episoden mit Provenienz zurückführbar. "
        "Dies ist keine Rechtsberatung."
    )

    try:
        await add_user_episode(
            request.user_id,
            f"Frage: {request.message}\nAntwort-Zusammenfassung: {answer[:500]}",
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
