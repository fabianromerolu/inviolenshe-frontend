"use client";
import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import type { KeywordMatch, ManualDetectionBody } from "@/lib/api";
import { apiCreateManualDetection } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

interface MediaPlayerProps {
  file: File;
  duration: number;
  matches: KeywordMatch[];
  sourceType: "audio" | "video";
  sessionId?: string;
  onManualDetectionCreated?: () => void;
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(":");
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  const s = Number(parts[2]) || 0;
  return h * 3600 + m * 60 + s;
}

function secondsToTimestamp(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
}

const SEVERITY_COLORS: Record<string, string> = {
  critica: "#ef4444",
  alta: "#f97316",
  media: "#eab308",
};

const SEVERITY_BG: Record<string, string> = {
  critica: "bg-red-100 text-red-800 border-red-200",
  alta: "bg-orange-100 text-orange-800 border-orange-200",
  media: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

export function MediaPlayer({
  file,
  duration,
  matches,
  sourceType,
  sessionId,
  onManualDetectionCreated,
}: MediaPlayerProps) {
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [activeMatch, setActiveMatch] = useState<string | null>(null);

  // Timeline drag state for manual detection
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartSec, setDragStartSec] = useState<number | null>(null);
  const [dragEndSec, setDragEndSec] = useState<number | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    label: "",
    matched_term: "",
    timestamp_start: "00:00:00.000",
    timestamp_end: "00:00:00.000",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const src = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => URL.revokeObjectURL(src);
  }, [src]);

  const totalDuration = duration > 0 ? duration : 1;

  const handleTimeUpdate = () => {
    if (!mediaRef.current) return;
    const t = mediaRef.current.currentTime;
    setCurrentTime(t);
    const active = matches.find(
      (m) => parseTimestamp(m.timestamp_start) <= t && t <= parseTimestamp(m.timestamp_end)
    );
    setActiveMatch(active ? active.matched_term : null);
  };

  const seekTo = useCallback(
    (secs: number) => {
      if (!mediaRef.current) return;
      mediaRef.current.currentTime = secs;
      if (!playing) mediaRef.current.play().catch(() => {});
    },
    [playing]
  );

  // ── Timeline pointer events ────────────────────────────────────────────────

  function getRatioFromEvent(e: React.PointerEvent<HTMLDivElement>): number {
    const bar = progressBarRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    const ratio = getRatioFromEvent(e);
    const secs = ratio * totalDuration;
    setIsDragging(true);
    setDragStartSec(secs);
    setDragEndSec(secs);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging) return;
    const ratio = getRatioFromEvent(e);
    setDragEndSec(ratio * totalDuration);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging) return;
    setIsDragging(false);
    const ratio = getRatioFromEvent(e);
    const endSec = ratio * totalDuration;
    setDragEndSec(endSec);

    const start = dragStartSec ?? 0;
    const diff = Math.abs(endSec - start);

    if (diff > 0.2 && sessionId) {
      // Open manual detection modal pre-filled with time range
      const ts = secondsToTimestamp(Math.min(start, endSec));
      const te = secondsToTimestamp(Math.max(start, endSec));
      setManualForm({ label: "", matched_term: "", timestamp_start: ts, timestamp_end: te, notes: "" });
      setShowManualModal(true);
    } else {
      // Regular click → seek
      if (!mediaRef.current) return;
      mediaRef.current.currentTime = endSec;
    }
  }

  async function handleManualSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!sessionId || !manualForm.label || !manualForm.matched_term) return;
    setSubmitting(true);
    try {
      const body: ManualDetectionBody = {
        label: manualForm.label,
        matched_term: manualForm.matched_term,
        timestamp_start: manualForm.timestamp_start,
        timestamp_end: manualForm.timestamp_end,
        notes: manualForm.notes || undefined,
        source: "timeline",
      };
      await apiCreateManualDetection(sessionId, body);
      setShowManualModal(false);
      setDragStartSec(null);
      setDragEndSec(null);
      onManualDetectionCreated?.();
    } catch {
      // noop
    } finally {
      setSubmitting(false);
    }
  }

  const togglePlay = () => {
    if (!mediaRef.current) return;
    if (playing) {
      mediaRef.current.pause();
    } else {
      mediaRef.current.play().catch(() => {});
    }
    setPlaying(!playing);
  };

  const toggleMute = () => {
    if (!mediaRef.current) return;
    mediaRef.current.muted = !muted;
    setMuted(!muted);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progressPct = (currentTime / totalDuration) * 100;

  // Drag overlay percentages
  const dragMinPct =
    dragStartSec !== null && dragEndSec !== null
      ? (Math.min(dragStartSec, dragEndSec) / totalDuration) * 100
      : null;
  const dragMaxPct =
    dragStartSec !== null && dragEndSec !== null
      ? (Math.max(dragStartSec, dragEndSec) / totalDuration) * 100
      : null;

  return (
    <div className="space-y-4">
      {/* Reproductor */}
      <div className="rounded-xl overflow-hidden bg-gray-950 border border-gray-800">
        {sourceType === "video" ? (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={src}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className="w-full max-h-64 object-contain"
          />
        ) : (
          <audio
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            src={src}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        )}

        {/* Controles */}
        <div className="px-4 pb-4 pt-3 space-y-2">
          {sessionId && (
            <p className="text-xs text-gray-500">
              Arrastra en la barra para marcar un rango como detección manual
            </p>
          )}
          {/* Barra de progreso con marcadores */}
          <div
            ref={progressBarRef}
            className="relative h-5 cursor-crosshair group select-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* Track fondo */}
            <div className="absolute inset-y-1.5 inset-x-0 bg-gray-700 rounded-full" />
            {/* Progreso */}
            <div
              className="absolute inset-y-1.5 left-0 bg-rose-500 rounded-full transition-all pointer-events-none"
              style={{ width: `${progressPct}%` }}
            />
            {/* Marcadores de detecciones */}
            {matches.map((m, i) => {
              const startPct = (parseTimestamp(m.timestamp_start) / totalDuration) * 100;
              const endPct = (parseTimestamp(m.timestamp_end) / totalDuration) * 100;
              const color = SEVERITY_COLORS[m.severity] || "#64748b";
              return (
                <div
                  key={i}
                  className="absolute inset-y-0 pointer-events-none"
                  style={{ left: `${startPct}%`, width: `${Math.max(endPct - startPct, 0.5)}%` }}
                  title={`${m.label} — "${m.matched_term}" (${m.timestamp_start})`}
                >
                  <div
                    className="absolute inset-y-0 w-full rounded-sm opacity-70"
                    style={{ backgroundColor: color }}
                  />
                </div>
              );
            })}
            {/* Drag selection overlay */}
            {dragMinPct !== null && dragMaxPct !== null && dragMaxPct - dragMinPct > 0.1 && (
              <div
                className="absolute inset-y-0 bg-blue-400/30 border-x border-blue-400 pointer-events-none"
                style={{ left: `${dragMinPct}%`, width: `${dragMaxPct - dragMinPct}%` }}
              />
            )}
            {/* Cabezal */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg -translate-x-1/2 pointer-events-none"
              style={{ left: `${progressPct}%` }}
            />
          </div>

          {/* Botones + tiempo */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="text-white hover:text-rose-400 transition-colors"
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button
              onClick={toggleMute}
              className="text-gray-400 hover:text-white transition-colors"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <span className="text-xs text-gray-400 font-mono">
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </span>
            {activeMatch && (
              <span className="ml-auto text-xs text-rose-400 font-medium truncate max-w-[200px]">
                ● {activeMatch}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lista de detecciones como marcadores clicables */}
      {matches.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Momentos detectados — clic para saltar
          </p>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {matches.map((m, i) => (
              <button
                key={i}
                onClick={() => seekTo(parseTimestamp(m.timestamp_start))}
                className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition-colors hover:opacity-80 ${SEVERITY_BG[m.severity] || "bg-gray-50 border-gray-200"}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-gray-500">{m.timestamp_start}</span>
                  <Badge className="text-xs px-1.5 py-0">{m.label}</Badge>
                  <span className="font-medium">&ldquo;{m.matched_term}&rdquo;</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {matches.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          No se detectaron términos. Puedes arrastrar en el timeline para marcar manualmente.
        </p>
      )}

      {/* Modal de detección manual desde timeline */}
      <Dialog open={showManualModal} onOpenChange={setShowManualModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar detección manual</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleManualSubmit} className="space-y-3 text-sm">
            <div>
              <Label>Concepto / etiqueta *</Label>
              <Input
                value={manualForm.label}
                onChange={(e) => setManualForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="ej. violacion, acoso, grooming"
                required
              />
            </div>
            <div>
              <Label>Término detectado *</Label>
              <Input
                value={manualForm.matched_term}
                onChange={(e) => setManualForm((f) => ({ ...f, matched_term: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Inicio</Label>
                <Input
                  value={manualForm.timestamp_start}
                  onChange={(e) => setManualForm((f) => ({ ...f, timestamp_start: e.target.value }))}
                />
              </div>
              <div>
                <Label>Fin</Label>
                <Input
                  value={manualForm.timestamp_end}
                  onChange={(e) => setManualForm((f) => ({ ...f, timestamp_end: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea
                value={manualForm.notes}
                onChange={(e) => setManualForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                maxLength={1000}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setShowManualModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
