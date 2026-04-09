"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  apiMLInsights,
  apiMLThresholds,
  apiMLCooccurrence,
  apiMLTaxonomy,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Brain, TrendingUp, Network, BookOpen, Loader2, AlertCircle } from "lucide-react";

// ── Insights Tab ──────────────────────────────────────────────────────────────
function InsightsTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["ml-insights"],
    queryFn: apiMLInsights,
  });

  if (isLoading)
    return (
      <div className="flex items-center gap-2 text-gray-500 py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando insights...
      </div>
    );
  if (error)
    return (
      <div className="flex items-center gap-2 text-red-600 py-8">
        <AlertCircle className="h-4 w-4" /> Error al cargar insights
      </div>
    );
  if (!data) return null;

  const { insights } = data;

  const chartData = [
    ...insights.high_rejection_rate.map((c) => ({
      concept: c.concept,
      confirms: c.confirms,
      rejects: c.rejects,
      unsure: c.unsure,
      grupo: "Alto rechazo",
    })),
    ...insights.high_confirmation_rate.map((c) => ({
      concept: c.concept,
      confirms: c.confirms,
      rejects: c.rejects,
      unsure: c.unsure,
      grupo: "Alta confirmación",
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-500 mb-1">Conceptos con feedback</p>
            <p className="text-2xl font-bold">{data.total_concepts_with_feedback}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-500 mb-1">Sin feedback aún</p>
            <p className="text-2xl font-bold">{insights.no_feedback_yet.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-500 mb-1">Datos insuficientes</p>
            <p className="text-2xl font-bold">{insights.insufficient_data.length}</p>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Feedback por concepto</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="concept" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="confirms" name="Confirmados" fill="#22c55e" />
                <Bar dataKey="rejects" name="Rechazados" fill="#ef4444" />
                <Bar dataKey="unsure" name="Indecisos" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {insights.high_rejection_rate.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-red-700 dark:text-red-400">
              Alta tasa de rechazo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.high_rejection_rate.map((c) => {
              const total = c.confirms + c.rejects + c.unsure;
              const pct = total > 0 ? Math.round((c.rejects / total) * 100) : 0;
              return (
                <div key={c.concept}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{c.concept}</span>
                    <span className="text-red-600">{pct}% rechazos</span>
                  </div>
                  <Progress value={pct} className="h-2 bg-red-100" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {insights.high_confirmation_rate.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-green-700 dark:text-green-400">
              Alta tasa de confirmación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.high_confirmation_rate.map((c) => {
              const total = c.confirms + c.rejects + c.unsure;
              const pct = total > 0 ? Math.round((c.confirms / total) * 100) : 0;
              return (
                <div key={c.concept}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{c.concept}</span>
                    <span className="text-green-600">{pct}% confirmados</span>
                  </div>
                  <Progress value={pct} className="h-2 bg-green-100" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {insights.no_feedback_yet.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-500">Sin feedback aún</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {insights.no_feedback_yet.map((c) => (
                <Badge key={c} variant="outline" className="text-xs">
                  {c}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Thresholds Tab ────────────────────────────────────────────────────────────
function ThresholdsTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["ml-thresholds"],
    queryFn: apiMLThresholds,
  });

  if (isLoading)
    return (
      <div className="flex items-center gap-2 text-gray-500 py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando umbrales...
      </div>
    );
  if (error)
    return (
      <div className="flex items-center gap-2 text-red-600 py-8">
        <AlertCircle className="h-4 w-4" /> Error al cargar umbrales
      </div>
    );
  if (!data) return null;

  const entries = Object.entries(data.thresholds);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{data.total_concepts} conceptos con multiplicadores adaptativos</p>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400">Concepto</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400">Multiplicador</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400">Fase</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400">Confianza</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400">Feedback total</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400">Recomendación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {entries.map(([concept, t]) => (
              <tr key={concept} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <td className="px-4 py-3 font-medium">{concept}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  <Badge
                    className={
                      t.multiplier > 1
                        ? "bg-orange-100 text-orange-800"
                        : t.multiplier < 1
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-700"
                    }
                  >
                    ×{t.multiplier.toFixed(2)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right text-xs">{t.phase}</td>
                <td className="px-4 py-3 text-right text-xs">
                  {t.confidence != null ? `${(t.confidence * 100).toFixed(0)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-right text-xs">{t.total_feedback}</td>
                <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{t.recommendation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Co-occurrence Tab ─────────────────────────────────────────────────────────
function CooccurrenceTab() {
  const [topN, setTopN] = useState(20);
  const { data, isLoading, error } = useQuery({
    queryKey: ["ml-cooccurrence", topN],
    queryFn: () => apiMLCooccurrence(topN),
  });

  if (isLoading)
    return (
      <div className="flex items-center gap-2 text-gray-500 py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando co-ocurrencias...
      </div>
    );
  if (error)
    return (
      <div className="flex items-center gap-2 text-red-600 py-8">
        <AlertCircle className="h-4 w-4" /> Error al cargar co-ocurrencias
      </div>
    );
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <p className="text-sm text-gray-500">
          {data.total_sessions_analyzed} sesiones analizadas
        </p>
        <div className="flex items-center gap-2">
          <Label htmlFor="topN-select" className="text-xs">Top N:</Label>
          <select
            id="topN-select"
            title="Seleccionar número de pares a mostrar"
            value={topN}
            onChange={(e) => setTopN(Number((e.target as HTMLSelectElement).value))}
            className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs"
          >
            {[10, 20, 30, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {data.top_pairs.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No hay datos de co-ocurrencia disponibles aún.
        </p>
      ) : (
        <div className="space-y-2">
          {data.top_pairs.map((pair, i) => (
            <div
              key={i}
              className="border rounded-lg p-3 flex items-center gap-4 bg-white dark:bg-gray-900"
            >
              <span className="text-xs font-mono text-gray-400 w-5">{i + 1}</span>
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {pair.pair[0]}
                </Badge>
                <span className="text-xs text-gray-400">+</span>
                <Badge variant="outline" className="text-xs">
                  {pair.pair[1]}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
                <span>{pair.count} veces</span>
                <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs">
                  {pair.sessions_pct.toFixed(1)}% sesiones
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Taxonomy Tab ──────────────────────────────────────────────────────────────
function TaxonomyTab() {
  const [selectedConcept, setSelectedConcept] = useState<string>("");

  const { data: allData, isLoading: allLoading } = useQuery({
    queryKey: ["ml-taxonomy-all"],
    queryFn: () => apiMLTaxonomy(),
  });

  const { data: conceptData, isLoading: conceptLoading } = useQuery({
    queryKey: ["ml-taxonomy-concept", selectedConcept],
    queryFn: () => apiMLTaxonomy(selectedConcept),
    enabled: !!selectedConcept,
  });

  const displayData = selectedConcept ? conceptData : allData;
  const isLoading = selectedConcept ? conceptLoading : allLoading;

  const concepts = allData ? Object.keys(allData) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label htmlFor="concept-select" className="text-sm shrink-0">Filtrar concepto:</Label>
        <select
          id="concept-select"
          title="Seleccionar concepto para filtrar la taxonomía"
          value={selectedConcept}
          onChange={(e) => setSelectedConcept((e.target as HTMLSelectElement).value)}
          className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 flex-1 max-w-xs"
        >
          <option value="">Todos los conceptos</option>
          {concepts.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-gray-500 py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando taxonomía...
        </div>
      )}

      {displayData && (
        <div className="space-y-4">
          {Object.entries(displayData).map(([concept, codes]) => (
            <Card key={concept}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <CardTitle className="text-sm">{codes.label_es || concept}</CardTitle>
                  <span className="text-xs text-gray-400 font-mono">{concept}</span>
                  <Badge
                    className={
                      codes.severity === "critica"
                        ? "bg-red-100 text-red-800"
                        : codes.severity === "alta"
                        ? "bg-orange-100 text-orange-800"
                        : "bg-yellow-100 text-yellow-800"
                    }
                  >
                    {codes.severity}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">CEDAW</p>
                    <div className="flex flex-wrap gap-1">
                      {codes.CEDAW?.length ? (
                        codes.CEDAW.map((c) => (
                          <Badge key={c} variant="outline" className="text-xs">
                            {c}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">Convenio Estambul</p>
                    <div className="flex flex-wrap gap-1">
                      {codes.istanbul?.length ? (
                        codes.istanbul.map((c) => (
                          <Badge key={c} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            {c}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">ICD-11</p>
                    <div className="flex flex-wrap gap-1">
                      {codes.ICD11?.length ? (
                        codes.ICD11.map((c) => (
                          <Badge key={c} variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                            {c}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">CP España</p>
                    <div className="flex flex-wrap gap-1">
                      {codes.CP_ES?.length ? (
                        codes.CP_ES.map((c) => (
                          <Badge key={c} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            {c}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  </div>
                </div>
                {codes.note && (
                  <p className="mt-3 text-xs text-gray-500 italic border-t pt-2">{codes.note}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ML Page ──────────────────────────────────────────────────────────────
export default function MLPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="space-y-3">
        <div className="lab-chip lab-tone-analytics">Analitica</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Brain className="h-6 w-6 text-amber-600" /> ML & Analytics
        </h1>
        <p className="text-gray-500 mt-1">
          Insights adaptativos, umbrales por concepto, co-ocurrencias y taxonomía normativa
        </p>
      </div>

      <Tabs defaultValue="insights">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="insights" className="gap-2 text-xs">
            <TrendingUp className="h-3 w-3" /> Insights
          </TabsTrigger>
          <TabsTrigger value="thresholds" className="gap-2 text-xs">
            <Brain className="h-3 w-3" /> Umbrales
          </TabsTrigger>
          <TabsTrigger value="cooccurrence" className="gap-2 text-xs">
            <Network className="h-3 w-3" /> Co-ocurrencia
          </TabsTrigger>
          <TabsTrigger value="taxonomy" className="gap-2 text-xs">
            <BookOpen className="h-3 w-3" /> Taxonomía
          </TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="mt-6">
          <InsightsTab />
        </TabsContent>
        <TabsContent value="thresholds" className="mt-6">
          <ThresholdsTab />
        </TabsContent>
        <TabsContent value="cooccurrence" className="mt-6">
          <CooccurrenceTab />
        </TabsContent>
        <TabsContent value="taxonomy" className="mt-6">
          <TaxonomyTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
