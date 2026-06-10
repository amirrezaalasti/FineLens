from openai import AsyncOpenAI

from app.config import settings
from app.graphiti_client import add_user_episode, search_legal_context
from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    Citation,
    LegalSource,
    SOURCE_URLS,
)
from app.services.form_templates import suggest_forms_for_query
from app.services.user_store import get_profile

SYSTEM_PROMPT = """Du bist RechtsLens, ein transparenter juristischer Assistent für deutsches Recht.

Regeln:
1. Beantworte Fragen klar und verständlich auf Deutsch.
2. Zitiere IMMER die relevanten Gesetzesnormen (z.B. § 558 BGB).
3. Verweise auf die bereitgestellten Quellen im Kontext.
4. Gib KEINE verbindliche Rechtsberatung — weise auf einen Anwalt hin bei komplexen Fällen.
5. Wenn ein Formular hilfreich wäre, erwähne es.
6. Strukturiere Antworten mit kurzen Absätzen und Aufzählungen wo sinnvoll.
7. Sei ehrlich wenn der Kontext nicht ausreicht."""


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
    context_hits = await search_legal_context(request.message, limit=8)

    context_block = ""
    citations: list[Citation] = []

    for i, hit in enumerate(context_hits, 1):
        fact = hit.get("fact", "")
        source = _map_source(hit.get("source", ""))
        source_url = hit.get("source_url") or SOURCE_URLS.get(source, "")
        title = hit.get("title", f"Quelle {i}")
        reference = hit.get("law_reference", "")

        context_block += f"\n[{i}] {title}"
        if reference:
            context_block += f" ({reference})"
        context_block += f"\n{fact}\nURL: {source_url}\n"

        citations.append(
            Citation(
                source=source,
                source_url=source_url,
                title=title,
                excerpt=fact[:500],
                law_reference=reference,
                episode_id=hit.get("episode_id", ""),
                confidence=min(hit.get("score", 0.75), 1.0),
            )
        )

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

Antworte auf Deutsch mit klaren Quellenverweisen [1], [2], etc."""

    messages.append({"role": "user", "content": prompt})

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    completion = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.3,
        max_tokens=1500,
    )
    answer = completion.choices[0].message.content or ""

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

    return ChatResponse(
        answer=answer,
        citations=citations,
        suggested_forms=suggested_forms,
        follow_up_questions=follow_ups,
        transparency_note=transparency,
    )
