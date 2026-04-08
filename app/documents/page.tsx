"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  apiProcessDocument, apiFeedback, apiExportUrl, apiListSessions, apiGetSession,
  ProcessResponse, KeywordMatch, SessionSummary, SessionDetail,
} from "@/lib/api";
import { useUploadStore } from "@/lib/upload-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, CheckCircle, XCircle, HelpCircle, Download, Loader2, FileText, History, Clock, Database } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
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

interface DocMatch extends KeywordMatch { id?: string; page?: number; }

function DocMatchCard({ match, onFeedback }: { match: DocMatch; onFeedback: (id: string, action: string) => void }) {
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null);
  return (
    <div className={`border rounded-lg p-4 ${severityColors[match.severity] || "bg-gray-50 border-gray-200"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge className="text-xs">{match.label}</Badge>
            <Badge variant="outline" className="text-xs">{match.category}</Badge>
            <Badge variant="outline" className="text-xs capitalize">{match.severity}</Badge>
            {match.page != null && <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Página {match.page}</Badge>}
            <Badge variant="outline" className="text-xs">P{match.review_priority}</Badge>
          </div>
          <p className="text-sm font-medium mb-1">Término: <span className="font-bold">&ldquo;{match.matched_term}&rdquo;</span></p>
          {match.matched_span && <p className="text-xs text-gray-600 italic">&ldquo;{match.matched_span}&rdquo;</p>}
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 flex-wrap">
            <span>{match.match_type}</span>
            {match.passes_context_threshold && <Badge className="bg-green-100 text-green-800 text-xs">Contexto OK</Badge>}
          </div>
        </div>
        {match.id && (
          <div className="flex flex-col gap-1 shrink-0">
            {feedbackSent ? <Badge className="text-xs capitalize">{feedbackSent}</Badge> : (
              <>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-300" onClick={() => { setFeedbackSent("confirm"); onFeedback(match.id!, "confirm"); }}>
                  <CheckCircle className="h-3 w-3" /> Confirmar
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-700 border-red-300" onClick={() => { setFeedbackSent("reject"); onFeedback(match.id!, "reject"); }}>
                  <XCircle className="h-3 w-3" /> Rechazar
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-gray-600" onClick={() => { setFeedbackSent("unsure"); onFeedback(match.id!, "unsure"); }}>
                  <HelpCircle className="h-3 w-3" /> Revisar
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

  if (isLoading) return <div className="flex items-center gap-2 text-gray-500 py-8"><Loader2 className="h-4 w-4 animate-spin" /> Cargando historial...</div>;
  if (!sessions?.length) return <div className="text-center py-12 text-gray-400"><Database className="h-8 w-8 mx-auto mb-2 opacity-40" /><p className="text-sm">Sin sesiones todavía</p></div>;

  if (detail) {
    return (
      <div className="space-y-4">
        <button onClick={() => setDetail(null)} className="text-xs text-blue-600 underline">← Volver al historial</button>
        <div>
          <h2 className="text-lg font-semibold dark:text-white">{detail.filename}</h2>
          <p className="text-sm text-gray-500">{detail.total_matches} detecciones</p>
        </div>
        <div className="space-y-3">
          {detail.detections.map((d, i) => (
            <DocMatchCard key={i} match={d as DocMatch} onFeedback={() => {}} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((s: SessionSummary) => (
        <div key={s.id} className="border rounded-lg p-4 flex items-center gap-4 bg-white dark:bg-gray-900">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate dark:text-white">{s.filename}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs">{s.source_type}</Badge>
              <Badge variant="outline" className="text-xs">{s.language.toUpperCase()}</Badge>
              <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(s.created_at).toLocaleString("es-ES")}</span>
              <span className="text-xs text-gray-500">{s.total_matches} detecciones</span>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => loadSession(s.id)} disabled={loadingId === s.id}>
            {loadingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Ver análisis"}
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
      if (ctx?.uploadId) updateUpload(ctx.uploadId, { status: "done", result: data, finishedAt: new Date() });
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.uploadId) updateUpload(ctx.uploadId, { status: "error", finishedAt: new Date() });
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
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Procesar Documentos</h1>
        <p className="text-gray-500 mt-1">Analiza PDF, TXT y DOCX — muestra referencia de página por detección</p>
      </div>

      <Tabs defaultValue="process">
        <TabsList>
          <TabsTrigger value="process" className="gap-2"><Upload className="h-3.5 w-3.5" /> Procesar</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="h-3.5 w-3.5" /> Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="process" className="mt-4 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Subir documento</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label>Archivo de documento</Label>
                  <div className="mt-1 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => document.getElementById("file-input-doc")?.click()}>
                    <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    {file ? <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</p> : <p className="text-sm text-gray-500">PDF, TXT, DOCX</p>}
                    <input id="file-input-doc" type="file" className="hidden" title="Seleccionar documento" accept=".pdf,.txt,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Idioma</Label>
                    <select {...register("language")} className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="es">Español</option>
                      <option value="ca">Catalán</option>
                      <option value="va">Valenciano</option>
                    </select>
                  </div>
                  <div>
                    <Label>Perfil de detección</Label>
                    <select {...register("profile")} className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="literal_fallback">Literal fallback</option>
                      <option value="balanced_review">Balanced review</option>
                      <option value="high_precision">High precision</option>
                    </select>
                  </div>
                </div>
                <Button type="submit" disabled={!file || mutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white w-full">
                  {mutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analizando...</> : <><Upload className="h-4 w-4 mr-2" />Analizar documento</>}
                </Button>
                {mutation.isError && <p className="text-sm text-red-600">{(mutation.error as Error)?.message || "Error al analizar"}</p>}
              </form>
            </CardContent>
          </Card>

          {result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold dark:text-white">{result.filename}</h2>
                  <p className="text-sm text-gray-500">{result.total_matches} detecciones · {result.total_review_candidates} para revisar</p>
                </div>
                {result.session_id && (
                  <a href={apiExportUrl(result.session_id)} download className={buttonVariants({ variant: "outline", size: "sm" })}>
                    <Download className="h-4 w-4 mr-2" /> Exportar CSV
                  </a>
                )}
              </div>

              {/* Visor de documento con highlights */}
              {file && (result.matches.length > 0 || result.review_candidates.length > 0) && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Vista previa con detecciones resaltadas</CardTitle></CardHeader>
                  <CardContent>
                    <DocumentViewer file={file} matches={result.matches as Array<KeywordMatch & { page_number?: number }>} />
                  </CardContent>
                </Card>
              )}

              {result.matches.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Detecciones confirmadas ({result.matches.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {result.matches.map((m, i) => (
                      <DocMatchCard key={i} match={m as DocMatch} onFeedback={(id, action) => feedbackMutation.mutate({ id, action })} />
                    ))}
                  </CardContent>
                </Card>
              )}

              {result.review_candidates.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Candidatos para revisión ({result.review_candidates.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {result.review_candidates.map((rc, i) => (
                      <div key={i} className="border rounded-lg p-3 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline" className="text-xs">{rc.label}</Badge>
                          <Badge className="bg-yellow-100 text-yellow-800 text-xs">similitud {(rc.similarity * 100).toFixed(0)}%</Badge>
                        </div>
                        <p className="text-xs dark:text-gray-300">Detectado: <strong>&ldquo;{rc.detected_word}&rdquo;</strong> → sugerido: <strong>&ldquo;{rc.suggested_term}&rdquo;</strong></p>
                        <p className="text-xs text-gray-500 mt-1">{rc.reason}</p>
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
