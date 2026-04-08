"use client";
import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import type { KeywordMatch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

interface MediaPlayerProps {
  file: File;
  duration: number;
  matches: KeywordMatch[];
  sourceType: "audio" | "video";
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(":");
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  const s = Number(parts[2]) || 0;
  return h * 3600 + m * 60 + s;
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

export function MediaPlayer({ file, duration, matches, sourceType }: MediaPlayerProps) {
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [activeMatch, setActiveMatch] = useState<string | null>(null);

  const src = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => URL.revokeObjectURL(src);
  }, [src]);

  const totalDuration = duration > 0 ? duration : 1;

  const handleTimeUpdate = () => {
    if (!mediaRef.current) return;
    const t = mediaRef.current.currentTime;
    setCurrentTime(t);
    // Detectar match activo
    const active = matches.find(
      (m) => parseTimestamp(m.timestamp_start) <= t && t <= parseTimestamp(m.timestamp_end)
    );
    setActiveMatch(active ? active.matched_term : null);
  };

  const seekTo = useCallback((secs: number) => {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = secs;
    if (!playing) mediaRef.current.play().catch(() => {});
  }, [playing]);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    if (!bar || !mediaRef.current) return;
    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    mediaRef.current.currentTime = ratio * totalDuration;
  };

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
          {/* Barra de progreso con marcadores */}
          <div
            ref={progressBarRef}
            className="relative h-5 cursor-pointer group"
            onClick={handleProgressClick}
          >
            {/* Track fondo */}
            <div className="absolute inset-y-1.5 inset-x-0 bg-gray-700 rounded-full" />
            {/* Progreso */}
            <div
              className="absolute inset-y-1.5 left-0 bg-rose-500 rounded-full transition-all"
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
                  className="absolute inset-y-0 cursor-pointer"
                  style={{ left: `${startPct}%`, width: `${Math.max(endPct - startPct, 0.5)}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    seekTo(parseTimestamp(m.timestamp_start));
                  }}
                  title={`${m.label} — "${m.matched_term}" (${m.timestamp_start})`}
                >
                  <div
                    className="absolute inset-y-0 w-full rounded-sm opacity-70 hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: color }}
                  />
                </div>
              );
            })}
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
    </div>
  );
}
