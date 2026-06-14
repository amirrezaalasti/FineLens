import json
import uuid
from datetime import datetime

from app.config import settings
from app.models.schemas import ChatSession, ChatSessionSummary, StoredChatMessage

DATA_DIR = settings.data_dir_path
CHATS_FILE = DATA_DIR / "chats.json"
_neo4j_schema_ready = False


def use_neo4j_chat_store() -> bool:
    if not settings.neo4j_uri.strip():
        return False
    backend = settings.graph_backend.lower()
    if backend == "neo4j":
        return True
    # Ephemeral serverless filesystems use /tmp; persist chats in Neo4j instead.
    return settings.data_dir.startswith("/tmp")


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
    CHATS_FILE.write_text(
        json.dumps(sessions, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )


def _session_title_from_message(message: str) -> str:
    cleaned = " ".join(message.split())
    if len(cleaned) <= 60:
        return cleaned
    return f"{cleaned[:57]}..."


def _session_to_dict(session: ChatSession) -> dict:
    return session.model_dump(mode="json")


def _session_from_dict(data: dict) -> ChatSession:
    return ChatSession(**data)


async def _ensure_neo4j_schema() -> None:
    global _neo4j_schema_ready
    if _neo4j_schema_ready:
        return

    from app.graphiti_client import get_graphiti

    graphiti = await get_graphiti()
    await graphiti.driver.execute_query(
        "CREATE CONSTRAINT finelens_chat_session_id IF NOT EXISTS "
        "FOR (s:FineLensChatSession) REQUIRE s.id IS UNIQUE"
    )
    _neo4j_schema_ready = True


async def _neo4j_save_session(session: ChatSession) -> None:
    from app.graphiti_client import get_graphiti

    await _ensure_neo4j_schema()
    graphiti = await get_graphiti()
    payload = _session_to_dict(session)
    await graphiti.driver.execute_query(
        """
        MERGE (s:FineLensChatSession {id: $id})
        SET s.user_id = $user_id,
            s.title = $title,
            s.messages_json = $messages_json,
            s.created_at = $created_at,
            s.updated_at = $updated_at
        """,
        params={
            "id": session.id,
            "user_id": session.user_id,
            "title": session.title,
            "messages_json": json.dumps(payload["messages"], ensure_ascii=False),
            "created_at": payload["created_at"],
            "updated_at": payload["updated_at"],
        },
    )


def _parse_datetime(value) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    return datetime.utcnow()


def _neo4j_record_to_session(record) -> ChatSession:
    messages = json.loads(record.get("messages_json") or "[]")
    return ChatSession(
        id=record["id"],
        user_id=record["user_id"],
        title=record.get("title") or "Neuer Chat",
        messages=[StoredChatMessage(**msg) for msg in messages],
        created_at=_parse_datetime(record.get("created_at")),
        updated_at=_parse_datetime(record.get("updated_at")),
    )


async def create_session(user_id: str) -> ChatSession:
    if use_neo4j_chat_store():
        session = ChatSession(id=str(uuid.uuid4()), user_id=user_id)
        await _neo4j_save_session(session)
        return session

    session = ChatSession(id=str(uuid.uuid4()), user_id=user_id)
    sessions = _load_all()
    sessions[session.id] = _session_to_dict(session)
    _save_all(sessions)
    return session


async def get_session(session_id: str) -> ChatSession | None:
    if use_neo4j_chat_store():
        from app.graphiti_client import get_graphiti

        await _ensure_neo4j_schema()
        graphiti = await get_graphiti()
        result = await graphiti.driver.execute_query(
            """
            MATCH (s:FineLensChatSession {id: $id})
            RETURN s.id AS id,
                   s.user_id AS user_id,
                   s.title AS title,
                   s.messages_json AS messages_json,
                   s.created_at AS created_at,
                   s.updated_at AS updated_at
            """,
            params={"id": session_id},
        )
        records = result.records if result else []
        if not records:
            return None
        return _neo4j_record_to_session(records[0])

    sessions = _load_all()
    data = sessions.get(session_id)
    if not data:
        return None
    return _session_from_dict(data)


async def get_or_create_session(user_id: str, session_id: str | None) -> ChatSession:
    if session_id:
        existing = await get_session(session_id)
        if existing and existing.user_id == user_id:
            return existing
    return await create_session(user_id)


async def list_sessions(user_id: str) -> list[ChatSessionSummary]:
    if use_neo4j_chat_store():
        from app.graphiti_client import get_graphiti

        await _ensure_neo4j_schema()
        graphiti = await get_graphiti()
        result = await graphiti.driver.execute_query(
            """
            MATCH (s:FineLensChatSession {user_id: $user_id})
            RETURN s.id AS id,
                   s.title AS title,
                   s.updated_at AS updated_at,
                   s.messages_json AS messages_json
            ORDER BY s.updated_at DESC
            """,
            params={"user_id": user_id},
        )
        summaries: list[ChatSessionSummary] = []
        for record in result.records if result else []:
            messages = json.loads(record.get("messages_json") or "[]")
            summaries.append(
                ChatSessionSummary(
                    id=record["id"],
                    title=record.get("title") or "Neuer Chat",
                    updated_at=_parse_datetime(record.get("updated_at")),
                    message_count=len(messages),
                )
            )
        return summaries

    sessions = _load_all()
    summaries: list[ChatSessionSummary] = []
    for data in sessions.values():
        if data.get("user_id") != user_id:
            continue
        session = _session_from_dict(data)
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


async def append_messages(
    session_id: str,
    user_message: StoredChatMessage,
    assistant_message: StoredChatMessage,
) -> ChatSession | None:
    session = await get_session(session_id)
    if not session:
        return None

    session.messages.extend([user_message, assistant_message])
    session.updated_at = datetime.utcnow()

    if session.title == "Neuer Chat" and user_message.content.strip():
        session.title = _session_title_from_message(user_message.content)

    if use_neo4j_chat_store():
        await _neo4j_save_session(session)
        return session

    sessions = _load_all()
    sessions[session_id] = _session_to_dict(session)
    _save_all(sessions)
    return session


async def replace_session_messages(
    session_id: str,
    messages: list[StoredChatMessage],
    *,
    title: str | None = None,
) -> ChatSession | None:
    session = await get_session(session_id)
    if not session:
        return None

    session.messages = messages
    session.updated_at = datetime.utcnow()
    if title is not None:
        session.title = title

    if use_neo4j_chat_store():
        await _neo4j_save_session(session)
        return session

    sessions = _load_all()
    sessions[session_id] = _session_to_dict(session)
    _save_all(sessions)
    return session


async def delete_session(session_id: str) -> bool:
    if use_neo4j_chat_store():
        existing = await get_session(session_id)
        if not existing:
            return False

        from app.graphiti_client import get_graphiti

        await _ensure_neo4j_schema()
        graphiti = await get_graphiti()
        await graphiti.driver.execute_query(
            "MATCH (s:FineLensChatSession {id: $id}) DETACH DELETE s",
            params={"id": session_id},
        )
        return True

    sessions = _load_all()
    if session_id not in sessions:
        return False
    del sessions[session_id]
    _save_all(sessions)
    return True
