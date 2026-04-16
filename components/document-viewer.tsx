"use client";

import { useMemo, useState } from "react";
import type { DocumentMatch, DocumentPageContent, TranscriptResponse } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileSearch } from "lucide-react";

interface DocumentViewerProps {
  filename: string;
  sourceType: string;
  transcript: TranscriptResponse | null;
  matches: Array<DocumentMatch | (DocumentMatch & { page_number?: number })>;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getMatchPage(match: DocumentMatch | (DocumentMatch & { page_number?: number })) {
  return typeof match.page === "number" ? match.page : match.page_number;
}

function buildRegexHighlightedHtml(text: string, terms: string[]) {
  if (!terms.length) return escapeHtml(text);
  const pattern = terms
    .filter(Boolean)
    .map(escapeRegex)
    .sort((a, b) => b.length - a.length)
    .join("|");

  if (!pattern) return escapeHtml(text);

  return escapeHtml(text).replace(
    new RegExp(`(${pattern})`, "gi"),
    '<mark class="rounded bg-yellow-200 px-0.5 text-yellow-950">$1</mark>'
  );
}

function buildPageHighlightedHtml(
  page: DocumentPageContent,
  matches: Array<DocumentMatch | (DocumentMatch & { page_number?: number })>
) {
  const pageMatches = matches.filter((match) => getMatchPage(match) === page.page);
  const exactRanges = pageMatches
    .filter((match) => typeof match.char_start === "number" && typeof match.char_end === "number")
    .map((match) => ({
      start: Math.max(0, match.char_start - page.char_start),
      end: Math.min(page.text.length, match.char_end - page.char_start),
      severity: match.severity,
    }))
    .filter((range) => range.start < range.end)
    .sort((a, b) => a.start - b.start);

  if (!exactRanges.length) {
    const terms = [...new Set(pageMatches.map((match) => match.matched_term).filter(Boolean))];
    return buildRegexHighlightedHtml(page.text, terms);
  }

  const merged: Array<{ start: number; end: number; severity: string }> = [];
  for (const range of exactRanges) {
    const last = merged[merged.length - 1];
    if (last && range.start < last.end) {
      last.end = Math.max(last.end, range.end);
      continue;
    }
    merged.push({ ...range });
  }

  let result = "";
  let cursor = 0;

  for (const range of merged) {
    const colorClass =
      range.severity === "critica"
        ? "rounded bg-red-200 px-0.5 text-red-950"
        : range.severity === "alta"
          ? "rounded bg-orange-200 px-0.5 text-orange-950"
          : "rounded bg-yellow-200 px-0.5 text-yellow-950";

    result += escapeHtml(page.text.slice(cursor, range.start));
    result += `<mark class="${colorClass}">${escapeHtml(page.text.slice(range.start, range.end))}</mark>`;
    cursor = range.end;
  }

  result += escapeHtml(page.text.slice(cursor));
  return result;
}

function buildHighlightedDocumentHtml(
  filename: string,
  pages: DocumentPageContent[],
  matches: Array<DocumentMatch | (DocumentMatch & { page_number?: number })>
) {
  const renderedPages = pages
    .map((page) => {
      const highlighted = buildPageHighlightedHtml(page, matches);
      return `<section class="page">
  <header class="page-header">Página ${page.page}</header>
  <pre>${highlighted}</pre>
</section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(filename)} - Documento resaltado</title>
  <style>
    body { font-family: Georgia, serif; margin: 2rem auto; max-width: 960px; color: #111827; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { color: #6b7280; margin-bottom: 1.5rem; }
    .page { border: 1px solid #e5e7eb; border-radius: 14px; padding: 1.25rem; margin-bottom: 1rem; background: #fff; }
    .page-header { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 0.75rem; }
    pre { white-space: pre-wrap; word-break: break-word; line-height: 1.7; margin: 0; }
    mark { border-radius: 4px; padding: 0 2px; }
    @media print { body { margin: 1cm; max-width: none; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(filename)}</h1>
  <p>Versión resaltada generada desde el texto extraído del documento.</p>
  ${renderedPages}
</body>
</html>`;
}

function downloadHighlightedDocument(
  filename: string,
  pages: DocumentPageContent[],
  matches: Array<DocumentMatch | (DocumentMatch & { page_number?: number })>
) {
  const html = buildHighlightedDocumentHtml(filename, pages, matches);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/\.[^.]+$/, "") + "_resaltado.html";
  link.click();
  URL.revokeObjectURL(url);
}

export function DocumentViewer({ filename, sourceType, transcript, matches }: DocumentViewerProps) {
  const [selectedPage, setSelectedPage] = useState<number | null>(null);

  const pages = useMemo(() => {
    if (transcript?.document_pages?.length) {
      return transcript.document_pages;
    }

    if (!transcript?.text) {
      return [];
    }

    return [
      {
        page: sourceType === "txt" ? 0 : 1,
        char_start: 0,
        char_end: transcript.text.length,
        text: transcript.text,
      },
    ] satisfies DocumentPageContent[];
  }, [sourceType, transcript]);

  const visiblePages = selectedPage ? pages.filter((page) => page.page === selectedPage) : pages;

  if (!transcript) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        Estamos reconstruyendo el contenido del documento para mostrar el preview resaltado.
      </div>
    );
  }

  if (!pages.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        No se pudo reconstruir la vista previa del documento para esta sesión.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{sourceType.toUpperCase()}</Badge>
              <Badge variant="outline">{matches.length} detecciones</Badge>
              <Badge variant="outline">{pages.length} páginas con texto</Badge>
            </div>
            <p className="text-sm text-slate-600">
              El preview usa el texto extraído y resalta las coincidencias dentro del propio documento.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedPage != null && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedPage(null)}>
                Ver todo
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => downloadHighlightedDocument(filename, pages, matches)}
            >
              <Download className="h-3.5 w-3.5" />
              Descargar resaltado
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_320px]">
        <div className="space-y-4">
          {visiblePages.map((page) => (
            <section
              key={page.page}
              id={`document-page-${page.page}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileSearch className="h-4 w-4 text-sky-600" />
                  <p className="text-sm font-semibold text-slate-800">Página {page.page}</p>
                </div>
                <p className="text-xs text-slate-500">
                  {(matches.filter((match) => getMatchPage(match) === page.page) || []).length} match(es)
                </p>
              </div>
              <pre
                className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700"
                dangerouslySetInnerHTML={{ __html: buildPageHighlightedHtml(page, matches) }}
              />
            </section>
          ))}
        </div>

        <aside className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Detecciones</p>
            <span className="text-xs text-slate-500">{matches.length}</span>
          </div>

          <div className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
            {matches.map((match, index) => {
              const page = getMatchPage(match);
              return (
                <button
                  key={`${match.matched_term}-${index}`}
                  type="button"
                  onClick={() => {
                    if (page == null) return;
                    setSelectedPage(page);
                    requestAnimationFrame(() => {
                      document.getElementById(`document-page-${page}`)?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    });
                  }}
                  className="w-full rounded-xl border border-amber-200 bg-white px-3 py-3 text-left transition hover:bg-amber-50"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {page != null && (
                      <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                        Página {page}
                      </Badge>
                    )}
                    <Badge>{match.label}</Badge>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">&ldquo;{match.matched_term}&rdquo;</p>
                  {match.matched_span && <p className="mt-1 text-xs italic text-slate-500">{match.matched_span}</p>}
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
