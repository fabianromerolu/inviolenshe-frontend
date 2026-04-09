"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  apiProcessDocument,
  apiFeedback,
  apiExportUrl,
  apiListSessions,
  apiGetSession,
  ProcessResponse,
  KeywordMatch,
  SessionSummary,
  SessionDetail,
} from "@/lib/api";
import { useUploadStore } from "@/lib/upload-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
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
  FileText,
  History,
  Clock,
  Database,
} from "lucide-react";
import { DocumentViewer } from "@/components/document-viewer";
import { v4 as uuidv4 } from "uuid";

const schema = z.object({
  language: z.enum(["es", "ca", "va"]),
  profile: z.enum(["literal_fallback", "balanced_review", "high_precision"]),
});

type FormValues = z.infer<typeof schema>;

const severityColors: Record<string, string> = {
  critica: "bg-red-100 text-red-800 border-red-200",
  alta: "bg-orange-100 text-orange-800 border-orange-200",
  media: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

interface DocMatch extends KeywordMatch {
  id?: string;
  page?: number;
}

function DocMatchCard({
  match,
  onFeedback,
}: {
  match: DocMatch;
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
            {match.page != null && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                Pagina {match.page}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">P{match.review_priority}</Badge>
          </div>
          <p className="mb-1 text-sm font-medium">
            Termino: <span className="font-bold">&ldquo;{match.matched_term}&rdquo;</span>
          </p>
          {match.matched_span && (
            <p className="text-xs italic text-gray-600">&ldquo;{match.matched_span}&rdquo;</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{match.match_type}</span>
            {match.passes_context_threshold && (
              <Badge className="bg-green-100 text-green-800 text-xs">Contexto OK</Badge>
            )}
          </div>
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

function HistoryTab() {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions-docs"],
    queryFn: () => apiListSessions(["pdf", "txt", "docx"]),
  });
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);

  const loadSession = async (id: string) => {
    setLoadingId(id);
    try {
      setDetail(await apiGetSession(id));
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
    return (
      <div className="space-y-4">
        <button onClick={() => setDetail(null)} className="text-xs text-sky-600 underline">
          Volver al historial
        </button>
        <div>
          <h2 className="text-lg font-semibold dark:text-white">{detail.filename}</h2>
          <p className="text-sm text-gray-500">{detail.total_matches} detecciones</p>
        </div>
        <div className="space-y-3">
          {detail.detections.map((detection, index) => (
            <DocMatchCard key={index} match={detection as DocMatch} onFeedback={() => {}} />
          ))}
        </div>
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

export default function DocumentsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const { addUpload, updateUpload } = useUploadStore();

  const { register, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { language: "es", profile: "balanced_review" },
  });

  const mutation = useMutation({
    mutationFn: ({ file, language, profile }: { file: File; language: string; profile: string }) =>
      apiProcessDocument(file, language, profile),
    onMutate: ({ file }) => {
      const id = uuidv4();
      addUpload({ id, filename: file.name, mediaType: "document", status: "uploading", startedAt: new Date() });
      return { uploadId: id };
    },
    onSuccess: (data, _vars, ctx) => {
      setResult(data);
      if (ctx?.uploadId) {
        updateUpload(ctx.uploadId, { status: "done", result: data, finishedAt: new Date() });
      }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.uploadId) {
        updateUpload(ctx.uploadId, { status: "error", finishedAt: new Date() });
      }
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => apiFeedback(id, action),
  });

  const onSubmit = (values: FormValues) => {
    if (!file) return;
    mutation.mutate({ file, language: values.language, profile: values.profile });
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="space-y-3">
        <div className="lab-chip lab-tone-docs">Modulo documental</div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Procesar Documentos</h1>
          <p className="mt-1 text-gray-500">
            Organiza la subida de PDF, TXT y DOCX con una configuracion clara y resultados faciles de revisar.
          </p>
        </div>
      </div>

      <Tabs defaultValue="process">
        <TabsList>
          <TabsTrigger value="process" className="gap-2">
            <Upload className="h-3.5 w-3.5" />
            Procesar
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-3.5 w-3.5" />
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="process" className="mt-4 space-y-6">
          <Card>
            <CardHeader className="border-b border-black/5 dark:border-white/10">
              <CardTitle className="text-base">Subir documento</CardTitle>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Selecciona el documento, ajusta los parametros y lanza el analisis.
              </p>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="file-input-doc">Archivo de documento</Label>
                  <UploadDropzone
                    id="file-input-doc"
                    accept=".pdf,.txt,.docx"
                    file={file}
                    onFileSelect={setFile}
                    icon={FileText}
                    title="Arrastra un documento o haz clic para seleccionarlo"
                    description="Carga PDF, TXT o DOCX. El area reacciona al cursor y al arrastrar un archivo encima."
                    helper="Todavia no has seleccionado un documento."
                    chips={["PDF", "TXT", "DOCX"]}
                    variant="docs"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Idioma</Label>
                    <select
                      {...register("language")}
                      className="mt-1 h-11 w-full rounded-xl border border-slate-200/90 bg-white/82 px-3 text-sm shadow-[0_8px_18px_-16px_rgba(15,23,42,0.12)] transition-all duration-200 hover:border-slate-300 hover:bg-white focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/15 dark:hover:bg-white/[0.06]"
                    >
                      <option value="es">Espanol</option>
                      <option value="ca">Catalan</option>
                      <option value="va">Valenciano</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Perfil de deteccion</Label>
                    <select
                      {...register("profile")}
                      className="mt-1 h-11 w-full rounded-xl border border-slate-200/90 bg-white/82 px-3 text-sm shadow-[0_8px_18px_-16px_rgba(15,23,42,0.12)] transition-all duration-200 hover:border-slate-300 hover:bg-white focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/15 dark:hover:bg-white/[0.06]"
                    >
                      <option value="literal_fallback">Literal fallback</option>
                      <option value="balanced_review">Balanced review</option>
                      <option value="high_precision">High precision</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-xl border border-black/[0.06] bg-white/72 px-4 py-3 text-sm text-slate-600 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  El resultado muestra segmentos, coincidencias por pagina, vista previa resaltada y exportacion CSV.
                </div>

                <div className="flex flex-col gap-3 border-t border-black/5 pt-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {file
                      ? `Se analizara: ${file.name}`
                      : "Selecciona un documento para habilitar el analisis."}
                  </p>
                  <Button
                    type="submit"
                    disabled={!file || mutation.isPending}
                    className="h-11 bg-sky-600 px-5 text-white shadow-[0_14px_30px_-18px_rgba(14,165,233,0.35)] hover:bg-sky-700 hover:shadow-[0_18px_34px_-18px_rgba(14,165,233,0.42)]"
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analizando...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Analizar documento
                      </>
                    )}
                  </Button>
                </div>

                {mutation.isError && (
                  <p className="text-sm text-red-600">
                    {(mutation.error as Error)?.message || "Error al analizar"}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          {result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold dark:text-white">{result.filename}</h2>
                  <p className="text-sm text-gray-500">
                    {result.total_matches} detecciones · {result.total_review_candidates} para revisar
                  </p>
                </div>
                {result.session_id && (
                  <a href={apiExportUrl(result.session_id)} download className={buttonVariants({ variant: "outline", size: "sm" })}>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar CSV
                  </a>
                )}
              </div>

              {file && (result.matches.length > 0 || result.review_candidates.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Vista previa con detecciones resaltadas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DocumentViewer
                      file={file}
                      matches={result.matches as Array<KeywordMatch & { page_number?: number }>}
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
                      <DocMatchCard
                        key={index}
                        match={match as DocMatch}
                        onFeedback={(id, action) => feedbackMutation.mutate({ id, action })}
                      />
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
                      <div
                        key={index}
                        className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950"
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-xs">{candidate.label}</Badge>
                          <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                            similitud {(candidate.similarity * 100).toFixed(0)}%
                          </Badge>
                        </div>
                        <p className="text-xs dark:text-gray-300">
                          Detectado: <strong>&ldquo;{candidate.detected_word}&rdquo;</strong> - sugerido:{" "}
                          <strong>&ldquo;{candidate.suggested_term}&rdquo;</strong>
                        </p>
                        <p className="mt-1 text-xs text-gray-500">{candidate.reason}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
