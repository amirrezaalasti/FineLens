import type { ChatMessage, LegalForm, SourceInfo, UserProfile } from "./types";

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
  history: { role: string; content: string }[]
) {
  return request<{
    answer: string;
    citations: ChatMessage["citations"];
    suggested_forms: LegalForm[];
    follow_up_questions: string[];
    transparency_note: string;
  }>("/chat", {
    method: "POST",
    body: JSON.stringify({ message, user_id: userId, history }),
  });
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
