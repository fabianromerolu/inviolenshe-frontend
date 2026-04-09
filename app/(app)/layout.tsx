import { Sidebar } from "@/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen flex-col gap-4 p-4 lg:flex-row lg:p-5">
        <Sidebar />
        <main className="flex-1">
          <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[110rem] flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
