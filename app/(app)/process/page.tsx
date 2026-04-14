"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiAnalyze,
  apiExportSession,
  apiFeedback,
  apiGetFile,
  apiGetSession,
  apiGetSessionTranscript,
  apiListFiles,
  apiListSessions,
  apiUpload,
  type KeywordMatch,
  type ProcessResponse,
  type SessionDetail,
  type SessionSummary,
  type StoredFileRecord,
  type UploadResponse,
} from "@/lib/api";
import { useUploadStore } from "@/lib/upload-store";
import { BlockingLoader } from "@/components/blocking-loader";
import { MediaPlayer } from "@/components/media-player";
import { TranscriptViewer } from "@/components/transcript-viewer";
import { UploadDropzone } from "@/components/upload-dropzone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle,
  Clock,
  Database,
  Download,
  FileAudio,
  FileCheck,
  FolderOpen,
  HelpCircle,
  History,
  Loader2,
  PlayCircle,
  Upload,
  XCircle,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";

const severityColors: Record<string, string> = {
  critica: "bg-red-100 text-red-800 border-red-200",
  alta: "bg-orange-100 text-orange-800 border-orange-200",
  media: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

type ProcessTab = "process" | "history" | "myfiles";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toUploadInfo(file: StoredFileRecord): UploadResponse {
  return {
    file_id: file.id,
    filename: file.original_filename,
    source_type: file.source_type,
    size_bytes: file.size_bytes,
  };
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
    <div className={`rounded-lg border p-4 ${severityColors[match.severity] || "bg-gray-50 border-gray-200"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge className="text-xs">{match.label}</Badge>
            <Badge variant="outline" className="text-xs">
              {match.category}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">
              {match.severity}
            </Badge>
            {match.is_manual && <Badge className="bg-blue-100 text-xs text-blue-800">Manual</Badge>}
            <span className="font-mono text-xs text-gray-500">
              {match.timestamp_start} - {match.timestamp_end}
            </span>
          </div>
          <p className="mb-1 text-sm font-medium">
            Termino: <span className="font-bold">&ldquo;{match.matched_term}&rdquo;</span>
          </p>
          {match.matched_span && <p className="text-xs italic text-gray-600">&ldquo;{match.matched_span}&rdquo;</p>}
        </div>

        {match.id && (
          <div className="flex shrink-0 flex-col gap-1">
            {feedbackSent ? (
              <Badge className="text-xs capitalize">{feedbackSent}</Badge>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 border-green-300 text-xs text-green-700"
                  onClick={() => {
                    setFeedbackSent("confirm");
                    onFeedback(match.id!, "confirm");
                  }}
                >
                  <CheckCircle className="h-3 w-3" />
                  Confirmar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 border-red-300 text-xs text-red-700"
                  onClick={() => {
                    setFeedbackSent("reject");
                    onFeedback(match.id!, "reject");
                  }}
                >
                  <XCircle className="h-3 w-3" />
                  Rechazar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs text-gray-600"
                  onClick={() => {
                    setFeedbackSent("unsure");
                    onFeedback(match.id!, "unsure");
                  }}
                >
                  <HelpCircle className="h-3 w-3" />
                  Revisar
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
            {result.total_matches} detecciones - {result.total_review_candidates} para revisar -{" "}
            {result.duration_seconds?.toFixed(1) ?? "-"}s
          </p>
        </div>
        {result.session_id && (
          <Button
            variant="outline"
            size="sm"
            disabled={isExporting}
            onClick={async () => {
              try {
                setIsExporting(true);
                await apiExportSession(result.session_id!);
              } finally {
                setIsExporting(false);
              }
            }}
          >
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Exportar CSV
          </Button>
        )}
      </div>

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

      {result.transcript_text && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Transcripcion completa</CardTitle>
            <p className="text-xs text-muted-foreground">
              Selecciona texto con el cursor y haz clic en &ldquo;Marcar manualmente&rdquo; para anadir una deteccion.
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
                  <Badge variant="outline" className="text-xs">
                    {candidate.label}
                  </Badge>
                  <Badge className="bg-yellow-100 text-xs text-yellow-800">
                    similitud {(candidate.similarity * 100).toFixed(0)}%
                  </Badge>
                  <span className="font-mono text-xs text-gray-500">{candidate.timestamp_start}</span>
                </div>
                <p className="text-xs">
                  Detectado: <strong>&ldquo;{candidate.detected_word}&rdquo;</strong> - sugerido:{" "}
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
                <p className="font-mono text-gray-600">
                  {clip.timestamp_start} - {clip.timestamp_end}
                </p>
                {clip.error ? (
                  <p className="mt-1 text-red-600">{clip.error}</p>
                ) : (
                  <p className="mt-1 text-green-700">{clip.matches.length} deteccion(es) en este clip</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function HistoryTab() {
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
      try {
        const transcript = await apiGetSessionTranscript(id);
        setTranscriptText(transcript.text);
      } catch {
        setTranscriptText(null);
      }
    } finally {
      setLoadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando historial...
      </div>
    );
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
        <button
          onClick={() => {
            setDetail(null);
            setTranscriptText(null);
          }}
          className="text-xs text-rose-600 underline"
        >
          Volver al historial
        </button>
        <ResultPanel result={fakeResult} file={null} onFeedback={() => undefined} />
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
              <Badge variant="outline" className="text-xs">
                {session.source_type}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {session.language.toUpperCase()}
              </Badge>
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
      const session = await apiGetSession(sessionId);
      setDetail(session);
    } finally {
      setLoadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando archivos...
      </div>
    );
  }

  if (!files?.length) {
    return (
      <div className="py-12 text-center text-gray-400">
        <FolderOpen className="mx-auto mb-2 h-8 w-8 opacity-40" />
        <p className="text-sm">Sin archivos de audio/video subidos</p>
        <p className="mt-1 text-xs">Sube un archivo desde la pestana &ldquo;Procesar&rdquo; o en la seccion Archivos</p>
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
      transcript_text: null,
    };

    return (
      <div className="space-y-4">
        <button onClick={() => setDetail(null)} className="text-xs text-rose-600 underline">
          Volver a mis archivos
        </button>
        <ResultPanel result={fakeResult} file={null} onFeedback={() => undefined} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((storedFile: StoredFileRecord) => (
        <div key={storedFile.id} className="flex items-center gap-4 rounded-lg border bg-white p-4 dark:bg-gray-900">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{storedFile.original_filename}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {storedFile.source_type}
              </Badge>
              <span className="text-xs text-gray-500">{formatBytes(storedFile.size_bytes)}</span>
              <span className="text-xs text-gray-500">
                {new Date(storedFile.created_at).toLocaleDateString("es-ES")}
              </span>
              {storedFile.session_id ? (
                <Badge className="bg-green-100 text-xs text-green-800">
                  <FileCheck className="mr-1 h-3 w-3" />
                  Analizado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-gray-500">
                  Sin analizar
                </Badge>
              )}
            </div>
          </div>
          {storedFile.session_id ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadAnalyzed(storedFile.session_id!, storedFile.id)}
              disabled={loadingId === storedFile.id}
            >
              {loadingId === storedFile.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <PlayCircle className="mr-1 h-3.5 w-3.5" />
                  Ver resultado
                </>
              )}
            </Button>
          ) : (
            <Button size="sm" type="button" onClick={() => onAnalyzeFromFile(storedFile)}>
              <PlayCircle className="mr-1 h-3.5 w-3.5" />
              Analizar
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function ProcessPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const routeFileId = searchParams?.get("file_id");

  const [activeTab, setActiveTab] = useState<ProcessTab>("process");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [language, setLanguage] = useState("es");
  const [profile, setProfile] = useState("balanced_review");
  const [uploadedInfo, setUploadedInfo] = useState<UploadResponse | null>(null);
  const [selectedStoredFile, setSelectedStoredFile] = useState<StoredFileRecord | null>(null);
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);
  const { addUpload, updateUpload } = useUploadStore();

  const routeStoredFileQuery = useQuery({
    queryKey: ["stored-file", routeFileId],
    enabled: !!routeFileId,
    queryFn: () => apiGetFile(routeFileId!),
    retry: false,
  });

  const routeStoredFile =
    routeStoredFileQuery.data && ["audio", "video"].includes(routeStoredFileQuery.data.source_type)
      ? routeStoredFileQuery.data
      : null;
  const preparedStoredFile = selectedStoredFile ?? routeStoredFile;
  const preparedUpload = uploadedInfo ?? (preparedStoredFile ? toUploadInfo(preparedStoredFile) : null);
  const isResolvingStoredFile = !selectedStoredFile && !uploadedInfo && !!routeFileId && routeStoredFileQuery.isLoading;
  const hasInvalidRouteFile = !!routeFileId && routeStoredFileQuery.isSuccess && !routeStoredFile;

  const uploadMutation = useMutation({
    mutationFn: (selectedFile: File) => apiUpload(selectedFile),
    onMutate: (selectedFile) => {
      const id = uuidv4();
      const mediaType = selectedFile.type.startsWith("video") ? "video" : "audio";
      if (routeFileId) {
        router.replace("/process", { scroll: false });
      }
      setResult(null);
      setUploadedInfo(null);
      setSelectedStoredFile(null);
      addUpload({
        id,
        filename: selectedFile.name,
        mediaType,
        status: "uploading",
        startedAt: new Date(),
        uploadedFile: selectedFile,
      });
      setCurrentUploadId(id);
      return { uploadId: id };
    },
    onSuccess: (data, _selectedFile, ctx) => {
      setUploadedInfo(data);
      setActiveTab("process");
      if (ctx?.uploadId) updateUpload(ctx.uploadId, { fileId: data.file_id });
    },
    onError: (_error, _selectedFile, ctx) => {
      if (ctx?.uploadId) updateUpload(ctx.uploadId, { status: "error", finishedAt: new Date() });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: ({ fileId, lang, prof }: { fileId: string; lang: string; prof: string }) => apiAnalyze(fileId, lang, prof),
    onSuccess: (data) => {
      setResult(data);
      if (currentUploadId) {
        updateUpload(currentUploadId, { status: "done", result: data, finishedAt: new Date() });
      }
      queryClient.invalidateQueries({ queryKey: ["sessions-av"] });
      queryClient.invalidateQueries({ queryKey: ["stored-files-av"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
    onError: () => {
      if (currentUploadId) {
        updateUpload(currentUploadId, { status: "error", finishedAt: new Date() });
      }
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => apiFeedback(id, action),
  });

  const currentStep = isResolvingStoredFile
    ? "resolving"
    : analyzeMutation.isPending
      ? "analyzing"
      : result
        ? "done"
        : preparedUpload
          ? "uploaded"
          : "idle";

  function resetFlow() {
    setFile(null);
    setResult(null);
    setUploadedInfo(null);
    setSelectedStoredFile(null);
    setCurrentUploadId(null);
    uploadMutation.reset();
    analyzeMutation.reset();
    if (routeFileId) {
      router.replace("/process", { scroll: false });
    }
  }

  function handleAnalyzeFromFile(storedFile: StoredFileRecord) {
    setFile(null);
    setResult(null);
    setUploadedInfo(null);
    setSelectedStoredFile(storedFile);
    setActiveTab("process");
    uploadMutation.reset();
    analyzeMutation.reset();
    if (routeFileId) {
      router.replace("/process", { scroll: false });
    }
  }

  return (
    <>
      <BlockingLoader
        open={uploadMutation.isPending || analyzeMutation.isPending}
        title={uploadMutation.isPending ? "Subiendo archivo..." : "Analizando evidencia..."}
        description={
          uploadMutation.isPending
            ? "Estamos guardando el archivo para prepararlo dentro del laboratorio."
            : "La transcripcion y el analisis pueden tardar varios minutos segun la duracion del material."
        }
      />

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

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ProcessTab)}>
          <TabsList>
            <TabsTrigger value="process" className="gap-2">
              <Upload className="h-3.5 w-3.5" />
              Procesar
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-3.5 w-3.5" />
              Historial
            </TabsTrigger>
            <TabsTrigger value="myfiles" className="gap-2">
              <FolderOpen className="h-3.5 w-3.5" />
              Mis archivos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="process" className="mt-4 space-y-6">
            <Card>
              <CardHeader className="border-b border-black/5 dark:border-white/10">
                <CardTitle className="text-base">
                  {currentStep === "idle"
                    ? "Paso 1 - Subir archivo"
                    : currentStep === "resolving"
                      ? "Preparando archivo"
                      : currentStep === "uploaded"
                        ? "Paso 2 - Configurar y analizar"
                        : currentStep === "analyzing"
                          ? "Analizando..."
                          : "Analisis completado"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                {(routeStoredFileQuery.isError || hasInvalidRouteFile) && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    No se pudo preparar el archivo solicitado para este modulo. Verifica el enlace o vuelve a seleccionarlo
                    desde Archivos.
                  </div>
                )}

                {currentStep === "idle" && (
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
                        {uploadMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Subiendo...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Subir archivo
                          </>
                        )}
                      </Button>
                    </div>
                    {uploadMutation.isError && (
                      <p className="text-sm text-red-600">
                        {(uploadMutation.error as Error)?.message || "Error al subir"}
                      </p>
                    )}
                  </>
                )}

                {currentStep === "resolving" && (
                  <div className="flex flex-col items-center gap-3 py-10 text-gray-500">
                    <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
                    <p className="text-sm font-medium">Buscando archivo seleccionado...</p>
                    <p className="text-xs text-gray-400">Estamos preparando el Paso 2 para que analices sin volver a cargarlo.</p>
                  </div>
                )}

                {currentStep === "uploaded" && preparedUpload && (
                  <>
                    <div className="flex items-center gap-3 rounded-lg border bg-green-50 p-3">
                      <FileCheck className="h-5 w-5 shrink-0 text-green-600" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-green-800">{preparedUpload.filename}</p>
                        <p className="text-xs text-green-600">
                          {preparedUpload.source_type} - {formatBytes(preparedUpload.size_bytes)}
                        </p>
                      </div>
                      <button onClick={resetFlow} className="text-xs text-gray-500 underline hover:text-gray-700">
                        Cambiar
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="lang-select-av">Idioma</Label>
                        <select
                          id="lang-select-av"
                          aria-label="Idioma"
                          value={language}
                          onChange={(event) => setLanguage(event.target.value)}
                          className="lab-input mt-1 h-11 w-full px-3 text-sm focus:outline-none"
                        >
                          <option value="es">Espanol</option>
                          <option value="ca">Catalan</option>
                          <option value="va">Valenciano</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="profile-select-av">Perfil de deteccion</Label>
                        <select
                          id="profile-select-av"
                          aria-label="Perfil de deteccion"
                          value={profile}
                          onChange={(event) => setProfile(event.target.value)}
                          className="lab-input mt-1 h-11 w-full px-3 text-sm focus:outline-none"
                        >
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
                        disabled={analyzeMutation.isPending}
                        onClick={() =>
                          analyzeMutation.mutate({
                            fileId: preparedUpload.file_id,
                            lang: language,
                            prof: profile,
                          })
                        }
                      >
                        {analyzeMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Analizando...
                          </>
                        ) : (
                          <>
                            <PlayCircle className="mr-2 h-4 w-4" />
                            Analizar
                          </>
                        )}
                      </Button>
                    </div>
                    {analyzeMutation.isError && (
                      <p className="text-sm text-red-600">
                        {(analyzeMutation.error as Error)?.message || "Error al analizar"}
                      </p>
                    )}
                  </>
                )}

                {currentStep === "analyzing" && (
                  <div className="flex flex-col items-center gap-3 py-10 text-gray-500">
                    <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
                    <p className="text-sm font-medium">Transcribiendo y analizando...</p>
                    <p className="text-xs text-gray-400">
                      Esto puede tardar varios minutos dependiendo de la duracion del archivo.
                    </p>
                  </div>
                )}

                {currentStep === "done" && (
                  <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                    <p className="text-sm font-medium text-green-800">Analisis completado</p>
                    <button onClick={resetFlow} className="text-xs text-rose-600 underline">
                      Nuevo analisis
                    </button>
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
            <HistoryTab />
          </TabsContent>

          <TabsContent value="myfiles" className="mt-4">
            <MyFilesTab onAnalyzeFromFile={handleAnalyzeFromFile} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

export default function ProcessPage() {
  return (
    <Suspense>
      <ProcessPageInner />
    </Suspense>
  );
}
