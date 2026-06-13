from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class LegalSource(str, Enum):
    GESETZE_IM_INTERNET = "gesetze-im-internet.de"
    RECHT_BUND = "recht.bund.de"
    BECK_ONLINE = "beck-online.beck.de"
    JURIS = "juris.de"
    BUZER = "buzer.de"
    OPEN_LEGAL_DATA = "de.openlegaldata.io"


SOURCE_URLS: dict[LegalSource, str] = {
    LegalSource.GESETZE_IM_INTERNET: "https://www.gesetze-im-internet.de/",
    LegalSource.RECHT_BUND: "https://www.recht.bund.de/de/home/home_node.html",
    LegalSource.BECK_ONLINE: "https://beck-online.beck.de/Home",
    LegalSource.JURIS: "https://www.juris.de/jportal/nav/index.jsp",
    LegalSource.BUZER: "https://www.buzer.de/",
    LegalSource.OPEN_LEGAL_DATA: "https://de.openlegaldata.io/",
}


class UserProfile(BaseModel):
    id: str = "default"
    first_name: str = ""
    last_name: str = ""
    email: str = ""
    phone: str = ""
    street: str = ""
    postal_code: str = ""
    city: str = ""
    country: str = "Deutschland"
    date_of_birth: str = ""
    nationality: str = "deutsch"
    legal_topic: str = ""
    case_description: str = ""
    preferred_language: str = "de"


class Citation(BaseModel):
    source: LegalSource
    source_url: str
    title: str
    excerpt: str
    law_reference: str = ""
    episode_id: str = ""
    confidence: float = Field(ge=0, le=1, default=0.8)
    ref_number: int = 0


class ExtractedField(BaseModel):
    field_name: str
    value: str
    box: list[list[float]] | list[float] | None = None  # Single box or list of boxes for multi-line
    confidence: float = 1.0
    is_pii: bool = False
    page: int = 0


class DocumentAnalysis(BaseModel):
    fields: list[ExtractedField] = Field(default_factory=list)
    raw_text: str = ""
    preview_image_url: str | None = None  # Base64 data URL for display preview
    preview_pages: list[str] = Field(default_factory=list)
    preview_image_urls: list[str] = Field(default_factory=list)
    word_boxes: list[dict[str, Any]] = Field(default_factory=list)
    is_redacted: bool = False
    custom_prompt: str = ""


class Attachment(BaseModel):
    name: str
    content: str
    file_type: str
    analysis: DocumentAnalysis | None = None
    file_id: str | None = None


class ChatMessage(BaseModel):
    role: str
    content: str
    attachments: list[Attachment] = Field(default_factory=list)


class StoredChatMessage(BaseModel):
    role: str
    content: str
    citations: list[Citation] = Field(default_factory=list)
    transparency_note: str = ""
    suggested_forms: list["LegalForm"] = Field(default_factory=list)
    attachments: list[Attachment] = Field(default_factory=list)


class ChatSession(BaseModel):
    id: str
    user_id: str
    title: str = "Neuer Chat"
    messages: list[StoredChatMessage] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ChatSessionSummary(BaseModel):
    id: str
    title: str
    updated_at: datetime
    message_count: int


class CreateChatSessionRequest(BaseModel):
    user_id: str = "default"


class ChatRequest(BaseModel):
    message: str
    user_id: str = "default"
    session_id: str | None = None
    history: list[ChatMessage] = Field(default_factory=list)
    attachments: list[Attachment] = Field(default_factory=list)
    language: str | None = None


class FormField(BaseModel):
    id: str
    label: str
    type: str = "text"
    value: str = ""
    required: bool = True
    placeholder: str = ""
    options: list[str] = Field(default_factory=list)
    prefilled_from: str | None = None


class LegalForm(BaseModel):
    id: str
    title: str
    description: str
    category: str
    source_url: str = ""
    fields: list[FormField]
    legal_basis: list[str] = Field(default_factory=list)
    body_template: str = ""


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    suggested_forms: list[LegalForm] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)
    transparency_note: str = ""
    session_id: str = ""


class IngestRequest(BaseModel):
    query: str = ""
    law_book: str = ""
    limit: int = 10
    source: LegalSource = LegalSource.OPEN_LEGAL_DATA


class IngestStatus(BaseModel):
    ingested: int
    source: LegalSource
    message: str


class SourceInfo(BaseModel):
    id: LegalSource
    name: str
    url: str
    description: str
    access_type: str
    status: str


class HealthResponse(BaseModel):
    status: str
    graph_connected: bool
    graph_backend: str | None = None
    sources: list[SourceInfo]
    timestamp: datetime = Field(default_factory=datetime.utcnow)
