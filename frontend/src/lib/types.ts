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

export interface SourceViewPayload {
  citations: Citation[];
  transparencyNote?: string;
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

export interface ExtractedField {
  field_name: string;
  value: string;
  box: number[] | number[][] | null; // Single box or list of boxes for multi-line
  confidence: number;
  is_pii?: boolean;
  page?: number;
}

export interface WordBox {
  text: string;
  box: number[];
  page?: number;
}

export interface DocumentAnalysis {
  fields: ExtractedField[];
  raw_text: string;
  preview_image_url: string | null;
  preview_pages?: string[] | null;
  preview_image_urls?: string[];
  word_boxes?: WordBox[];
  is_redacted?: boolean;
  custom_prompt?: string;
}

export interface Attachment {
  name: string;
  content: string;
  file_type: string;
  file_id?: string | null;
  analysis?: DocumentAnalysis | null;
  isPending?: boolean;
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
