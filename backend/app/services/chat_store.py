import json
import uuid
from datetime import datetime

from app.config import settings
from app.models.schemas import ChatSession, ChatSessionSummary, StoredChatMessage

DATA_DIR = settings.data_dir_path
CHATS_FILE = DATA_DIR / "chats.json"


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not CHATS_FILE.exists():
        CHATS_FILE.write_text("{}", encoding="utf-8")


def _load_all() -> dict[str, dict]:
    _ensure_data_dir()
    content = CHATS_FILE.read_text(encoding="utf-8").strip()
    if not content:
        return {}
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {}


def _save_all(sessions: dict[str, dict]) -> None:
    _ensure_data_dir()
    CHATS_FILE.write_text(json.dumps(sessions, indent=2, ensure_ascii=False, default=str), encoding="utf-8")


def _session_title_from_message(message: str) -> str:
    cleaned = " ".join(message.split())
    if len(cleaned) <= 60:
        return cleaned
    return f"{cleaned[:57]}..."


def create_session(user_id: str) -> ChatSession:
    session = ChatSession(id=str(uuid.uuid4()), user_id=user_id)
    sessions = _load_all()
    sessions[session.id] = session.model_dump(mode="json")
    _save_all(sessions)
    return session


def get_session(session_id: str) -> ChatSession | None:
    sessions = _load_all()
    data = sessions.get(session_id)
    if not data:
        return None
    return ChatSession(**data)


def get_or_create_session(user_id: str, session_id: str | None) -> ChatSession:
    if session_id:
        existing = get_session(session_id)
        if existing and existing.user_id == user_id:
            return existing
    return create_session(user_id)


def list_sessions(user_id: str) -> list[ChatSessionSummary]:
    sessions = _load_all()
    summaries: list[ChatSessionSummary] = []
    for data in sessions.values():
        if data.get("user_id") != user_id:
            continue
        session = ChatSession(**data)
        summaries.append(
            ChatSessionSummary(
                id=session.id,
                title=session.title,
                updated_at=session.updated_at,
                message_count=len(session.messages),
            )
        )
    summaries.sort(key=lambda s: s.updated_at, reverse=True)
    return summaries


def append_messages(
    session_id: str,
    user_message: StoredChatMessage,
    assistant_message: StoredChatMessage,
) -> ChatSession | None:
    sessions = _load_all()
    data = sessions.get(session_id)
    if not data:
        return None

    session = ChatSession(**data)
    session.messages.extend([user_message, assistant_message])
    session.updated_at = datetime.utcnow()

    if session.title == "Neuer Chat" and user_message.content.strip():
        session.title = _session_title_from_message(user_message.content)

    sessions[session_id] = session.model_dump(mode="json")
    _save_all(sessions)
    return session


def delete_session(session_id: str) -> bool:
    sessions = _load_all()
    if session_id not in sessions:
        return False
    del sessions[session_id]
    _save_all(sessions)
    return True
