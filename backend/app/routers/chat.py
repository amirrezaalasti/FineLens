from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    ChatSession,
    ChatSessionSummary,
    CreateChatSessionRequest,
)
from app.services.chat_service import generate_answer
from app.services.chat_store import create_session, delete_session, get_session, list_sessions

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/sessions", response_model=list[ChatSessionSummary])
async def get_chat_sessions(user_id: str = "default") -> list[ChatSessionSummary]:
    return list_sessions(user_id)


@router.post("/sessions", response_model=ChatSession)
async def create_chat_session(request: CreateChatSessionRequest) -> ChatSession:
    return create_session(request.user_id)


@router.get("/sessions/{session_id}", response_model=ChatSession)
async def get_chat_session(session_id: str, user_id: str = "default") -> ChatSession:
    session = get_session(session_id)
    if not session or session.user_id != user_id:
        raise HTTPException(status_code=404, detail="Chat nicht gefunden")
    return session


@router.delete("/sessions/{session_id}")
async def remove_chat_session(session_id: str, user_id: str = "default") -> dict:
    session = get_session(session_id)
    if not session or session.user_id != user_id:
        raise HTTPException(status_code=404, detail="Chat nicht gefunden")
    delete_session(session_id)
    return {"deleted": True}


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Nachricht darf nicht leer sein")
    try:
        return await generate_answer(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Antwort konnte nicht generiert werden: {e}") from e
