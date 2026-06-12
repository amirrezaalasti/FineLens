export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  street: string;
  postal_code: string;
  city: string;
  country: string;
  date_of_birth: string;
  nationality: string;
  legal_topic: string;
  case_description: string;
  preferred_language: string;
}

export interface Citation {
  source: string;
  source_url: string;
  title: string;
  excerpt: string;
  law_reference: string;
  episode_id: string;
  confidence: number;
  ref_number: number;
}

export interface FormField {
  id: string;
  label: string;
  type: string;
  value: string;
  required: boolean;
  placeholder: string;
  options: string[];
  prefilled_from: string | null;
}

export interface LegalForm {
  id: string;
  title: string;
  description: string;
  category: string;
  source_url: string;
  fields: FormField[];
  legal_basis: string[];
  body_template?: string;
}

export interface Attachment {
  name: string;
  content: string;
  file_type: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  transparency_note?: string;
  suggested_forms?: LegalForm[];
  attachments?: Attachment[];
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface SourceInfo {
  id: string;
  name: string;
  url: string;
  description: string;
  access_type: string;
  status: string;
}
