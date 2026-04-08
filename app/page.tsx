"use client";
import { useQuery } from "@tanstack/react-query";
import { apiHealth } from "@/lib/api";
import { useUploadStore } from "@/lib/upload-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity, Upload, FileText, Brain, CheckCircle, AlertCircle,
  Loader2, X, Clock,
} from "lucide-react";
import Link from "next/link";

function ElapsedTime({ since }: { since: Date }) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.floor((now - since.getTime()) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return <span>{m > 0 ? `${m}m ` : ""}{s}s</span>;
}

import React from "react";

export default function DashboardPage() {
  const { data: health, isLoading, error } = useQuery({
    queryKey: ["health"],
    queryFn: apiHealth,
    refetchInterval: 30000,
  });

  const { uploads, dismissUpload } = useUploadStore();

  // Mostrar uploads activos y los completados en los últimos 5 minutos
  const visibleUploads = uploads.filter((u) => {
    if (u.status === "uploading") return true;
    if (u.finishedAt) {
      return Date.now() - u.finishedAt.getTime() < 5 * 60 * 1000;
    }
    return false;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 mt-1">Estado del backend y accesos rápidos</p>
      </div>

      {/* Sección de uploads activos */}
      {visibleUploads.length > 0 && (
        <Card className="border-rose-200 dark:border-rose-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-rose-700 dark:text-rose-400">
              <Upload className="h-4 w-4" />
              Cargas en curso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleUploads.map((u) => (
              <div
                key={u.id}
                className={`flex items-center gap-3 rounded-lg p-3 ${
                  u.status === "uploading"
                    ? "bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800"
                    : u.status === "done"
                    ? "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800"
                    : "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"
                }`}
              >
                {u.status === "uploading" ? (
                  <Loader2 className="h-4 w-4 text-blue-600 animate-spin shrink-0" />
                ) : u.status === "done" ? (
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate dark:text-white">{u.filename}</p>
                  <p className="text-xs text-gray-500">
                    {u.status === "uploading" ? (
                      <>
                        Procesando…{" "}
                        <span className="font-mono">
                          <Clock className="h-3 w-3 inline mr-0.5" />
                          <ElapsedTime since={u.startedAt} />
                        </span>
                      </>
                    ) : u.status === "done" ? (
                      <>
                        Análisis listo para revisión ·{" "}
                        <Link
                          href={u.mediaType === "document" ? "/documents" : "/process"}
                          className="underline text-green-700 dark:text-green-400"
                        >
                          Ver resultado
                        </Link>
                      </>
                    ) : (
                      "Error al procesar el archivo"
                    )}
                  </p>
                </div>

                {u.status !== "uploading" && (
                  <button
                    onClick={() => dismissUpload(u.id)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0"
                    title="Cerrar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Health status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Estado del backend {health?.app ? `— ${health.app}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-gray-500">Conectando...</p>}
          {error && (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">
                Backend no disponible en {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}
              </span>
            </div>
          )}
          {health && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Estado</p>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">Online</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Entorno</p>
                <Badge variant="outline">{health.env}</Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Perfil</p>
                <Badge variant="secondary">{health.detection_profile}</Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Motor de contexto</p>
                <Badge
                  className={
                    health.context_engine === "loaded"
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                  }
                >
                  {health.context_engine}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Idiomas</p>
                <div className="flex gap-1 flex-wrap">
                  {health.supported_languages.map((l) => (
                    <Badge key={l} variant="outline" className="text-xs">
                      {l.toUpperCase()}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Límite archivo</p>
                <span className="text-sm">{health.max_upload_mb} MB</span>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Capa regex</p>
                <Badge
                  className={
                    health.regex_layer
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }
                >
                  {health.regex_layer ? "Activa" : "Inactiva"}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link href="/process">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6 flex items-start gap-4">
              <div className="p-3 bg-rose-100 dark:bg-rose-950 rounded-lg">
                <Upload className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Procesar Audio / Video</h3>
                <p className="text-xs text-gray-500 mt-1">Transcripción + detección de términos clave</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/documents">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6 flex items-start gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-950 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Procesar Documentos</h3>
                <p className="text-xs text-gray-500 mt-1">PDF, TXT y DOCX con referencia de página</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/ml">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6 flex items-start gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-950 rounded-lg">
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">ML & Analytics</h3>
                <p className="text-xs text-gray-500 mt-1">Insights, umbrales adaptativos, taxonomía</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
