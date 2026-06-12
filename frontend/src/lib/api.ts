import type {
  Attachment,
  ChatMessage,
  ChatSession,
  ChatSessionSummary,
  LegalForm,
  SourceInfo,
  UserProfile,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `API error ${res.status}`);
  }
  return res.json();
}

export async function sendChat(
  message: string,
  userId: string,
  history: { role: string; content: string; attachments?: Attachment[] }[],
  sessionId?: string | null,
  attachments?: Attachment[]
) {
  return request<{
    answer: string;
    citations: ChatMessage["citations"];
    suggested_forms: LegalForm[];
    follow_up_questions: string[];
    transparency_note: string;
    session_id: string;
  }>("/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      user_id: userId,
      history,
      session_id: sessionId || null,
      attachments: attachments || [],
    }),
  });
}

export async function uploadFile(file: File): Promise<Attachment> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/chat/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Upload error ${res.status}`);
  }
  return res.json();
}

export async function listChatSessions(userId: string) {
  return request<ChatSessionSummary[]>(`/chat/sessions?user_id=${userId}`);
}

export async function createChatSession(userId: string) {
  return request<ChatSession>("/chat/sessions", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function getChatSession(sessionId: string, userId: string) {
  return request<ChatSession>(`/chat/sessions/${sessionId}?user_id=${userId}`);
}

export async function deleteChatSession(sessionId: string, userId: string) {
  return request<{ deleted: boolean }>(
    `/chat/sessions/${sessionId}?user_id=${userId}`,
    { method: "DELETE" }
  );
}

export async function getProfile(userId: string) {
  return request<UserProfile>(`/users/${userId}`);
}

export async function saveProfile(profile: UserProfile) {
  return request<UserProfile>(`/users/${profile.id}`, {
    method: "PUT",
    body: JSON.stringify(profile),
  });
}

export async function getForms(userId: string) {
  return request<LegalForm[]>(`/forms?user_id=${userId}`);
}

export async function getForm(formId: string, userId: string) {
  return request<LegalForm>(`/forms/${formId}?user_id=${userId}`);
}

export async function getHealth() {
  return request<{
    status: string;
    graph_connected: boolean;
    sources: SourceInfo[];
  }>("/health");
}

export async function seedData() {
  return request<{ ingested: number; message: string }>("/ingest/seed", {
    method: "POST",
  });
}
