import base64
import io
from fastapi import APIRouter, HTTPException, UploadFile, File
from openai import AsyncOpenAI
import pypdf

from app.config import settings
from app.models.schemas import (
    Attachment,
    ChatRequest,
    ChatResponse,
    ChatSession,
    ChatSessionSummary,
    CreateChatSessionRequest,
)
from app.services.chat_service import generate_answer
from app.services.chat_store import create_session, delete_session, get_session, list_sessions

router = APIRouter(prefix="/chat", tags=["chat"])


async def extract_file_content(file: UploadFile) -> str:
    content_type = file.content_type or ""
    filename = file.filename or ""
    file_bytes = await file.read()

    if not file_bytes:
        return ""

    if content_type.startswith("image/"):
        try:
            base64_image = base64.b64encode(file_bytes).decode("utf-8")
            client = AsyncOpenAI(api_key=settings.openai_api_key)
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Bitte extrahiere und transkribiere sämtlichen Text aus diesem Dokumentenbild auf Deutsch. Wenn es sich um ein Foto handelt, beschreibe auch visuelle Details, falls diese rechtlich relevant sein könnten."
                            },
                            {
                                "type": "image_url",
                                "url": f"data:{content_type};base64,{base64_image}"
                            }
                        ]
                    }
                ],
                max_tokens=1500
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Fehler bei der Bildverarbeitung durch OpenAI: {e}"
            )

    elif content_type == "application/pdf" or filename.lower().endswith(".pdf"):
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            text = ""
            for i, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            
            if not text.strip():
                return "[Leeres oder eingescanntes PDF-Dokument - Text konnte nicht extrahiert werden]"
            return text.strip()
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Fehler beim Lesen der PDF-Datei: {e}"
            )

    else:
        try:
            return file_bytes.decode("utf-8", errors="ignore").strip()
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Dateiformat wird nicht unterstützt oder Text konnte nicht dekodiert werden: {e}"
            )


@router.post("/upload", response_model=Attachment)
async def upload_chat_file(file: UploadFile = File(...)) -> Attachment:
    content = await extract_file_content(file)
    return Attachment(
        name=file.filename or "file",
        content=content,
        file_type=file.content_type or "application/octet-stream"
    )


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
    if not request.message.strip() and not request.attachments:
        raise HTTPException(status_code=400, detail="Nachricht oder Anhang darf nicht leer sein")
    try:
        return await generate_answer(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Antwort konnte nicht generiert werden: {e}") from e
