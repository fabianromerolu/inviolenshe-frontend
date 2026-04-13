"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Brain, FileText, FolderOpen, Home, LogOut, Moon, Shield, Sun, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { removeToken } from "@/lib/auth";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/process", label: "Audio / Video", icon: Upload },
  { href: "/documents", label: "Documentos", icon: FileText },
  { href: "/ml", label: "ML & Analytics", icon: Brain },
  { href: "/files", label: "Archivos", icon: FolderOpen },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const handleLogout = () => {
    removeToken();
    router.push("/login");
  };

  return (
    <aside className="shrink-0 lg:w-[17rem]">
      <div className="lab-card p-3 lg:sticky lg:top-5 lg:min-h-[calc(100vh-2.5rem)]">
        <div className="flex h-full flex-col gap-4">
          <div className="rounded-[1.1rem] border border-black/[0.07] bg-white/74 px-4 py-4 shadow-[0_14px_26px_-20px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_16px_28px_-22px_rgba(0,0,0,0.34)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-200 shadow-[0_10px_22px_-16px_rgba(244,63,94,0.28)] dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20 dark:shadow-none">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  In-Violenshe Lab
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Panel interno
                </p>
              </div>
            </div>
          </div>

          <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;

              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-all duration-200",
                    active
                      ? "border-rose-200 bg-rose-50 text-rose-700 shadow-[0_14px_28px_-18px_rgba(244,63,94,0.22)] dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200 dark:shadow-[0_18px_30px_-22px_rgba(0,0,0,0.34)]"
                      : "border-transparent text-slate-600 hover:-translate-y-px hover:border-black/[0.07] hover:bg-white/78 hover:shadow-[0_12px_24px_-18px_rgba(15,23,42,0.14)] dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:shadow-[0_16px_28px_-22px_rgba(0,0,0,0.34)]"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl ring-1 transition-all duration-200",
                      active
                        ? "bg-white text-rose-600 ring-rose-100 shadow-[0_10px_18px_-14px_rgba(244,63,94,0.2)] dark:bg-slate-900 dark:text-rose-300 dark:ring-white/10 dark:shadow-none"
                        : "bg-slate-100 text-slate-500 ring-black/[0.05] dark:bg-white/8 dark:text-slate-300 dark:ring-white/10"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="truncate font-medium">{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-2">
            <div className="rounded-xl border border-black/[0.07] bg-white/74 px-4 py-3 text-sm shadow-[0_12px_24px_-18px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_14px_24px_-18px_rgba(0,0,0,0.3)]">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Usuario
              </p>
              <p className="mt-1 font-medium text-slate-900 dark:text-white">admin</p>
            </div>

            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-sm text-slate-600 transition-all duration-200 hover:-translate-y-px hover:border-black/[0.07] hover:bg-white/78 hover:shadow-[0_12px_24px_-18px_rgba(15,23,42,0.14)] dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:shadow-[0_16px_28px_-22px_rgba(0,0,0,0.34)]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-black/[0.05] dark:bg-white/8 dark:text-slate-300 dark:ring-white/10">
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </div>
              <span>{isDark ? "Modo claro" : "Modo oscuro"}</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-sm text-slate-600 transition-all duration-200 hover:-translate-y-px hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 hover:shadow-[0_14px_26px_-18px_rgba(244,63,94,0.18)] dark:text-slate-300 dark:hover:border-rose-500/20 dark:hover:bg-rose-500/10 dark:hover:text-rose-200 dark:hover:shadow-[0_16px_28px_-22px_rgba(0,0,0,0.34)]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-black/[0.05] dark:bg-white/8 dark:text-slate-300 dark:ring-white/10">
                <LogOut className="h-4 w-4" />
              </div>
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
