"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { AlertCircle, ArrowRight, Loader2, Shield } from "lucide-react";
import { setToken } from "@/lib/auth";
import { AuthTransitionOverlay } from "@/components/auth-transition-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isEntering) return;

    setLoading(true);
    setError(null);

    try {
      const form = new URLSearchParams();
      form.append("username", username);
      form.append("password", password);

      const res = await axios.post(`${API_BASE}/auth/login`, form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      setToken(res.data.access_token);
      setIsEntering(true);
      redirectTimeoutRef.current = setTimeout(() => {
        startTransition(() => {
          router.push("/");
          router.refresh();
        });
      }, 950);
    } catch {
      setError("Credenciales incorrectas. Verifica tu usuario y contraseña.");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fdf7f2] text-slate-950 dark:bg-[#120f18] dark:text-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12%] top-[-8%] h-72 w-72 rounded-full bg-rose-300/40 blur-3xl dark:bg-rose-700/25" />
        <div className="absolute bottom-[-12%] right-[-10%] h-96 w-96 rounded-full bg-amber-200/50 blur-3xl dark:bg-amber-500/10" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/50 to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white/60 bg-white/72 shadow-[0_30px_120px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/65 xl:min-h-[640px] xl:grid-cols-[1.08fr_0.92fr]">
          <section className="relative hidden overflow-hidden xl:flex xl:items-center xl:justify-center">
            <div className="absolute inset-0 bg-[linear-gradient(145deg,_rgba(190,24,93,0.96)_0%,_rgba(136,19,55,0.96)_34%,_rgba(17,24,39,0.98)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.25),_transparent_36%),radial-gradient(circle_at_bottom_left,_rgba(251,191,36,0.18),_transparent_28%)]" />

            <div className="relative mx-auto flex max-w-lg flex-col justify-center px-8 py-12">
              <h1 className="max-w-lg text-4xl font-semibold leading-[1.04] text-white">
                Acceso seguro para analizar evidencia sin exponer el entorno.
              </h1>
              <p className="mt-5 max-w-md text-[0.95rem] leading-7 text-white/72">
                El laboratorio reúne procesamiento, revisión y métricas en una sola
                interfaz. Antes de entrar, la sesión debe validarse con credenciales
                administrativas.
              </p>
            </div>
          </section>

          <section className="flex min-h-[640px] items-center justify-center px-5 py-7 sm:px-7 lg:px-10">
            <div className="mx-auto w-full max-w-[25.5rem]">
              <div className="mb-8 text-center xl:hidden">
                <div className="mb-6 inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
                  In-Violenshe Lab
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  Inicia sesión para entrar al panel.
                </h1>
                <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Solo el formulario de acceso debe estar visible hasta validar la sesión.
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_25px_80px_-45px_rgba(15,23,42,0.45)] backdrop-blur sm:p-7 dark:border-white/10 dark:bg-slate-950/82">
                <div className="mb-7 text-center xl:text-left">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#be123c_0%,_#f43f5e_100%)] text-white shadow-lg shadow-rose-500/25 xl:mx-0">
                    <Shield className="h-7 w-7" />
                  </div>
                  <h2 className="text-[1.75rem] font-semibold tracking-tight text-slate-950 dark:text-white">
                    Bienvenido de nuevo
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Accede al laboratorio para procesar material, revisar detecciones y consultar analítica.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Usuario
                    </Label>
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoComplete="username"
                      placeholder="Ingresa tu usuario"
                      className="h-12 rounded-xl border-slate-200 bg-white/80 px-4 text-sm shadow-none focus-visible:border-rose-400 focus-visible:ring-rose-300 dark:border-white/10 dark:bg-white/5"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Contraseña
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="Ingresa tu contraseña"
                      className="h-12 rounded-xl border-slate-200 bg-white/80 px-4 text-sm shadow-none focus-visible:border-rose-400 focus-visible:ring-rose-300 dark:border-white/10 dark:bg-white/5"
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || isEntering || !username || !password}
                    className="group h-12 w-full rounded-xl bg-[linear-gradient(135deg,_#be123c_0%,_#f43f5e_100%)] text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition-transform hover:scale-[1.01] hover:shadow-rose-500/35"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verificando acceso...
                      </>
                    ) : (
                      <>
                        Entrar al laboratorio
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </section>
        </div>
      </div>

      <AuthTransitionOverlay open={isEntering} />
    </div>
  );
}
