"""Cached BAföG sample document demo — LLM runs once, result is reused."""

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
from app.services.chat_store import append_messages, get_session

SAMPLE_PDF = Path(__file__).resolve().parents[2] / "samples" / "BAfoeg_Rueckbescheid_Beispiel.pdf"
CACHE_FILE = settings.data_dir_path / "bafog_demo_cache.json"
DEMO_QUERY = (
    "Ich habe diesen BAföG-Rückbescheid erhalten. "
    "Was bedeutet das für mich und welche Optionen habe ich?"
)


def _load_cache() -> dict | None:
    if not CACHE_FILE.exists():
        return None
    try:
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def _save_cache(data: dict) -> None:
    settings.data_dir_path.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False, default=str), encoding="utf-8")


async def _build_demo_cache() -> dict:
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
            message=DEMO_QUERY,
            user_id="default",
            attachments=[attachment],
            language="de",
        ),
        persist=False,
    )

    data = {
        "query": DEMO_QUERY,
        "attachment": attachment.model_dump(mode="json"),
        "answer": chat_response.answer,
        "citations": [c.model_dump(mode="json") for c in chat_response.citations],
        "suggested_forms": [f.model_dump(mode="json") for f in chat_response.suggested_forms],
        "follow_up_questions": chat_response.follow_up_questions,
        "transparency_note": chat_response.transparency_note,
    }
    _save_cache(data)
    return data


async def get_bafog_demo_data() -> dict:
    cached = _load_cache()
    if cached:
        return cached
    return await _build_demo_cache()


async def seed_bafog_demo_session(session_id: str, user_id: str) -> ChatSession | None:
    session = get_session(session_id)
    if not session or session.user_id != user_id:
        return None
    if session.messages:
        return session

    demo = await get_bafog_demo_data()
    attachment = Attachment(**demo["attachment"])

    from app.models.schemas import Citation, LegalForm

    citations = [Citation(**c) for c in demo.get("citations", [])]
    suggested_forms = [LegalForm(**f) for f in demo.get("suggested_forms", [])]

    append_messages(
        session_id,
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
    return get_session(session_id)
