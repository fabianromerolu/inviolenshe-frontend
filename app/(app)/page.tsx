"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  Brain,
  CheckCircle,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { apiHealth } from "@/lib/api";
import { useUploadStore } from "@/lib/upload-store";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const quickLinks = [
  {
    href: "/process",
    title: "Procesar audio y video",
    description: "Carga material multimedia y revisa detecciones.",
    icon: Upload,
    iconClass: "lab-icon-audio",
    toneClass: "lab-tone-audio",
    toneLabel: "Multimedia",
  },
  {
    href: "/documents",
    title: "Procesar documentos",
    description: "Analiza PDF, TXT y DOCX con referencia de pagina.",
    icon: FileText,
    iconClass: "lab-icon-docs",
    toneClass: "lab-tone-docs",
    toneLabel: "Documentos",
  },
  {
    href: "/ml",
    title: "Ver analitica",
    description: "Consulta umbrales, co-ocurrencias y taxonomia.",
    icon: Brain,
    iconClass: "lab-icon-analytics",
    toneClass: "lab-tone-analytics",
    toneLabel: "Analitica",
  },
] as const;

export default function DashboardPage() {
  const { data: health, isLoading, error } = useQuery({
    queryKey: ["health"],
    queryFn: apiHealth,
    refetchInterval: 30000,
  });

  const { uploads, dismissUpload } = useUploadStore();
  const visibleUploads = uploads.filter((u) => u.status === "uploading" || !!u.finishedAt);

  return (
    <div className="space-y-6 pb-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
          Dashboard
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
          Supervisa el estado del backend y entra rapido a los modulos principales del laboratorio.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {quickLinks.map(({ href, title, description, icon: Icon, iconClass, toneClass, toneLabel }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full transition-all duration-200 group-hover:-translate-y-px group-hover:border-black/[0.1] group-hover:shadow-[0_22px_42px_-26px_rgba(15,23,42,0.2)] dark:group-hover:border-white/[0.14] dark:group-hover:shadow-[0_24px_44px_-28px_rgba(0,0,0,0.44)]">
              <CardContent className="pt-5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 group-hover:scale-[1.03] ${iconClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className={`lab-chip mt-4 ${toneClass}`}>{toneLabel}</div>
                <h2 className="mt-4 text-base font-semibold text-slate-950 dark:text-white">
                  {title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {visibleUploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4 text-rose-500" />
              Actividad reciente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {visibleUploads.map((upload) => (
              <div
                key={upload.id}
                className="flex items-center gap-3 rounded-xl border border-black/[0.07] bg-white/74 px-4 py-3 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.1)] transition-all duration-200 hover:border-black/[0.1] hover:shadow-[0_16px_28px_-18px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_14px_24px_-18px_rgba(0,0,0,0.28)] dark:hover:border-white/[0.14] dark:hover:shadow-[0_18px_30px_-20px_rgba(0,0,0,0.34)]"
              >
                {upload.status === "uploading" ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sky-600 dark:text-sky-300" />
                ) : upload.status === "done" ? (
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                    {upload.filename}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {upload.status === "uploading" ? (
                      "Procesando en segundo plano..."
                    ) : upload.status === "done" ? (
                      <span>
                        Analisis listo.{" "}
                        <Link
                          href={upload.mediaType === "document" ? "/documents" : "/process"}
                          className="font-medium text-emerald-700 underline underline-offset-4 dark:text-emerald-300"
                        >
                          Ver resultado
                        </Link>
                      </span>
                    ) : (
                      "No se pudo completar el analisis."
                    )}
                  </p>
                </div>

                {upload.status !== "uploading" && (
                  <button
                    onClick={() => dismissUpload(upload.id)}
                    className="rounded-full p-1 text-slate-400 transition-colors hover:bg-black/5 hover:text-slate-600 dark:hover:bg-white/8 dark:hover:text-slate-200"
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-rose-500" />
            Estado del backend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Conectando con la API...
            </p>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Backend no disponible en {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}
            </div>
          )}

          {health && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-black/[0.07] bg-white/74 px-4 py-4 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.1)] transition-all duration-200 hover:border-black/[0.1] hover:shadow-[0_16px_30px_-18px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_14px_24px_-18px_rgba(0,0,0,0.28)] dark:hover:border-white/[0.14] dark:hover:shadow-[0_18px_30px_-20px_rgba(0,0,0,0.34)]">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Estado
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle className="h-4 w-4" />
                  Online
                </div>
              </div>

              <div className="rounded-xl border border-black/[0.07] bg-white/74 px-4 py-4 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.1)] transition-all duration-200 hover:border-black/[0.1] hover:shadow-[0_16px_30px_-18px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_14px_24px_-18px_rgba(0,0,0,0.28)] dark:hover:border-white/[0.14] dark:hover:shadow-[0_18px_30px_-20px_rgba(0,0,0,0.34)]">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Entorno
                </p>
                <Badge variant="outline" className="mt-2">
                  {health.env}
                </Badge>
              </div>

              <div className="rounded-xl border border-black/[0.07] bg-white/74 px-4 py-4 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.1)] transition-all duration-200 hover:border-black/[0.1] hover:shadow-[0_16px_30px_-18px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_14px_24px_-18px_rgba(0,0,0,0.28)] dark:hover:border-white/[0.14] dark:hover:shadow-[0_18px_30px_-20px_rgba(0,0,0,0.34)]">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Perfil
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                  {health.detection_profile}
                </p>
              </div>

              <div className="rounded-xl border border-black/[0.07] bg-white/74 px-4 py-4 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.1)] transition-all duration-200 hover:border-black/[0.1] hover:shadow-[0_16px_30px_-18px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_14px_24px_-18px_rgba(0,0,0,0.28)] dark:hover:border-white/[0.14] dark:hover:shadow-[0_18px_30px_-20px_rgba(0,0,0,0.34)]">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Limite
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                  {health.max_upload_mb} MB
                </p>
              </div>

              <div className="rounded-xl border border-black/[0.07] bg-white/74 px-4 py-4 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.1)] transition-all duration-200 hover:border-black/[0.1] hover:shadow-[0_16px_30px_-18px_rgba(15,23,42,0.14)] sm:col-span-2 xl:col-span-4 dark:border-white/10 dark:bg-white/5 dark:shadow-[0_14px_24px_-18px_rgba(0,0,0,0.28)] dark:hover:border-white/[0.14] dark:hover:shadow-[0_18px_30px_-20px_rgba(0,0,0,0.34)]">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Idiomas y regex
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {health.supported_languages.map((language) => (
                    <Badge key={language} variant="outline">
                      {language.toUpperCase()}
                    </Badge>
                  ))}
                  <Badge variant="outline">
                    {health.regex_layer ? "Regex activa" : "Regex inactiva"}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
