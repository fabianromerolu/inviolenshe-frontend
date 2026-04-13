"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiCreateManualDetection, type KeywordMatch, type ManualDetectionBody } from "@/lib/api";

interface TranscriptViewerProps {
  text: string;
  matches: KeywordMatch[];
  sessionId: string;
  language?: string;
  onManualDetectionCreated?: () => void;
}

function buildHighlightedHtml(text: string, matches: KeywordMatch[]): string {
  if (!text) return "";

  // Build a sorted list of (start, end, severity) ranges from matched_term occurrences
  const ranges: Array<{ start: number; end: number; severity: string }> = [];

  for (const match of matches) {
    const term = match.matched_term;
    if (!term) continue;
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      ranges.push({ start: m.index, end: m.index + m[0].length, severity: match.severity });
    }
  }

  if (ranges.length === 0) return escapeHtml(text);

  // Sort by start, deduplicate overlapping
  ranges.sort((a, b) => a.start - b.start);
  const merged: typeof ranges = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start < last.end) {
      if (r.end > last.end) last.end = r.end;
    } else {
      merged.push({ ...r });
    }
  }

  let result = "";
  let cursor = 0;
  for (const { start, end, severity } of merged) {
    result += escapeHtml(text.slice(cursor, start));
    const colorClass =
      severity === "critica"
        ? "bg-red-200 text-red-900"
        : severity === "alta"
        ? "bg-orange-200 text-orange-900"
        : "bg-yellow-200 text-yellow-900";
    result += `<mark class="${colorClass} rounded px-0.5">${escapeHtml(text.slice(start, end))}</mark>`;
    cursor = end;
  }
  result += escapeHtml(text.slice(cursor));
  return result;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function TranscriptViewer({
  text,
  matches,
  sessionId,
  language = "es",
  onManualDetectionCreated,
}: TranscriptViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [floatingPos, setFloatingPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<{
    label: string;
    matched_term: string;
    timestamp_start: string;
    timestamp_end: string;
    notes: string;
  }>({ label: "", matched_term: "", timestamp_start: "00:00:00.000", timestamp_end: "00:00:00.000", notes: "" });
  const [submitting, setSubmitting] = useState(false);

  function handleMouseUp() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.toString().trim().length < 2) {
      setFloatingPos(null);
      setSelectedText("");
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelectedText(sel.toString().trim());
    setFloatingPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
  }

  function openModal() {
    setForm((f) => ({ ...f, label: "", matched_term: selectedText, notes: "" }));
    setFloatingPos(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      // noop — error is caught silently; user can retry
    } finally {
      setSubmitting(false);
    }
  }

  const highlightedHtml = buildHighlightedHtml(text, matches);

  return (
    <div className="relative">
      {/* Transcript text */}
      <div
        ref={containerRef}
        className="max-h-72 overflow-y-auto rounded border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap select-text"
        onMouseUp={handleMouseUp}
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      />

      {/* Floating "Marcar manualmente" button near selection */}
      {floatingPos && (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full"
          style={{ left: floatingPos.x, top: floatingPos.y }}
        >
          <Button size="sm" variant="outline" className="shadow-lg text-xs" onClick={openModal}>
            ✏️ Marcar manualmente
          </Button>
        </div>
      )}

      {/* Manual detection modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar detección manual</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 text-sm">
            <div>
              <Label>Concepto / etiqueta *</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="ej. violacion, acoso, grooming"
                required
              />
            </div>
            <div>
              <Label>Término detectado *</Label>
              <Input
                value={form.matched_term}
                onChange={(e) => setForm((f) => ({ ...f, matched_term: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Inicio (HH:MM:SS.mmm)</Label>
                <Input
                  value={form.timestamp_start}
                  onChange={(e) => setForm((f) => ({ ...f, timestamp_start: e.target.value }))}
                  placeholder="00:00:00.000"
                />
              </div>
              <div>
                <Label>Fin (HH:MM:SS.mmm)</Label>
                <Input
                  value={form.timestamp_end}
                  onChange={(e) => setForm((f) => ({ ...f, timestamp_end: e.target.value }))}
                  placeholder="00:00:00.000"
                />
              </div>
            </div>
            <div>
              <Label>Notas del investigador</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
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
                {submitting ? "Guardando..." : "Guardar detección"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
