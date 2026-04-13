"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiUpload,
  apiAnalyze,
  apiFeedback,
  apiExportSession,
  apiListSessions,
  apiGetSession,
  apiListFiles,
  apiGetSessionTranscript,
  type ProcessResponse,
  type KeywordMatch,
  type SessionSummary,
  type SessionDetail,
  type UploadResponse,
  type StoredFileRecord,
} from "@/lib/api";
import { useUploadStore } from "@/lib/upload-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadDropzone } from "@/components/upload-dropzone";
import {
  Upload,
  CheckCircle,
  XCircle,
  HelpCircle,
  Download,
  Loader2,
  History,
  Clock,
  Database,
  FileAudio,
  FolderOpen,
  PlayCircle,
  FileCheck,
} from "lucide-react";
import { MediaPlayer } from "@/components/media-player";
import { TranscriptViewer } from "@/components/transcript-viewer";
import { v4 as uuidv4 } from "uuid";

const severityColors: Record<string, string> = {
  critica: "bg-red-100 text-red-800 border-red-200",
  alta: "bg-orange-100 text-orange-800 border-orange-200",
  media: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function MatchCard({
  match,
  onFeedback,
}: {
  match: KeywordMatch & { id?: string; is_manual?: boolean };
  onFeedback: (id: string, action: string) => void;
}) {
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null);

  return (
    <div className={`border rounded-lg p-4 ${severityColors[match.severity] || "bg-gray-50 border-gray-200"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge className="text-xs">{match.label}</Badge>
            <Badge variant="outline" className="text-xs">{match.category}</Badge>
            <Badge variant="outline" className="text-xs capitalize">{match.severity}</Badge>
            {match.is_manual && (
              <Badge className="bg-blue-100 text-blue-800 text-xs">Manual</Badge>
            )}
            <span className="font-mono text-xs text-gray-500">
              {match.timestamp_start} - {match.timestamp_end}
            </span>
          </div>
          <p className="mb-1 text-sm font-medium">
            Termino: <span className="font-bold">&ldquo;{match.matched_term}&rdquo;</span>
          </p>
          {match.matched_span && (
            <p className="text-xs italic text-gray-600">&ldquo;{match.matched_span}&rdquo;</p>
          )}
        </div>

        {match.id && (
          <div className="flex shrink-0 flex-col gap-1">
            {feedbackSent ? (
              <Badge className="text-xs capitalize">{feedbackSent}</Badge>
            ) : (
              <>
                <Button size="sm" variant="outline" className="h-7 gap-1 border-green-300 text-xs text-green-700"
                  onClick={() => { setFeedbackSent("confirm"); onFeedback(match.id!, "confirm"); }}>
                  <CheckCircle className="h-3 w-3" />Confirmar
                </Button>
                <Button size="sm" variant="outline" className="h-7 gap-1 border-red-300 text-xs text-red-700"
                  onClick={() => { setFeedbackSent("reject"); onFeedback(match.id!, "reject"); }}>
                  <XCircle className="h-3 w-3" />Rechazar
                </Button>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-gray-600"
                  onClick={() => { setFeedbackSent("unsure"); onFeedback(match.id!, "unsure"); }}>
                  <HelpCircle className="h-3 w-3" />Revisar
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultPanel({
  result,
  file,
  onFeedback,
  onManualDetectionCreated,
}: {
  result: ProcessResponse;
  file: File | null;
  onFeedback: (id: string, action: string) => void;
  onManualDetectionCreated?: () => void;
}) {
  const sourceType = file?.type.startsWith("video") ? "video" : "audio";
  const [isExporting, setIsExporting] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold dark:text-white">{result.filename}</h2>
          <p className="text-sm text-gray-500">
            {result.total_matches} detecciones · {result.total_review_candidates} para revisar ·{" "}
            {result.duration_seconds?.toFixed(1) ?? "-"}s
          </p>
        </div>
        {result.session_id && (
          <Button variant="outline" size="sm" disabled={isExporting}
            onClick={async () => { try { setIsExporting(true); await apiExportSession(result.session_id!); } finally { setIsExporting(false); } }}>
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Exportar CSV
          </Button>
        )}
      </div>

      {/* Reproductor — siempre visible si hay archivo y duración */}
      {file && result.duration_seconds > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Reproductor con marcadores de deteccion</CardTitle>
          </CardHeader>
          <CardContent>
            <MediaPlayer
              file={file}
              duration={result.duration_seconds}
              matches={result.matches}
              sourceType={sourceType}
              sessionId={result.session_id ?? undefined}
              onManualDetectionCreated={onManualDetectionCreated}
            />
          </CardContent>
        </Card>
      )}

      {/* Transcripción completa */}
      {result.transcript_text && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Transcripcion completa</CardTitle>
            <p className="text-xs text-muted-foreground">
              Selecciona texto con el cursor y haz clic en &ldquo;Marcar manualmente&rdquo; para añadir una deteccion.
              Los terminos detectados aparecen resaltados.
            </p>
          </CardHeader>
          <CardContent>
            <TranscriptViewer
              text={result.transcript_text}
              matches={result.matches}
              sessionId={result.session_id!}
              language={result.language}
              onManualDetectionCreated={onManualDetectionCreated}
            />
          </CardContent>
        </Card>
      )}

      {result.matches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Detecciones confirmadas ({result.matches.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.matches.map((match, index) => (
              <MatchCard key={index} match={match} onFeedback={onFeedback} />
            ))}
          </CardContent>
        </Card>
      )}

      {result.review_candidates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Candidatos para revision ({result.review_candidates.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.review_candidates.map((candidate, index) => (
              <div key={index} className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs">{candidate.label}</Badge>
                  <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                    similitud {(candidate.similarity * 100).toFixed(0)}%
                  </Badge>
                  <span className="font-mono text-xs text-gray-500">{candidate.timestamp_start}</span>
                </div>
                <p className="text-xs">
                  Detectado: <strong>&ldquo;{candidate.detected_word}&rdquo;</strong> — sugerido:{" "}
                  <strong>&ldquo;{candidate.suggested_term}&rdquo;</strong>
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {result.clips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Clips generados ({result.clips.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.clips.map((clip, index) => (
              <div key={index} className="rounded-lg border p-3 text-xs">
                <p className="font-mono text-gray-600">{clip.timestamp_start} - {clip.timestamp_end}</p>
                {clip.error
                  ? <p className="mt-1 text-red-600">{clip.error}</p>
                  : <p className="mt-1 text-green-700">{clip.matches.length} deteccion(es) en este clip</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Historial de sesiones ──────────────────────────────────────────────────────

function HistoryTab({ onLoadResult }: { onLoadResult: (result: ProcessResponse, sessionId: string) => void }) {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions-av"],
    queryFn: () => apiListSessions(["audio", "video"]),
  });
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [transcriptText, setTranscriptText] = useState<string | null>(null);

  const loadSession = async (id: string) => {
    setLoadingId(id);
    try {
      const session = await apiGetSession(id);
      setDetail(session);
      // Try to load transcript
      try {
        const t = await apiGetSessionTranscript(id);
        setTranscriptText(t.text);
      } catch {
        setTranscriptText(null);
      }
    } finally {
      setLoadingId(null);
    }
  };

  if (isLoading) {
    return <div className="flex items-center gap-2 py-8 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Cargando historial...</div>;
  }

  if (!sessions?.length) {
    return (
      <div className="py-12 text-center text-gray-400">
        <Database className="mx-auto mb-2 h-8 w-8 opacity-40" />
        <p className="text-sm">Sin sesiones todavia</p>
      </div>
    );
  }

  if (detail) {
    const fakeResult: ProcessResponse = {
      session_id: detail.id,
      filename: detail.filename,
      language: detail.language,
      duration_seconds: detail.duration_seconds,
      transcript_path: "",
      total_matches: detail.total_matches,
      total_review_candidates: detail.total_review_candidates,
      matches: detail.detections as KeywordMatch[],
      review_candidates: [],
      clips: [],
      transcript_text: transcriptText,
    };

    return (
      <div className="space-y-4">
        <button onClick={() => { setDetail(null); setTranscriptText(null); }} className="text-xs text-rose-600 underline">
          Volver al historial
        </button>
        <ResultPanel result={fakeResult} file={null} onFeedback={() => {}} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((session: SessionSummary) => (
        <div key={session.id} className="flex items-center gap-4 rounded-lg border bg-white p-4 dark:bg-gray-900">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium dark:text-white">{session.filename}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">{session.source_type}</Badge>
              <Badge variant="outline" className="text-xs">{session.language.toUpperCase()}</Badge>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                {new Date(session.created_at).toLocaleString("es-ES")}
              </span>
              <span className="text-xs text-gray-500">{session.total_matches} detecciones</span>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => loadSession(session.id)} disabled={loadingId === session.id}>
            {loadingId === session.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Ver analisis"}
          </Button>
        </div>
      ))}
    </div>
  );
}

// ── "Mis archivos" tab ────────────────────────────────────────────────────────

function MyFilesTab({
  onAnalyzeFromFile,
}: {
  onAnalyzeFromFile: (stored: StoredFileRecord) => void;
}) {
  const { data: files, isLoading } = useQuery({
    queryKey: ["stored-files-av"],
    queryFn: () => apiListFiles({ source_type: ["audio", "video"] }),
  });
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);

  const loadAnalyzed = async (sessionId: string, fileId: string) => {
    setLoadingId(fileId);
    try {
      const s = await apiGetSession(sessionId);
      setDetail(s);
    } finally {
      setLoadingId(null);
    }
  };

  if (isLoading) {
    return <div className="flex items-center gap-2 py-8 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Cargando archivos...</div>;
  }

  if (!files?.length) {
    return (
      <div className="py-12 text-center text-gray-400">
        <FolderOpen className="mx-auto mb-2 h-8 w-8 opacity-40" />
        <p className="text-sm">Sin archivos de audio/video subidos</p>
        <p className="text-xs mt-1">Sube un archivo desde la pestana &ldquo;Procesar&rdquo; o en la seccion Archivos</p>
      </div>
    );
  }

  if (detail) {
    const fakeResult: ProcessResponse = {
      session_id: detail.id, filename: detail.filename, language: detail.language,
      duration_seconds: detail.duration_seconds, transcript_path: "",
      total_matches: detail.total_matches, total_review_candidates: detail.total_review_candidates,
      matches: detail.detections as KeywordMatch[], review_candidates: [], clips: [], transcript_text: null,
    };
    return (
      <div className="space-y-4">
        <button onClick={() => setDetail(null)} className="text-xs text-rose-600 underline">Volver a mis archivos</button>
        <ResultPanel result={fakeResult} file={null} onFeedback={() => {}} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((f: StoredFileRecord) => (
        <div key={f.id} className="flex items-center gap-4 rounded-lg border bg-white p-4 dark:bg-gray-900">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{f.original_filename}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">{f.source_type}</Badge>
              <span className="text-xs text-gray-500">{formatBytes(f.size_bytes)}</span>
              <span className="text-xs text-gray-500">{new Date(f.created_at).toLocaleDateString("es-ES")}</span>
              {f.session_id
                ? <Badge className="bg-green-100 text-green-800 text-xs"><FileCheck className="h-3 w-3 mr-1" />Analizado</Badge>
                : <Badge variant="outline" className="text-xs text-gray-500">Sin analizar</Badge>}
            </div>
          </div>
          {f.session_id ? (
            <Button size="sm" variant="outline" onClick={() => loadAnalyzed(f.session_id!, f.id)} disabled={loadingId === f.id}>
              {loadingId === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><PlayCircle className="h-3.5 w-3.5 mr-1" />Ver resultado</>}
            </Button>
          ) : (
            <Button size="sm" onClick={() => onAnalyzeFromFile(f)}>
              <PlayCircle className="h-3.5 w-3.5 mr-1" />Analizar
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

type UploadStep = "idle" | "uploaded" | "analyzing" | "done";

export default function ProcessPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [language, setLanguage] = useState("es");
  const [profile, setProfile] = useState("balanced_review");
  const [uploadStep, setUploadStep] = useState<UploadStep>("idle");
  const [uploadedInfo, setUploadedInfo] = useState<UploadResponse | null>(null);
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);
  const { addUpload, updateUpload } = useUploadStore();

  // Handle ?file_id= from /files page
  const fileIdParam = searchParams?.get("file_id");
  useEffect(() => {
    if (fileIdParam) {
      setUploadedInfo({ file_id: fileIdParam, filename: fileIdParam, source_type: "audio", size_bytes: 0 });
      setUploadStep("uploaded");
    }
  }, [fileIdParam]);

  // ── Paso 1: subir archivo ──────────────────────────────────────────────────
  const uploadMutation = useMutation({
    mutationFn: (f: File) => apiUpload(f),
    onMutate: (f) => {
      const id = uuidv4();
      const mediaType = f.type.startsWith("video") ? "video" as const : "audio" as const;
      addUpload({ id, filename: f.name, mediaType, status: "uploading", startedAt: new Date(), uploadedFile: f });
      setCurrentUploadId(id);
      return { uploadId: id };
    },
    onSuccess: (data, _f, ctx) => {
      setUploadedInfo(data);
      setUploadStep("uploaded");
      if (ctx?.uploadId) updateUpload(ctx.uploadId, { fileId: data.file_id });
    },
    onError: (_err, _f, ctx) => {
      if (ctx?.uploadId) updateUpload(ctx.uploadId, { status: "error", finishedAt: new Date() });
    },
  });

  // ── Paso 2: analizar ───────────────────────────────────────────────────────
  const analyzeMutation = useMutation({
    mutationFn: ({ fileId, lang, prof }: { fileId: string; lang: string; prof: string }) =>
      apiAnalyze(fileId, lang, prof),
    onMutate: () => setUploadStep("analyzing"),
    onSuccess: (data) => {
      setResult(data);
      setUploadStep("done");
      if (currentUploadId) updateUpload(currentUploadId, { status: "done", result: data, finishedAt: new Date() });
      queryClient.invalidateQueries({ queryKey: ["sessions-av"] });
      queryClient.invalidateQueries({ queryKey: ["stored-files-av"] });
    },
    onError: () => {
      setUploadStep("uploaded"); // go back so user can retry
      if (currentUploadId) updateUpload(currentUploadId, { status: "error", finishedAt: new Date() });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => apiFeedback(id, action),
  });

  function resetFlow() {
    setFile(null);
    setResult(null);
    setUploadedInfo(null);
    setUploadStep("idle");
    setCurrentUploadId(null);
    uploadMutation.reset();
    analyzeMutation.reset();
  }

  function handleAnalyzeFromFile(stored: StoredFileRecord) {
    setUploadedInfo({ file_id: stored.id, filename: stored.original_filename, source_type: stored.source_type, size_bytes: stored.size_bytes });
    setUploadStep("uploaded");
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="space-y-3">
        <div className="lab-chip lab-tone-audio">Modulo multimedia</div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Procesar Audio / Video</h1>
          <p className="mt-1 text-gray-500">
            Carga audio o video, define el perfil de deteccion y revisa el resultado desde una sola vista.
          </p>
        </div>
      </div>

      <Tabs defaultValue="process">
        <TabsList>
          <TabsTrigger value="process" className="gap-2">
            <Upload className="h-3.5 w-3.5" />Procesar
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-3.5 w-3.5" />Historial
          </TabsTrigger>
          <TabsTrigger value="myfiles" className="gap-2">
            <FolderOpen className="h-3.5 w-3.5" />Mis archivos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="process" className="mt-4 space-y-6">
          <Card>
            <CardHeader className="border-b border-black/5 dark:border-white/10">
              <CardTitle className="text-base">
                {uploadStep === "idle" ? "Paso 1 — Subir archivo" :
                 uploadStep === "uploaded" ? "Paso 2 — Configurar y analizar" :
                 uploadStep === "analyzing" ? "Analizando..." : "Analisis completado"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-5">

              {/* ── PASO IDLE: seleccionar archivo ─────────────────────────── */}
              {uploadStep === "idle" && (
                <>
                  <div className="space-y-2">
                    <Label>Archivo de audio o video</Label>
                    <UploadDropzone
                      id="file-input-av"
                      accept="audio/*,video/*"
                      file={file}
                      onFileSelect={setFile}
                      icon={FileAudio}
                      title="Arrastra un archivo o haz clic para seleccionarlo"
                      description="El archivo se sube primero y luego puedes lanzar el analisis."
                      helper="Todavia no has seleccionado un archivo."
                      chips={["Audio", "Video", "Hasta 500 MB"]}
                      variant="audio"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      disabled={!file || uploadMutation.isPending}
                      onClick={() => file && uploadMutation.mutate(file)}
                      className="h-11 px-5"
                    >
                      {uploadMutation.isPending
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Subiendo...</>
                        : <><Upload className="mr-2 h-4 w-4" />Subir archivo</>}
                    </Button>
                  </div>
                  {uploadMutation.isError && (
                    <p className="text-sm text-red-600">{(uploadMutation.error as Error)?.message || "Error al subir"}</p>
                  )}
                </>
              )}

              {/* ── PASO UPLOADED: configurar y analizar ───────────────────── */}
              {uploadStep === "uploaded" && uploadedInfo && (
                <>
                  <div className="flex items-center gap-3 rounded-lg border bg-green-50 p-3">
                    <FileCheck className="h-5 w-5 text-green-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-800 truncate">{uploadedInfo.filename}</p>
                      <p className="text-xs text-green-600">{uploadedInfo.source_type} · {formatBytes(uploadedInfo.size_bytes)}</p>
                    </div>
                    <button onClick={resetFlow} className="text-xs text-gray-500 underline hover:text-gray-700">Cambiar</button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="lang-select-av">Idioma</Label>
                      <select id="lang-select-av" aria-label="Idioma" value={language} onChange={(e) => setLanguage(e.target.value)}
                        className="lab-input mt-1 h-11 w-full px-3 text-sm focus:outline-none">
                        <option value="es">Espanol</option>
                        <option value="ca">Catalan</option>
                        <option value="va">Valenciano</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-select-av">Perfil de deteccion</Label>
                      <select id="profile-select-av" aria-label="Perfil de deteccion" value={profile} onChange={(e) => setProfile(e.target.value)}
                        className="lab-input mt-1 h-11 w-full px-3 text-sm focus:outline-none">
                        <option value="literal_fallback">Literal fallback</option>
                        <option value="balanced_review">Balanced review</option>
                        <option value="high_precision">High precision</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      className="h-11 px-5"
                      onClick={() => analyzeMutation.mutate({ fileId: uploadedInfo.file_id, lang: language, prof: profile })}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />Analizar
                    </Button>
                  </div>
                  {analyzeMutation.isError && (
                    <p className="text-sm text-red-600">{(analyzeMutation.error as Error)?.message || "Error al analizar"}</p>
                  )}
                </>
              )}

              {/* ── ANALIZANDO ─────────────────────────────────────────────── */}
              {uploadStep === "analyzing" && (
                <div className="flex flex-col items-center gap-3 py-10 text-gray-500">
                  <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
                  <p className="text-sm font-medium">Transcribiendo y analizando...</p>
                  <p className="text-xs text-gray-400">Esto puede tardar varios minutos dependiendo de la duracion del archivo.</p>
                </div>
              )}

              {/* ── LISTO: enlace para nuevo análisis ─────────────────────── */}
              {uploadStep === "done" && (
                <div className="flex items-center justify-between rounded-lg bg-green-50 border border-green-200 px-4 py-3">
                  <p className="text-sm text-green-800 font-medium">Analisis completado</p>
                  <button onClick={resetFlow} className="text-xs text-rose-600 underline">Nuevo analisis</button>
                </div>
              )}
            </CardContent>
          </Card>

          {result && (
            <ResultPanel
              result={result}
              file={file}
              onFeedback={(id, action) => feedbackMutation.mutate({ id, action })}
              onManualDetectionCreated={() => queryClient.invalidateQueries({ queryKey: ["sessions-av"] })}
            />
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryTab onLoadResult={() => {}} />
        </TabsContent>

        <TabsContent value="myfiles" className="mt-4">
          <MyFilesTab onAnalyzeFromFile={handleAnalyzeFromFile} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
