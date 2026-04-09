import { Loader2, Shield } from "lucide-react";

interface AuthTransitionOverlayProps {
  open: boolean;
}

export function AuthTransitionOverlay({ open }: AuthTransitionOverlayProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm">
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-[1.5rem] border border-white/10 bg-slate-950/88 p-7 text-white shadow-[0_24px_60px_-34px_rgba(15,23,42,0.65)]">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/14 text-rose-200 ring-1 ring-rose-400/20">
            <Shield className="h-6 w-6" />
          </div>

          <div className="space-y-2 text-center">
            <h2 className="text-xl font-semibold tracking-tight">Ingresando al sistema</h2>
            <p className="text-sm leading-6 text-white/68">
              Estamos preparando el panel y validando la sesión.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-white/72">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando...
          </div>
        </div>
      </div>
    </div>
  );
}
