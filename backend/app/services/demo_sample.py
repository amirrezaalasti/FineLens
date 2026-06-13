"""Cached BAföG sample document demo — LLM runs once per language, result is reused."""

from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path

from fastapi import UploadFile

from app.config import settings
from app.models.schemas import (
    Attachment,
    ChatRequest,
    ChatResponse,
    ChatSession,
    StoredChatMessage,
)
from app.routers.chat import extract_file_content
from app.services.chat_service import generate_answer
from app.services.chat_store import (
    append_messages,
    create_session,
    get_session,
    list_sessions,
    replace_session_messages,
)

SAMPLE_PDF = Path(__file__).resolve().parents[2] / "samples" / "BAfoeg_Rueckbescheid_Beispiel.pdf"
CACHE_VERSION = "5"
PROMPT_VERSION = "2"
DEMO_LANGUAGES = ("de", "en")

DEMO_CONFIG: dict[str, dict[str, str]] = {
    "de": {
        "query": (
            "Ich habe diesen BAföG-Rückbescheid erhalten. "
            "Was bedeutet das für mich und welche Optionen habe ich?"
        ),
        "title": "BAföG Beispiel",
    },
    "en": {
        "query": (
            "I received this BAföG repayment notice. "
            "What does it mean for me and what options do I have?"
        ),
        "title": "BAföG Sample",
    },
}

_ALL_DEMO_QUERIES = {cfg["query"] for cfg in DEMO_CONFIG.values()}
_ALL_DEMO_TITLES = {cfg["title"] for cfg in DEMO_CONFIG.values()}


def _normalize_language(language: str) -> str:
    return language if language in DEMO_CONFIG else "de"


def _cache_file(language: str) -> Path:
    return settings.data_dir_path / f"bafog_demo_cache_{_normalize_language(language)}.json"


def _load_cache(language: str) -> dict | None:
    cache_file = _cache_file(language)
    if not cache_file.exists():
        return None
    try:
        data = json.loads(cache_file.read_text(encoding="utf-8"))
        if data.get("cache_version") != CACHE_VERSION:
            return None
        if data.get("prompt_version") != PROMPT_VERSION:
            return None
        return data
    except json.JSONDecodeError:
        return None


def _save_cache(language: str, data: dict) -> None:
    settings.data_dir_path.mkdir(parents=True, exist_ok=True)
    cache_file = _cache_file(language)
    cache_file.write_text(
        json.dumps(data, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )


async def _build_demo_cache(language: str) -> dict:
    language = _normalize_language(language)
    config = DEMO_CONFIG[language]

    if not SAMPLE_PDF.exists():
        raise FileNotFoundError(f"Sample PDF not found: {SAMPLE_PDF}")

    pdf_bytes = SAMPLE_PDF.read_bytes()
    upload = UploadFile(
        file=BytesIO(pdf_bytes),
        filename=SAMPLE_PDF.name,
        headers={"content-type": "application/pdf"},
    )
    analysis = await extract_file_content(upload)
    attachment = Attachment(
        name=SAMPLE_PDF.name,
        content=analysis.raw_text,
        file_type="application/pdf",
        analysis=analysis,
    )

    chat_response: ChatResponse = await generate_answer(
        ChatRequest(
            message=config["query"],
            user_id="default",
            attachments=[attachment],
            language=language,
        ),
        persist=False,
    )

    data = {
        "cache_version": CACHE_VERSION,
        "prompt_version": PROMPT_VERSION,
        "language": language,
        "query": config["query"],
        "title": config["title"],
        "attachment": attachment.model_dump(mode="json"),
        "answer": chat_response.answer,
        "citations": [c.model_dump(mode="json") for c in chat_response.citations],
        "suggested_forms": [f.model_dump(mode="json") for f in chat_response.suggested_forms],
        "follow_up_questions": chat_response.follow_up_questions,
        "transparency_note": chat_response.transparency_note,
    }
    _save_cache(language, data)
    return data


async def get_bafog_demo_data(language: str = "de") -> dict:
    language = _normalize_language(language)
    cached = _load_cache(language)
    if cached:
        return cached
    return await _build_demo_cache(language)


async def _build_demo_messages(language: str) -> tuple[StoredChatMessage, StoredChatMessage]:
    demo = await get_bafog_demo_data(language)
    attachment = Attachment(**demo["attachment"])

    from app.models.schemas import Citation, LegalForm

    citations = [Citation(**c) for c in demo.get("citations", [])]
    suggested_forms = [LegalForm(**f) for f in demo.get("suggested_forms", [])]

    return (
        StoredChatMessage(
            role="user",
            content=demo["query"],
            attachments=[attachment],
        ),
        StoredChatMessage(
            role="assistant",
            content=demo["answer"],
            citations=citations,
            transparency_note=demo.get("transparency_note", ""),
            suggested_forms=suggested_forms,
        ),
    )


def _session_demo_language(session: ChatSession) -> str | None:
    if session.title in _ALL_DEMO_TITLES:
        for lang, config in DEMO_CONFIG.items():
            if session.title == config["title"]:
                return lang

    for message in session.messages:
        if message.role != "user":
            continue
        content = (message.content or "").strip()
        for lang, config in DEMO_CONFIG.items():
            if content == config["query"]:
                return lang

    has_bafog_attachment = any(
        message.role == "user"
        and message.attachments
        and any(
            "bafög" in att.name.lower() or "bafoeg" in att.name.lower()
            for att in message.attachments
        )
        for message in session.messages
    )
    if has_bafog_attachment:
        for message in session.messages:
            if message.role != "user":
                continue
            content = (message.content or "").strip()
            if content in _ALL_DEMO_QUERIES:
                for lang, config in DEMO_CONFIG.items():
                    if content == config["query"]:
                        return lang
        return "de"

    return None


def _is_bafog_demo_session(session: ChatSession, language: str | None = None) -> bool:
    detected = _session_demo_language(session)
    if detected is None:
        return False
    if language is None:
        return True
    return detected == _normalize_language(language)


async def find_bafog_demo_session(user_id: str, language: str = "de") -> ChatSession | None:
    language = _normalize_language(language)
    for summary in await list_sessions(user_id):
        session = await get_session(summary.id)
        if session and _is_bafog_demo_session(session, language):
            return session
    return None


async def seed_bafog_demo_session(
    session_id: str, user_id: str, language: str = "de"
) -> ChatSession | None:
    language = _normalize_language(language)
    existing = await find_bafog_demo_session(user_id, language)
    if existing:
        return existing

    session = await get_session(session_id)
    if not session or session.user_id != user_id:
        return None
    if session.messages:
        return session

    config = DEMO_CONFIG[language]
    user_message, assistant_message = await _build_demo_messages(language)
    await append_messages(session_id, user_message, assistant_message)
    updated = await get_session(session_id)
    if updated and updated.title == "Neuer Chat":
        return await replace_session_messages(
            session_id,
            updated.messages,
            title=config["title"],
        )
    return updated


async def refresh_bafog_demo_session(user_id: str, language: str = "de") -> ChatSession:
    language = _normalize_language(language)
    config = DEMO_CONFIG[language]
    existing = await find_bafog_demo_session(user_id, language)
    if existing:
        session_id = existing.id
    else:
        session = await create_session(user_id)
        session_id = session.id

    user_message, assistant_message = await _build_demo_messages(language)
    refreshed = await replace_session_messages(
        session_id,
        [user_message, assistant_message],
        title=config["title"],
    )
    if not refreshed:
        raise RuntimeError("Failed to refresh BAföG demo session")
    return refreshed


async def get_or_create_bafog_demo_session(user_id: str, language: str = "de") -> ChatSession:
    language = _normalize_language(language)
    existing = await find_bafog_demo_session(user_id, language)
    if existing:
        return existing

    session = await create_session(user_id)
    seeded = await seed_bafog_demo_session(session.id, user_id, language)
    if not seeded:
        raise RuntimeError("Failed to create BAföG demo session")
    return seeded
