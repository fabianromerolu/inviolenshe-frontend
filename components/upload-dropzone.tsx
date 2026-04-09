"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

type UploadDropzoneVariant = "audio" | "docs";

interface UploadDropzoneProps {
  id: string;
  accept: string;
  file: File | null;
  onFileSelect: (file: File | null) => void;
  icon: LucideIcon;
  title: string;
  description: string;
  helper: string;
  chips: string[];
  variant: UploadDropzoneVariant;
}

const variantClasses: Record<
  UploadDropzoneVariant,
  {
    container: string;
    icon: string;
    chip: string;
    ring: string;
  }
> = {
  audio: {
    container:
      "border-rose-200/90 bg-[linear-gradient(180deg,_rgba(255,241,242,0.92)_0%,_rgba(255,255,255,0.98)_100%)] hover:border-rose-300 hover:shadow-[0_22px_42px_-26px_rgba(244,63,94,0.2)] dark:border-rose-500/20 dark:bg-[linear-gradient(180deg,_rgba(136,19,55,0.18)_0%,_rgba(15,23,42,0.4)_100%)] dark:hover:border-rose-500/30 dark:hover:shadow-[0_24px_40px_-24px_rgba(0,0,0,0.4)]",
    icon: "lab-icon-audio",
    chip: "lab-tone-audio",
    ring: "ring-rose-200 dark:ring-rose-500/30",
  },
  docs: {
    container:
      "border-sky-200/90 bg-[linear-gradient(180deg,_rgba(240,249,255,0.94)_0%,_rgba(255,255,255,0.98)_100%)] hover:border-sky-300 hover:shadow-[0_22px_42px_-26px_rgba(14,165,233,0.2)] dark:border-sky-500/20 dark:bg-[linear-gradient(180deg,_rgba(3,105,161,0.16)_0%,_rgba(15,23,42,0.4)_100%)] dark:hover:border-sky-500/30 dark:hover:shadow-[0_24px_40px_-24px_rgba(0,0,0,0.4)]",
    icon: "lab-icon-docs",
    chip: "lab-tone-docs",
    ring: "ring-sky-200 dark:ring-sky-500/30",
  },
};

export function UploadDropzone({
  id,
  accept,
  file,
  onFileSelect,
  icon: Icon,
  title,
  description,
  helper,
  chips,
  variant,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragCounterRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const styles = variantClasses[variant];

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    onFileSelect(files[0]);
  };

  const openPicker = () => {
    inputRef.current?.click();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={title}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDragEnter={(event) => {
          event.preventDefault();
          dragCounterRef.current += 1;
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!isDragging) setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragCounterRef.current -= 1;
          if (dragCounterRef.current <= 0) {
            dragCounterRef.current = 0;
            setIsDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragCounterRef.current = 0;
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "group relative w-full rounded-[1.3rem] border border-dashed p-5 text-left transition-all duration-200 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          styles.container,
          isDragging && `-translate-y-0.5 scale-[1.01] shadow-[0_26px_44px_-24px_rgba(15,23,42,0.24)] ring-2 ${styles.ring}`
        )}
      >
        <div className="absolute inset-0 rounded-[1.3rem] bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.45),_transparent_36%)] opacity-70" />

        <div className="relative">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-[1.04]",
                styles.icon
              )}
            >
              <Icon className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
                <Upload
                  className={cn(
                    "h-4 w-4 text-slate-400 transition-all duration-200 group-hover:translate-y-0.5",
                    isDragging && "translate-y-0.5 text-slate-600 dark:text-slate-200"
                  )}
                />
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {isDragging ? "Suelta el archivo aqui para cargarlo." : description}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <span key={chip} className={cn("lab-chip", styles.chip)}>
                {chip}
              </span>
            ))}
          </div>

          <div
            className={cn(
              "mt-4 rounded-xl border border-black/5 bg-white/78 px-4 py-3 transition-all duration-200 dark:border-white/10 dark:bg-white/5",
              file && "shadow-[0_12px_20px_-18px_rgba(15,23,42,0.22)]"
            )}
          >
            {file ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                    {file.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <span className={cn("lab-chip shrink-0", styles.chip)}>Listo</span>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">{helper}</p>
            )}
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        id={id}
        type="file"
        className="hidden"
        title={title}
        accept={accept}
        onChange={(event) => handleFiles(event.target.files)}
      />
    </>
  );
}
