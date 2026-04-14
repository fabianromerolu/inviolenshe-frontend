"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  apiListFiles,
  apiDeleteFile,
  apiMoveFile,
  apiListFolders,
  apiCreateFolder,
  apiDeleteFolder,
  type StoredFileRecord,
  type FolderRecord,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FolderOpen,
  Folder,
  FileMusicIcon,
  FileVideoIcon,
  FileTextIcon,
  FileIcon,
  Trash2,
  Plus,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  Clock,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function sourceTypeLabel(t: string): string {
  if (t === "audio") return "Audio";
  if (t === "video") return "Video";
  if (t === "pdf") return "PDF";
  if (t === "txt") return "Texto";
  if (t === "docx") return "Word";
  return t.toUpperCase();
}

function FileTypeIcon({ type, className = "h-5 w-5" }: { type: string; className?: string }) {
  if (type === "audio") return <FileMusicIcon className={className} />;
  if (type === "video") return <FileVideoIcon className={className} />;
  if (["pdf", "txt", "docx"].includes(type)) return <FileTextIcon className={className} />;
  return <FileIcon className={className} />;
}

function analyzeRoute(sourceType: string): "/process" | "/documents" {
  return sourceType === "audio" || sourceType === "video" ? "/process" : "/documents";
}

// ── Folder tree ────────────────────────────────────────────────────────────────

interface TreeNode extends FolderRecord {
  children: TreeNode[];
}

function buildTree(folders: FolderRecord[]): TreeNode[] {
  const map: Record<string, TreeNode> = {};
  for (const f of folders) map[f.id] = { ...f, children: [] };
  const roots: TreeNode[] = [];
  for (const f of folders) {
    if (f.parent_id && map[f.parent_id]) {
      map[f.parent_id].children.push(map[f.id]);
    } else {
      roots.push(map[f.id]);
    }
  }
  return roots;
}

interface FolderNodeProps {
  node: TreeNode;
  selected: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  depth?: number;
}

function FolderNode({ node, selected, onSelect, onDelete, depth = 0 }: FolderNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = selected === node.id;

  return (
    <div>
      <div
        className={[
          "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm cursor-pointer select-none transition-colors group",
          depth === 0 ? "pl-2" : depth === 1 ? "pl-6" : depth === 2 ? "pl-10" : "pl-14",
          isSelected
            ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5",
        ].join(" ")}
        onClick={() => onSelect(node.id)}
      >
        <button
          type="button"
          className="shrink-0 text-slate-400"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        >
          {hasChildren
            ? expanded
              ? <ChevronDown className="h-3.5 w-3.5" />
              : <ChevronRight className="h-3.5 w-3.5" />
            : <span className="w-3.5" />}
        </button>
        {isSelected ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-rose-500" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-slate-400" />
        )}
        <span className="flex-1 truncate font-medium">{node.name}</span>
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 ml-1"
          onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
          title="Eliminar carpeta"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <FolderNode
              key={child.id}
              node={child}
              selected={selected}
              onSelect={onSelect}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── File card ──────────────────────────────────────────────────────────────────

interface FileCardProps {
  file: StoredFileRecord;
  folders: FolderRecord[];
  onDelete: (id: string) => void;
  onMove: (fileId: string, folderId: string | null) => void;
  onAnalyze: (file: StoredFileRecord) => void;
}

function FileCard({ file, folders, onDelete, onMove, onAnalyze }: FileCardProps) {
  const analyzed = !!file.session_id;

  return (
    <div className="rounded-xl border border-black/[0.07] bg-white/74 p-4 shadow-sm dark:border-white/10 dark:bg-white/5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-black/[0.05] dark:bg-white/8 dark:text-slate-300 dark:ring-white/10">
          <FileTypeIcon type={file.source_type} className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800 dark:text-white truncate" title={file.original_filename}>
            {file.original_filename}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {sourceTypeLabel(file.source_type)} · {formatBytes(file.size_bytes)} · {formatDate(file.created_at)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {analyzed ? (
          <Badge className="text-xs bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Analizado
          </Badge>
        ) : (
          <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Sin analizar
          </Badge>
        )}
        <Badge variant="outline" className="text-xs">{sourceTypeLabel(file.source_type)}</Badge>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-black/[0.05] dark:border-white/5">
        {!analyzed && (
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={() => onAnalyze(file)}
          >
            Analizar
          </Button>
        )}

        <select
          aria-label="Mover a carpeta"
          className="h-7 rounded-md border border-input bg-background px-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer"
          value=""
          onChange={(e) => {
            const val = e.target.value;
            onMove(file.id, val === "__none__" ? null : val);
          }}
        >
          <option value="" disabled>Mover a…</option>
          <option value="__none__">Sin carpeta</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
          onClick={() => onDelete(file.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const TYPE_FILTERS = [
  { label: "Todo", value: null },
  { label: "Audio", value: "audio" },
  { label: "Video", value: "video" },
  { label: "Documentos", value: "doc" },
] as const;

export default function FilesPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: folders = [] } = useQuery({
    queryKey: ["folders"],
    queryFn: apiListFolders,
  });

  const sourceTypes = useMemo(() => {
    if (typeFilter === "audio") return ["audio"];
    if (typeFilter === "video") return ["video"];
    if (typeFilter === "doc") return ["pdf", "txt", "docx"];
    return [];
  }, [typeFilter]);

  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ["files", selectedFolder, sourceTypes],
    queryFn: () =>
      apiListFiles({
        folder_id: selectedFolder ?? undefined,
        source_type: sourceTypes.length > 0 ? sourceTypes : undefined,
        limit: 50,
      }),
  });

  const tree = useMemo(() => buildTree(folders), [folders]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["files"] });
    qc.invalidateQueries({ queryKey: ["folders"] });
  };

  const deleteFileMut = useMutation({
    mutationFn: apiDeleteFile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files"] }),
  });

  const moveFileMut = useMutation({
    mutationFn: ({ fileId, folderId }: { fileId: string; folderId: string | null }) =>
      apiMoveFile(fileId, folderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files"] }),
  });

  const createFolderMut = useMutation({
    mutationFn: (name: string) => apiCreateFolder(name, null),
    onSuccess: () => {
      setNewFolderName("");
      setShowNewFolder(false);
      invalidate();
    },
  });

  const deleteFolderMut = useMutation({
    mutationFn: apiDeleteFolder,
    onSuccess: () => {
      if (selectedFolder) setSelectedFolder(null);
      invalidate();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if (msg?.includes("not empty")) {
        alert("La carpeta tiene archivos. Muévelos o elimínalos primero.");
      }
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleAnalyze(file: StoredFileRecord) {
    const route = analyzeRoute(file.source_type);
    router.push(`${route}?file_id=${file.id}`);
  }

  function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (newFolderName.trim()) createFolderMut.mutate(newFolderName.trim());
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-5 min-h-0">
      {/* ── Left panel: folder tree ── */}
      <aside className="w-56 shrink-0">
        <div className="lab-card p-3 lg:sticky lg:top-5">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Carpetas
            </p>
            <button
              type="button"
              className="text-slate-400 hover:text-rose-500 transition-colors"
              onClick={() => setShowNewFolder(!showNewFolder)}
              title="Nueva carpeta"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {showNewFolder && (
            <form onSubmit={handleCreateFolder} className="mb-2 flex gap-1">
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nombre..."
                className="h-7 text-xs"
                autoFocus
              />
              <Button type="submit" size="sm" className="h-7 text-xs px-2" disabled={createFolderMut.isPending}>
                OK
              </Button>
            </form>
          )}

          {/* Root: all files */}
          <div
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer select-none transition-colors mb-1 ${
              selectedFolder === null
                ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
            }`}
            onClick={() => setSelectedFolder(null)}
          >
            <FolderOpen className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="font-medium text-sm">Todos los archivos</span>
          </div>

          {tree.map((node) => (
            <FolderNode
              key={node.id}
              node={node}
              selected={selectedFolder}
              onSelect={setSelectedFolder}
              onDelete={(id) => deleteFolderMut.mutate(id)}
            />
          ))}

          {folders.length === 0 && (
            <p className="text-xs text-slate-400 px-2 py-2">
              Sin carpetas. Crea una con +
            </p>
          )}
        </div>
      </aside>

      {/* ── Right panel: file grid ── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
              {selectedFolder
                ? (folders.find((f) => f.id === selectedFolder)?.name ?? "Carpeta")
                : "Todos los archivos"}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {files.length} archivo{files.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Type filter */}
          <div className="flex gap-1.5 flex-wrap">
            {TYPE_FILTERS.map(({ label, value }) => (
              <button
                key={label}
                type="button"
                onClick={() => setTypeFilter(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border ${
                  typeFilter === value
                    ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300"
                    : "bg-white border-black/[0.07] text-slate-600 hover:bg-slate-50 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/8"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* File grid */}
        {filesLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <span className="text-sm">Cargando archivos...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <FolderOpen className="h-12 w-12 opacity-30" />
            <p className="text-sm">No hay archivos en esta ubicación.</p>
            <p className="text-xs">
              Sube archivos desde{" "}
              <button
                type="button"
                className="underline text-rose-500 hover:text-rose-600"
                onClick={() => router.push("/process")}
              >
                Audio / Video
              </button>{" "}
              o{" "}
              <button
                type="button"
                className="underline text-rose-500 hover:text-rose-600"
                onClick={() => router.push("/documents")}
              >
                Documentos
              </button>
              .
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {files.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                folders={folders}
                onDelete={(id) => deleteFileMut.mutate(id)}
                onMove={(fileId, folderId) => moveFileMut.mutate({ fileId, folderId })}
                onAnalyze={handleAnalyze}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
