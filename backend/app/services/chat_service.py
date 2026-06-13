import re

from openai import AsyncOpenAI

from app.config import settings
from app.graphiti_client import add_user_episode, search_legal_context
from app.models.schemas import (
    Attachment,
    ChatRequest,
    ChatResponse,
    Citation,
    LegalSource,
    SOURCE_URLS,
    StoredChatMessage,
)
from app.search.query_rewriter import rewrite_query
from app.services.chat_store import append_messages, get_or_create_session
from app.services.form_templates import (
    format_forms_section,
    suggest_forms_for_context,
)
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


def _build_search_query(message: str, attachments: list[Attachment]) -> str:
    """Include uploaded document text so retrieval/rewriter see the full case."""
    parts = [message.strip()] if message.strip() else []
    for att in attachments:
        if att.content:
            parts.append(f"--- {att.name} ---\n{att.content[:4000]}")
    return "\n\n".join(parts)


_EMPTY_DOC_RE = re.compile(
    r"\[(?:Leeres|leeres).*(?:PDF|pdf).*(?:extrahiert|extracted).*\]",
    re.I,
)

_FINE_DOC_HINTS = re.compile(
    r"\b(bußgeld|bussgeld|fine|geschwindigkeit|speeding|owi|verkehr|traffic|strafzettel)\b",
    re.I,
)

_DEFAULT_FINE_NORMS = [
    "§ 24 StVG",
    "§ 24a StVG",
    "§ 49 StVG",
    "§ 67 OWiG",
    "§ 26 StVG",
]

_BAFOEG_DOC_HINTS = re.compile(
    r"\b(bafög|bafoeg|ausbildungsförderung|rückbescheid|darlehenskasse|bva|bundesverwaltungsamt)\b",
    re.I,
)

_DEFAULT_BAFOEG_NORMS = [
    "§ 20 BAföG",
    "§ 50 BAföG",
    "§ 45 SGB X",
]


def _infer_norms_from_attachments(
    message: str, attachments: list[Attachment]
) -> list[str]:
    """When document text is missing, infer likely norms from filename and message."""
    blob = message.lower()
    for att in attachments:
        blob += f" {att.name.lower()} {(att.content or '')[:500].lower()}"

    if _EMPTY_DOC_RE.search(blob) or (
        attachments and all(len(a.content or "") < 80 for a in attachments)
    ):
        if _FINE_DOC_HINTS.search(blob):
            return list(_DEFAULT_FINE_NORMS)
        if _BAFOEG_DOC_HINTS.search(blob):
            return list(_DEFAULT_BAFOEG_NORMS)
    return []


def _detect_response_language(message: str) -> str:
    german_markers = re.search(
        r"\b(erkläre|erklär|dokument|bitte|was|wie|bescheid|sachverhalt|recht)\b",
        message,
        re.I,
    )
    english_markers = re.search(
        r"\b(explain|document|please|what|how|objection|fine|ticket)\b",
        message,
        re.I,
    )
    if english_markers and not german_markers:
        return "en"
    return "de"


def _resolve_language(request: ChatRequest, profile) -> str:
    if request.language in ("de", "en"):
        return request.language
    pref = getattr(profile, "preferred_language", None)
    if pref in ("de", "en"):
        return pref
    return _detect_response_language(request.message)


def _insert_forms_section(answer: str, forms_section: str) -> str:
    """Insert form suggestions before follow-up questions, or at the end."""
    marker = "### Mögliche Anschlussfragen:"
    en_marker = "### Possible follow-up questions:"
    for m in (marker, en_marker):
        if m in answer:
            parts = answer.split(m, 1)
            return f"{parts[0].rstrip()}\n\n{forms_section}\n\n{m}{parts[1]}"
    return f"{answer.rstrip()}\n\n{forms_section}"


def _map_source(name: str) -> LegalSource:
    mapping = {
        "de.openlegaldata.io": LegalSource.OPEN_LEGAL_DATA,
        "gesetze-im-internet.de": LegalSource.GESETZE_IM_INTERNET,
        "www.gesetze-im-internet.de": LegalSource.GESETZE_IM_INTERNET,
        "recht.bund.de": LegalSource.RECHT_BUND,
        "beck-online.beck.de": LegalSource.BECK_ONLINE,
        "juris.de": LegalSource.JURIS,
        "buzer.de": LegalSource.BUZER,
    }
    for key, source in mapping.items():
        if key in name.lower():
            return source
    return LegalSource.OPEN_LEGAL_DATA


async def generate_answer(
    request: ChatRequest, *, persist: bool = True
) -> ChatResponse:
    profile = get_profile(request.user_id)
    session = (
        await get_or_create_session(request.user_id, request.session_id)
        if persist
        else None
    )
    answer_style = classify_query(request.message, profile)

    search_query = _build_search_query(request.message, request.attachments)
    inferred_norms = _infer_norms_from_attachments(request.message, request.attachments)
    if inferred_norms:
        search_query += (
            "\n\nRelevante Normen (aus Dokumenttyp abgeleitet): "
            + ", ".join(inferred_norms)
        )

    # Run query rewriter to get predicted norms (used for context hints)
    rewritten = await rewrite_query(search_query, history=request.history)

    context_hits = await search_legal_context(
        search_query,
        limit=settings.legal_search_limit,
        history=request.history,
    )

    # Drop low-relevance graph hits; keep runtime/predicted statute fetches
    context_hits = [
        h
        for h in context_hits
        if h.get("_predicted") or h.get("_runtime") or h.get("score", 0) >= 0.15
    ]

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
        content = msg.content
        if msg.attachments:
            attachment_text = "\nAngehängte Dokumente / Dateien:\n"
            for att in msg.attachments:
                attachment_text += f"--- DATEI: {att.name} ({att.file_type}) ---\n{att.content}\n--- ENDE DATEI ---\n"
            content = f"{content}\n{attachment_text}"
        messages.append({"role": msg.role, "content": content})

    current_message_content = request.message
    if request.attachments:
        attachment_text = "\nAngehängte Dokumente / Dateien:\n"
        for att in request.attachments:
            attachment_text += f"--- DATEI: {att.name} ({att.file_type}) ---\n{att.content}\n--- ENDE DATEI ---\n"
        current_message_content = f"{current_message_content}\n{attachment_text}"

    prompt = build_user_prompt(
        context_block, user_context, current_message_content, answer_style
    )
    messages.append({"role": "user", "content": prompt})

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    completion = await client.chat.completions.create(
        model=settings.openai_chat_model,
        messages=messages,
    )
    answer = completion.choices[0].message.content or ""

    cited_indices = _extract_cited_indices(answer)
    if cited_indices:
        citations = [c for c in citations if c.ref_number in cited_indices]

    suggested_forms = suggest_forms_for_context(
        request.message,
        profile,
        attachments=request.attachments,
        max_forms=3,
        language=_resolve_language(request, profile),
    )
    if not suggested_forms and profile.legal_topic:
        suggested_forms = suggest_forms_for_context(
            profile.legal_topic,
            profile,
            attachments=request.attachments,
            max_forms=2,
            language=_resolve_language(request, profile),
        )

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

    if suggested_forms and request.attachments:
        lang = _resolve_language(request, profile)
        forms_section = format_forms_section(suggested_forms, language=lang)
        if forms_section and forms_section not in answer:
            answer = _insert_forms_section(answer, forms_section)

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
        elif (
            "datenschutz" in request.message.lower()
            or "dsgvo" in request.message.lower()
        ):
            follow_ups = [
                "Wie lange hat das Unternehmen Zeit zu antworten?",
                "Was tun bei fehlender Antwort?",
            ]
        elif request.attachments and suggested_forms:
            follow_ups = [
                "Welche Frist gilt für den Einspruch?",
                "Soll ich Akteneinsicht beantragen?",
                "Was passiert nach dem Einspruch?",
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

    if persist:
        try:
            await add_user_episode(
                request.user_id,
                f"Frage: {request.message}\nStil: {answer_style.value}\nAntwort-Zusammenfassung: {answer[:500]}",
                label="chat_interaction",
            )
        except Exception:
            pass

        await append_messages(
            session.id,
            StoredChatMessage(
                role="user",
                content=request.message,
                attachments=request.attachments,
            ),
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
        session_id=session.id if session else "",
    )
