"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Activity, Upload, FileText, Brain, Sun, Moon, Home, LogOut, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { removeToken } from "@/lib/auth";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/process", label: "Audio / Video", icon: Upload },
  { href: "/documents", label: "Documentos", icon: FileText },
  { href: "/ml", label: "ML & Analytics", icon: Brain },
];

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
    <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-rose-600" />
          <div>
            <p className="font-bold text-sm text-gray-900 dark:text-white">In-Violenshe Lab</p>
            <p className="text-xs text-gray-500">Análisis forense</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              pathname === href
                ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
        {/* Usuario */}
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Shield className="h-4 w-4 text-rose-500 shrink-0" />
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">admin</span>
        </div>

        {/* Tema */}
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {isDark ? "Modo claro" : "Modo oscuro"}
        </button>

        {/* Cerrar sesión */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
