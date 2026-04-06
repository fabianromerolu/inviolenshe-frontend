import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  timeout: 300000, // 5 min para procesar audio largo
});

export interface ProcessResponse {
  session_id: string | null;
  filename: string;
  language: string;
  duration_seconds: number;
  transcript_path: string;
  total_matches: number;
  total_review_candidates: number;
  matches: KeywordMatch[];
  review_candidates: ReviewCandidate[];
  clips: ClipResult[];
}

export interface KeywordMatch {
  label: string;
  matched_term: string;
  matched_span: string;
  text: string;
  language: string;
  category: string;
  review_priority: number;
  start: number;
  end: number;
  timestamp_start: string;
  timestamp_end: string;
  severity: string;
  confidence_level: string;
  match_type: string;
  passes_context_threshold: boolean;
  detection_score: number | null;
  context_groups_triggered: string[];
  disambiguation_rules_triggered: string[];
  requires_human_review: boolean;
}

export interface ReviewCandidate {
  label: string;
  suggested_term: string;
  detected_word: string;
  text: string;
  language: string;
  start: number;
  end: number;
  timestamp_start: string;
  timestamp_end: string;
  similarity: number;
  reason: string;
}

export interface ClipResult {
  start: number;
  end: number;
  timestamp_start: string;
  timestamp_end: string;
  clip_path: string | null;
  error: string | null;
  matches: KeywordMatch[];
}

export interface DetectionResult {
  id: string;
  concept_label: string;
  matched_term: string;
  matched_span: string;
  category: string;
  severity: string;
  review_priority: number;
  timestamp_start: string;
  timestamp_end: string;
  match_type: string;
}

export interface HealthResponse {
  status: string;
  app: string;
  env: string;
  context_engine: string;
  detection_profile: string;
  regex_layer: boolean;
  supported_languages: string[];
  max_upload_mb: number;
}

export interface FeedbackResponse {
  ok: boolean;
  feedback_id: string;
}

export interface MLInsightsResponse {
  total_concepts_with_feedback: number;
  insights: {
    high_rejection_rate: Array<{ concept: string; confirms: number; rejects: number; unsure: number; confidence: number }>;
    high_confirmation_rate: Array<{ concept: string; confirms: number; rejects: number; unsure: number; confidence: number }>;
    no_feedback_yet: string[];
    insufficient_data: string[];
    confidence_by_concept: Record<string, number | null>;
  };
}

export interface ThresholdsResponse {
  total_concepts: number;
  thresholds: Record<string, {
    multiplier: number;
    phase: number;
    confidence: number | null;
    total_feedback: number;
    recommendation: string;
  }>;
}

export interface CooccurrenceResponse {
  total_sessions_analyzed: number;
  top_pairs: Array<{ pair: [string, string]; count: number; sessions_pct: number }>;
}

export type TaxonomyResponse = Record<string, {
  CEDAW: string[];
  istanbul: string[];
  ICD11: string[];
  CP_ES: string[];
  label_es: string;
  severity: string;
  note?: string;
}>;

// API functions
export const apiHealth = () =>
  api.get<HealthResponse>("/health").then((r) => r.data);

export const apiProcess = (file: File, language: string, profile: string) => {
  const form = new FormData();
  form.append("file", file);
  form.append("language", language);
  form.append("profile", profile);
  return api.post<ProcessResponse>("/process", form).then((r) => r.data);
};

export const apiProcessDocument = (file: File, language: string, profile: string) => {
  const form = new FormData();
  form.append("file", file);
  form.append("language", language);
  form.append("profile", profile);
  return api.post<ProcessResponse>("/process-document", form).then((r) => r.data);
};

export const apiFeedback = (detection_id: string, action: string, notes?: string) =>
  api.post<FeedbackResponse>("/feedback", { detection_id, action, notes }).then((r) => r.data);

export const apiExportUrl = (session_id: string) =>
  `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/export?session_id=${session_id}`;

export const apiMLInsights = () =>
  api.get<MLInsightsResponse>("/ml/insights").then((r) => r.data);

export const apiMLThresholds = () =>
  api.get<ThresholdsResponse>("/ml/thresholds").then((r) => r.data);

export const apiMLCooccurrence = (top_n = 20) =>
  api.get<CooccurrenceResponse>(`/ml/cooccurrence?top_n=${top_n}`).then((r) => r.data);

export const apiMLTaxonomy = (concept?: string) =>
  api.get<TaxonomyResponse>(`/ml/taxonomy${concept ? `?concept=${concept}` : ""}`).then((r) => r.data);

export default api;
