from fastapi import APIRouter, HTTPException

from app.models.schemas import ChatRequest, ChatResponse
from app.services.chat_service import generate_answer

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Nachricht darf nicht leer sein")
    try:
        return await generate_answer(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Antwort konnte nicht generiert werden: {e}") from e
