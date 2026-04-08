"use client";
import { useState, useEffect, useRef } from "react";
import type { KeywordMatch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";

interface DocumentViewerProps {
  file: File;
  matches: Array<KeywordMatch & { page_number?: number }>;
}

// Escapa caracteres especiales de regex
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Aplica highlights a texto plano usando los matched_terms
function highlightText(text: string, terms: string[]): string {
  if (!terms.length) return text;
  const pattern = terms
    .map(escapeRegex)
    .sort((a, b) => b.length - a.length) // longest first
    .join("|");
  const re = new RegExp(`(${pattern})`, "gi");
  return text.replace(re, '<mark class="bg-yellow-200 dark:bg-yellow-700 rounded px-0.5">$1</mark>');
}

// Genera HTML descargable con highlights
function generateHighlightedHTML(filename: string, text: string, terms: string[]): string {
  const highlighted = highlightText(text, terms);
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>${filename} — In-Violenshe Lab</title>
<style>
  body { font-family: Georgia, serif; max-width: 800px; margin: 2rem auto; line-height: 1.7; color: #111; }
  h1 { font-size: 1.1rem; color: #666; margin-bottom: 1.5rem; }
  pre { white-space: pre-wrap; word-break: break-word; }
  mark { background: #fef08a; padding: 0 2px; border-radius: 2px; }
  @media print { body { margin: 1cm; } }
</style>
</head>
<body>
<h1>Análisis forense: ${filename}</h1>
<pre>${highlighted}</pre>
</body>
</html>`;
}

function TextViewer({
  file,
  matches,
}: {
  file: File;
  matches: Array<KeywordMatch & { page_number?: number }>;
}) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    file.text().then(setText);
  }, [file]);

  const terms = [...new Set(matches.map((m) => m.matched_term).filter(Boolean))];

  const handleDownload = () => {
    if (!text) return;
    const html = generateHighlightedHTML(file.name, text, terms);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name.replace(/\.txt$/, "") + "_highlights.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!text) {
    return (
      <div className="flex items-center gap-2 text-gray-500 py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando texto...
      </div>
    );
  }

  const highlighted = highlightText(text, terms);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{terms.length} términos resaltados</p>
        <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1">
          <Download className="h-3.5 w-3.5" /> Descargar con highlights
        </Button>
      </div>
      <div
        className="border rounded-lg p-4 bg-white dark:bg-gray-900 max-h-[500px] overflow-auto"
      >
        <pre
          className="text-sm whitespace-pre-wrap break-words font-mono leading-relaxed dark:text-gray-200"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </div>
    </div>
  );
}

function PDFViewer({
  file,
  matches,
}: {
  file: File;
  matches: Array<KeywordMatch & { page_number?: number }>;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const terms = [...new Set(matches.map((m) => m.matched_term).filter(Boolean))];

  const handleDownload = async () => {
    // Genera un informe HTML con el contexto de cada detección
    const rows = matches
      .map((m) => {
        const span = m.matched_span
          ? m.matched_span.replace(
              new RegExp(`(${escapeRegex(m.matched_term)})`, "gi"),
              '<mark style="background:#fef08a;padding:0 2px;border-radius:2px;">$1</mark>'
            )
          : m.matched_term;
        return `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${m.page_number ?? "—"}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:monospace;">${m.matched_term}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${m.label}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:0.85em;color:#555;">${span}</td>
        </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/>
<title>${file.name} — Informe forense</title>
<style>body{font-family:sans-serif;max-width:900px;margin:2rem auto;color:#111}
h1{font-size:1.1rem;color:#666}table{width:100%;border-collapse:collapse}
th{background:#f1f5f9;text-align:left;padding:8px 10px;font-size:0.8rem;color:#555}
@media print{body{margin:1cm}}</style>
</head><body>
<h1>Informe forense — ${file.name}</h1>
<p style="color:#666;font-size:0.85rem">${matches.length} detecciones · Generado por In-Violenshe Lab</p>
<table><thead><tr><th>Pág.</th><th>Término</th><th>Concepto</th><th>Contexto</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name.replace(/\.pdf$/, "") + "_informe_forense.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  const pageMatches = matches.filter((m) => !selectedPage || m.page_number === selectedPage);
  const pages = [...new Set(matches.map((m) => m.page_number).filter(Boolean) as number[])].sort(
    (a, b) => a - b
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* PDF embed */}
      <div className="md:col-span-2 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">{terms.length} términos detectados en {pages.length} páginas</p>
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1">
            <Download className="h-3.5 w-3.5" /> Informe con highlights
          </Button>
        </div>
        {src ? (
          <iframe
            src={`${src}#page=${selectedPage ?? 1}`}
            className="w-full rounded-lg border"
            style={{ height: 500 }}
            title="Vista previa PDF"
          />
        ) : (
          <div className="flex items-center gap-2 text-gray-500 py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando PDF...
          </div>
        )}
      </div>

      {/* Panel lateral de detecciones */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Detecciones</p>
          {selectedPage && (
            <button
              onClick={() => setSelectedPage(null)}
              className="text-xs text-rose-600 underline"
            >
              ver todas
            </button>
          )}
        </div>
        <div className="space-y-1.5 max-h-[460px] overflow-y-auto">
          {pageMatches.map((m, i) => (
            <button
              key={i}
              onClick={() => {
                if (m.page_number) setSelectedPage(m.page_number);
              }}
              className="w-full text-left rounded-lg border px-3 py-2 text-xs bg-white dark:bg-gray-900 hover:bg-yellow-50 dark:hover:bg-yellow-950 border-yellow-200 transition-colors"
            >
              {m.page_number && (
                <span className="inline-block bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 text-xs mr-2">
                  Pág. {m.page_number}
                </span>
              )}
              <Badge className="text-xs px-1.5 py-0 mr-1">{m.label}</Badge>
              <span className="font-medium">&ldquo;{m.matched_term}&rdquo;</span>
              {m.matched_span && (
                <p className="text-gray-500 mt-0.5 italic truncate">{m.matched_span}</p>
              )}
            </button>
          ))}
          {pageMatches.length === 0 && (
            <p className="text-xs text-gray-400 py-4 text-center">Sin detecciones en esta página</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DocxViewer({
  matches,
}: {
  matches: Array<KeywordMatch & { page_number?: number }>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
        <FileText className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-200">
          La vista previa inline de archivos DOCX no está disponible. Las detecciones y su contexto se muestran abajo.
        </p>
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {matches.map((m, i) => (
          <div key={i} className="border rounded-lg p-3 bg-white dark:bg-gray-900 text-xs">
            {m.page_number && (
              <Badge variant="outline" className="mb-1 text-xs">Pág. {m.page_number}</Badge>
            )}
            <p className="font-medium mb-1">
              <Badge className="mr-1 text-xs">{m.label}</Badge>
              &ldquo;{m.matched_term}&rdquo;
            </p>
            {m.matched_span && (
              <p className="text-gray-500 italic">&ldquo;{m.matched_span}&rdquo;</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DocumentViewer({ file, matches }: DocumentViewerProps) {
  const ext = file.name.split(".").pop()?.toLowerCase();

  return (
    <div>
      {ext === "txt" && <TextViewer file={file} matches={matches} />}
      {ext === "pdf" && <PDFViewer file={file} matches={matches} />}
      {ext === "docx" && <DocxViewer matches={matches} />}
    </div>
  );
}
