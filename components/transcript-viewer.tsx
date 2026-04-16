"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  apiCreateManualDetection,
  type KeywordMatch,
  type ManualDetectionBody,
  type ReviewCandidate,
} from "@/lib/api";

interface TranscriptViewerProps {
  text: string;
  matches: KeywordMatch[];
  reviewCandidates?: ReviewCandidate[];
  sessionId: string;
  language?: string;
  onManualDetectionCreated?: () => void;
}

type HighlightRange = {
  start: number;
  end: number;
  kind: "match" | "review";
  severity?: string;
  tooltip: string;
  priority: number;
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHighlightedHtml(
  text: string,
  matches: KeywordMatch[],
  reviewCandidates: ReviewCandidate[] = []
): string {
  if (!text) return "";

  const ranges: HighlightRange[] = [];

  for (const match of matches) {
    const term = match.matched_term;
    if (!term) continue;
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    let nextMatch: RegExpExecArray | null;

    while ((nextMatch = regex.exec(text)) !== null) {
      ranges.push({
        start: nextMatch.index,
        end: nextMatch.index + nextMatch[0].length,
        kind: "match",
        severity: match.severity,
        tooltip: `${match.label}: ${match.matched_term}`,
        priority: 2,
      });
    }
  }

  for (const candidate of reviewCandidates) {
    const term = candidate.detected_word;
    if (!term) continue;
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    let nextMatch: RegExpExecArray | null;

    while ((nextMatch = regex.exec(text)) !== null) {
      ranges.push({
        start: nextMatch.index,
        end: nextMatch.index + nextMatch[0].length,
        kind: "review",
        tooltip: `${candidate.label}: ${candidate.detected_word} -> ${candidate.suggested_term} (${Math.round(candidate.similarity * 100)}%)`,
        priority: 1,
      });
    }
  }

  if (ranges.length === 0) return escapeHtml(text);

  ranges.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.end - b.start - (a.end - a.start);
  });

  const filtered: HighlightRange[] = [];
  for (const range of ranges) {
    const last = filtered[filtered.length - 1];
    if (!last || range.start >= last.end) {
      filtered.push({ ...range });
    }
  }

  let result = "";
  let cursor = 0;

  for (const { start, end, severity, kind, tooltip } of filtered) {
    result += escapeHtml(text.slice(cursor, start));
    const colorClass =
      kind === "review"
        ? "rounded border border-sky-300 bg-sky-100 px-0.5 text-sky-900"
        : severity === "critica"
          ? "rounded bg-red-200 px-0.5 text-red-900"
          : severity === "alta"
            ? "rounded bg-orange-200 px-0.5 text-orange-900"
            : "rounded bg-yellow-200 px-0.5 text-yellow-900";

    result += `<mark class="${colorClass}" title="${escapeHtml(tooltip)}">${escapeHtml(text.slice(start, end))}</mark>`;
    cursor = end;
  }

  result += escapeHtml(text.slice(cursor));
  return result;
}

export function TranscriptViewer({
  text,
  matches,
  reviewCandidates = [],
  sessionId,
  language = "es",
  onManualDetectionCreated,
}: TranscriptViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [floatingPos, setFloatingPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    label: "",
    matched_term: "",
    timestamp_start: "00:00:00.000",
    timestamp_end: "00:00:00.000",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  function handleMouseUp() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.toString().trim().length < 2) {
      setFloatingPos(null);
      setSelectedText("");
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelectedText(selection.toString().trim());
    setFloatingPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
  }

  function openModal() {
    setForm((current) => ({ ...current, label: "", matched_term: selectedText, notes: "" }));
    setFloatingPos(null);
    setShowModal(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.label || !form.matched_term) return;

    setSubmitting(true);
    try {
      const body: ManualDetectionBody = {
        label: form.label,
        matched_term: form.matched_term,
        timestamp_start: form.timestamp_start || "00:00:00.000",
        timestamp_end: form.timestamp_end || "00:00:00.000",
        notes: form.notes || undefined,
        source: "transcript",
        language,
      };

      await apiCreateManualDetection(sessionId, body);
      setShowModal(false);
      onManualDetectionCreated?.();
    } catch {
      // noop
    } finally {
      setSubmitting(false);
    }
  }

  const highlightedHtml = buildHighlightedHtml(text, matches, reviewCandidates);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="max-h-72 overflow-y-auto rounded border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap select-text"
        onMouseUp={handleMouseUp}
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      />

      {floatingPos && (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full"
          style={{ left: floatingPos.x, top: floatingPos.y }}
        >
          <Button size="sm" variant="outline" className="text-xs shadow-lg" onClick={openModal}>
            Marcar manualmente
          </Button>
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar deteccion manual</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 text-sm">
            <div>
              <Label>Concepto / etiqueta *</Label>
              <Input
                value={form.label}
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                placeholder="ej. violacion, acoso, grooming"
                required
              />
            </div>
            <div>
              <Label>Termino detectado *</Label>
              <Input
                value={form.matched_term}
                onChange={(event) => setForm((current) => ({ ...current, matched_term: event.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Inicio (HH:MM:SS.mmm)</Label>
                <Input
                  value={form.timestamp_start}
                  onChange={(event) => setForm((current) => ({ ...current, timestamp_start: event.target.value }))}
                  placeholder="00:00:00.000"
                />
              </div>
              <div>
                <Label>Fin (HH:MM:SS.mmm)</Label>
                <Input
                  value={form.timestamp_end}
                  onChange={(event) => setForm((current) => ({ ...current, timestamp_end: event.target.value }))}
                  placeholder="00:00:00.000"
                />
              </div>
            </div>
            <div>
              <Label>Notas del investigador</Label>
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                rows={3}
                maxLength={1000}
                placeholder="Contexto adicional..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Guardando..." : "Guardar deteccion"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
