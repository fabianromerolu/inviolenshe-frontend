"use client";

import { Loader2 } from "lucide-react";

interface BlockingLoaderProps {
  open: boolean;
  title: string;
  description: string;
}

export function BlockingLoader({ open, title, description }: BlockingLoaderProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/28 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[1.4rem] border border-white/40 bg-white/92 p-6 text-center shadow-[0_30px_70px_-36px_rgba(15,23,42,0.45)] ring-1 ring-black/5 dark:border-white/10 dark:bg-slate-950/88 dark:ring-white/10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </div>
  );
}
