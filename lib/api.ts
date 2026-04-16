import axios from "axios";
import Cookies from "js-cookie";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  timeout: 300000, // 5 min para procesar audio largo
});

// Añadir token JWT a todas las peticiones
api.interceptors.request.use((config) => {
  const token = Cookies.get("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirigir a /login si el servidor responde 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove("auth_token");
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

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
  transcript_text: string | null;
}

export interface DocumentMatch extends KeywordMatch {
  page: number;
  char_start: number;
  char_end: number;
}

export interface DocumentReviewCandidate extends ReviewCandidate {
  page: number;
  char_start: number;
  char_end: number;
}

export interface DocumentProcessResponse {
  session_id: string | null;
  filename: string;
  source_type: string;
  language: string;
  total_pages: number;
  processing_time_seconds: number;
  total_matches: number;
  total_review_candidates: number;
  matches: DocumentMatch[];
  review_candidates: DocumentReviewCandidate[];
  export_hint: string;
}

export interface KeywordMatch {
  id?: string;
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
  return api.post<DocumentProcessResponse>("/process-document", form).then((r) => r.data);
};

export const apiFeedback = (detection_id: string, action: string, notes?: string) =>
  api.post<FeedbackResponse>("/feedback", { detection_id, action, notes }).then((r) => r.data);

function getDownloadFilename(contentDisposition: string | undefined, fallback: string): string {
  if (!contentDisposition) return fallback;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  if (filenameMatch?.[1]) {
    return filenameMatch[1];
  }

  return fallback;
}

function guessMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "mkv":
      return "video/x-matroska";
    case "webm":
      return "video/webm";
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "m4a":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    case "flac":
      return "audio/flac";
    case "pdf":
      return "application/pdf";
    case "txt":
      return "text/plain";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
}

export async function apiExportSession(session_id: string): Promise<void> {
  const response = await api.get<Blob>("/export", {
    params: { session_id },
    responseType: "blob",
  });

  const filename = getDownloadFilename(
    response.headers["content-disposition"],
    `${session_id}_matches.csv`
  );

  const blob = new Blob([response.data], {
    type: response.headers["content-type"] || "text/csv;charset=utf-8",
  });

  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

export const apiMLInsights = () =>
  api.get<MLInsightsResponse>("/ml/insights").then((r) => r.data);

export const apiMLThresholds = () =>
  api.get<ThresholdsResponse>("/ml/thresholds").then((r) => r.data);

export const apiMLCooccurrence = (top_n = 20) =>
  api.get<CooccurrenceResponse>(`/ml/cooccurrence?top_n=${top_n}`).then((r) => r.data);

export const apiMLTaxonomy = (concept?: string) =>
  api.get<TaxonomyResponse>(`/ml/taxonomy${concept ? `?concept=${concept}` : ""}`).then((r) => r.data);

// ── Sesiones (historial) ──────────────────────────────────────────────────────

export interface SessionSummary {
  id: string;
  filename: string;
  source_type: string;
  language: string;
  profile: string;
  created_at: string;
  duration_seconds: number;
  file_size_bytes: number;
  total_matches: number;
  total_review_candidates: number;
  status: string;
}

export interface SessionDetail extends SessionSummary {
  stored_file_id?: string | null;
  detections: Array<KeywordMatch & { id: string; page_number?: number; is_manual?: boolean; notes?: string }>;
}

// ── Interfaces nuevas ─────────────────────────────────────────────────────────

export interface UploadResponse {
  file_id: string;
  filename: string;
  source_type: string;
  size_bytes: number;
}

export interface StoredFileRecord {
  id: string;
  original_filename: string;
  stored_filename: string;
  source_type: string;
  size_bytes: number;
  folder_id: string | null;
  session_id: string | null;
  created_at: string;
}

export interface FolderRecord {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface DocumentPageContent {
  page: number;
  char_start: number;
  char_end: number;
  text: string;
}

export interface TranscriptResponse {
  session_id: string;
  source_type?: string;
  language: string;
  text: string;
  segments: Array<{
    id: number | null;
    start: number;
    end: number;
    text: string;
    words: Array<{ word: string; start: number | null; end: number | null; score: number | null }>;
  }>;
  review_candidates?: ReviewCandidate[];
  clips?: ClipResult[];
  total_pages?: number | null;
  document_pages?: DocumentPageContent[];
}

export interface ManualDetectionBody {
  label: string;
  matched_term: string;
  timestamp_start: string;
  timestamp_end: string;
  notes?: string;
  source: "transcript" | "timeline";
  language?: string;
}

export const apiListSessions = (sourceTypes: string[], skip = 0, limit = 20) => {
  const params = new URLSearchParams();
  sourceTypes.forEach((t) => params.append("source_type", t));
  params.set("skip", String(skip));
  params.set("limit", String(limit));
  return api.get<SessionSummary[]>(`/sessions?${params}`).then((r) => r.data);
};

export const apiGetSession = (id: string) =>
  api.get<SessionDetail>(`/sessions/${id}`).then((r) => r.data);

// ── Upload en 2 pasos ─────────────────────────────────────────────────────────

export const apiUpload = (file: File, folder_id?: string | null) => {
  const form = new FormData();
  form.append("file", file);
  if (folder_id) {
    form.append("folder_id", folder_id);
  }
  return api.post<UploadResponse>("/upload", form).then((r) => r.data);
};

export const apiAnalyze = (file_id: string, language: string, profile: string) =>
  api.post<ProcessResponse>("/analyze", { file_id, language, profile }).then((r) => r.data);

export const apiAnalyzeDocument = (file_id: string, language: string, profile: string) =>
  api.post<DocumentProcessResponse>("/analyze-document", { file_id, language, profile }).then((r) => r.data);

// ── Transcripción y detección manual ─────────────────────────────────────────

export const apiGetSessionTranscript = (session_id: string) =>
  api.get<TranscriptResponse>(`/sessions/${session_id}/transcript`).then((r) => r.data);

export const apiCreateManualDetection = (session_id: string, body: ManualDetectionBody) =>
  api.post<{ ok: boolean; detection_id: string }>(`/sessions/${session_id}/manual-detection`, body).then((r) => r.data);

// ── Gestión de archivos ───────────────────────────────────────────────────────

export const apiListFiles = (params?: {
  folder_id?: string;
  source_type?: string[];
  skip?: number;
  limit?: number;
}) => {
  const p = new URLSearchParams();
  if (params?.folder_id) p.set("folder_id", params.folder_id);
  params?.source_type?.forEach((t) => p.append("source_type", t));
  if (params?.skip != null) p.set("skip", String(params.skip));
  if (params?.limit != null) p.set("limit", String(params.limit));
  return api.get<StoredFileRecord[]>(`/files?${p}`).then((r) => r.data);
};

export const apiGetFile = (file_id: string) =>
  api.get<StoredFileRecord>(`/files/${file_id}`).then((r) => r.data);

export async function apiDownloadStoredFile(file_id: string): Promise<File> {
  const response = await api.get<Blob>(`/files/${file_id}/download`, {
    responseType: "blob",
  });

  const filename = getDownloadFilename(
    response.headers["content-disposition"],
    `${file_id}.bin`
  );

  return new File([response.data], filename, {
    type:
      response.headers["content-type"] && response.headers["content-type"] !== "application/octet-stream"
        ? response.headers["content-type"]
        : guessMimeType(filename),
  });
}

export const apiDeleteFile = (file_id: string) =>
  api.delete<{ ok: boolean }>(`/files/${file_id}`).then((r) => r.data);

export const apiMoveFile = (file_id: string, folder_id: string | null) =>
  api.patch<StoredFileRecord>(`/files/${file_id}/folder`, { folder_id }).then((r) => r.data);

export const apiListFolders = () =>
  api.get<FolderRecord[]>("/files/folders").then((r) => r.data);

export const apiCreateFolder = (name: string, parent_id: string | null = null) =>
  api.post<FolderRecord>("/files/folders", { name, parent_id }).then((r) => r.data);

export const apiMoveFolder = (folder_id: string, parent_id: string | null) =>
  api.patch<FolderRecord>(`/files/folders/${folder_id}/parent`, { parent_id }).then((r) => r.data);

export const apiDeleteFolder = (folder_id: string) =>
  api.delete<{ ok: boolean }>(`/files/folders/${folder_id}`).then((r) => r.data);

export default api;
