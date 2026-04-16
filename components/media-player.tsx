"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { apiCreateManualDetection } from "@/lib/api";
import type { KeywordMatch, ManualDetectionBody, ReviewCandidate } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface MediaPlayerProps {
  file: File;
  duration: number;
  matches: KeywordMatch[];
  reviewCandidates?: ReviewCandidate[];
  sourceType: "audio" | "video";
  sessionId?: string;
  onManualDetectionCreated?: () => void;
}

interface TimelineItem {
  key: string;
  kind: "match" | "review";
  startSec: number;
  endSec: number;
  timestamp_start: string;
  timestamp_end: string;
  badgeLabel: string;
  primaryText: string;
  secondaryText?: string;
  title: string;
  toneClassName: string;
  color: string;
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
  reviewCandidates = [],
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
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const [src, setSrc] = useState<string | null>(null);

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

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  useEffect(() => {
    setCurrentTime(0);
    setPlaying(false);
    setActiveMatch(null);
    setMediaDuration(null);
  }, [src]);

  useEffect(() => {
    if (!src || !mediaRef.current) return;
    mediaRef.current.load();
  }, [src]);

  const timelineItems = useMemo<TimelineItem[]>(
    () =>
      [
        ...matches.map((match, index) => ({
          key: `match-${match.id ?? index}-${match.timestamp_start}`,
          kind: "match" as const,
          startSec: parseTimestamp(match.timestamp_start),
          endSec: parseTimestamp(match.timestamp_end),
          timestamp_start: match.timestamp_start,
          timestamp_end: match.timestamp_end,
          badgeLabel: match.label,
          primaryText: match.matched_term,
          secondaryText: undefined,
          title: `${match.label} - "${match.matched_term}" (${match.timestamp_start})`,
          toneClassName: SEVERITY_BG[match.severity] || "bg-gray-50 border-gray-200 text-gray-800",
          color: SEVERITY_COLORS[match.severity] || "#64748b",
        })),
        ...reviewCandidates.map((candidate, index) => ({
          key: `review-${index}-${candidate.timestamp_start}-${candidate.detected_word}`,
          kind: "review" as const,
          startSec: parseTimestamp(candidate.timestamp_start),
          endSec: parseTimestamp(candidate.timestamp_end),
          timestamp_start: candidate.timestamp_start,
          timestamp_end: candidate.timestamp_end,
          badgeLabel: candidate.label,
          primaryText: candidate.detected_word,
          secondaryText: `Sugerido: ${candidate.suggested_term} (${Math.round(candidate.similarity * 100)}%)`,
          title: `${candidate.label} - "${candidate.detected_word}" -> "${candidate.suggested_term}" (${Math.round(candidate.similarity * 100)}%)`,
          toneClassName: "bg-sky-50 border-sky-200 text-sky-800",
          color: "#0ea5e9",
        })),
      ].sort((a, b) => a.startSec - b.startSec || a.endSec - b.endSec),
    [matches, reviewCandidates]
  );

  const maxMatchTime = useMemo(
    () => timelineItems.reduce((max, item) => Math.max(max, item.startSec, item.endSec), 0),
    [timelineItems]
  );

  const fallbackDuration = Math.max(duration || 0, maxMatchTime, 1);
  const totalDuration =
    mediaDuration && Number.isFinite(mediaDuration) && mediaDuration > 0 ? mediaDuration : fallbackDuration;

  const syncMediaDuration = useCallback(() => {
    const nextDuration = mediaRef.current?.duration;
    if (nextDuration && Number.isFinite(nextDuration) && nextDuration > 0) {
      setMediaDuration(nextDuration);
    }
  }, []);

  const handleTimeUpdate = () => {
    if (!mediaRef.current) return;
    syncMediaDuration();
    const t = mediaRef.current.currentTime;
    setCurrentTime(t);
    const active = timelineItems.find((item) => item.startSec <= t && t <= item.endSec);
    setActiveMatch(active ? (active.kind === "review" ? `Revision: ${active.primaryText}` : active.primaryText) : null);
  };

  const seekTo = useCallback(
    (secs: number) => {
      if (!mediaRef.current) return;
      mediaRef.current.currentTime = secs;
      if (!playing) mediaRef.current.play().catch(() => {});
    },
    [playing]
  );

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
      const ts = secondsToTimestamp(Math.min(start, endSec));
      const te = secondsToTimestamp(Math.max(start, endSec));
      setManualForm({ label: "", matched_term: "", timestamp_start: ts, timestamp_end: te, notes: "" });
      setShowManualModal(true);
    } else if (mediaRef.current) {
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

  const togglePlay = async () => {
    if (!mediaRef.current) return;
    if (!mediaRef.current.paused) {
      mediaRef.current.pause();
    } else {
      try {
        await mediaRef.current.play();
      } catch {
        setPlaying(false);
      }
    }
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

  const progressPct = Math.min((currentTime / totalDuration) * 100, 100);
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
      <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-950">
        {!src ? (
          <div className="flex min-h-36 items-center justify-center px-4 py-8 text-sm text-gray-400">
            Preparando archivo...
          </div>
        ) : sourceType === "video" ? (
          <video
            key={src}
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={src}
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={syncMediaDuration}
            onDurationChange={syncMediaDuration}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className="max-h-64 w-full object-contain"
          />
        ) : (
          <audio
            key={src}
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            src={src}
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={syncMediaDuration}
            onDurationChange={syncMediaDuration}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        )}

        <div className="space-y-2 px-4 pb-4 pt-3">
          {sessionId && (
            <p className="text-xs text-gray-500">
              Arrastra en la barra para marcar un rango como deteccion manual
            </p>
          )}

          <div
            ref={progressBarRef}
            className="group relative h-5 cursor-crosshair select-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div className="absolute inset-x-0 inset-y-1.5 rounded-full bg-gray-700" />
            <div
              className="pointer-events-none absolute inset-y-1.5 left-0 rounded-full bg-rose-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />

            {timelineItems.map((item) => {
              const startPct = Math.min((item.startSec / totalDuration) * 100, 100);
              const endPct = Math.min((item.endSec / totalDuration) * 100, 100);
              return (
                <div
                  key={item.key}
                  className="pointer-events-none absolute inset-y-0"
                  style={{ left: `${startPct}%`, width: `${Math.max(endPct - startPct, 0.5)}%` }}
                  title={item.title}
                >
                  <div
                    className="absolute inset-y-0 w-full rounded-sm opacity-80"
                    style={{
                      background:
                        item.kind === "review"
                          ? "repeating-linear-gradient(135deg, rgba(14,165,233,0.95) 0 4px, rgba(56,189,248,0.55) 4px 8px)"
                          : item.color,
                    }}
                  />
                </div>
              );
            })}

            {dragMinPct !== null && dragMaxPct !== null && dragMaxPct - dragMinPct > 0.1 && (
              <div
                className="pointer-events-none absolute inset-y-0 border-x border-blue-400 bg-blue-400/30"
                style={{ left: `${dragMinPct}%`, width: `${dragMaxPct - dragMinPct}%` }}
              />
            )}

            <div
              className="pointer-events-none absolute bottom-0 top-0 w-0.5 -translate-x-1/2 bg-white shadow-lg"
              style={{ left: `${progressPct}%` }}
            />
          </div>

          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="text-white transition-colors hover:text-rose-400">
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button onClick={toggleMute} className="text-gray-400 transition-colors hover:text-white">
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <span className="font-mono text-xs text-gray-400">
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </span>
            {activeMatch && (
              <span className="ml-auto max-w-[240px] truncate text-xs font-medium text-rose-400">
                * {activeMatch}
              </span>
            )}
          </div>
        </div>
      </div>

      {timelineItems.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Momentos detectados y similitudes - clic para saltar
          </p>
          <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {timelineItems.map((item) => (
              <button
                key={item.key}
                onClick={() => seekTo(item.startSec)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors hover:opacity-80 ${item.toneClassName}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-gray-500">{item.timestamp_start}</span>
                  <Badge className={`text-xs px-1.5 py-0 ${item.kind === "review" ? "bg-sky-100 text-sky-800" : ""}`}>
                    {item.badgeLabel}
                  </Badge>
                  <span className="font-medium">&ldquo;{item.primaryText}&rdquo;</span>
                  {item.secondaryText && <span className="text-[11px] text-sky-700">{item.secondaryText}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {timelineItems.length === 0 && (
        <p className="py-2 text-center text-sm text-muted-foreground">
          No se detectaron terminos. Puedes arrastrar en el timeline para marcar manualmente.
        </p>
      )}

      <Dialog open={showManualModal} onOpenChange={setShowManualModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar deteccion manual</DialogTitle>
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
              <Label>Termino detectado *</Label>
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
