"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiCreateFolder,
  apiDeleteFile,
  apiDeleteFolder,
  apiListFiles,
  apiListFolders,
  apiMoveFile,
  apiMoveFolder,
  apiUpload,
  type FolderRecord,
  type StoredFileRecord,
} from "@/lib/api";
import { BlockingLoader } from "@/components/blocking-loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  FileIcon,
  FileMusicIcon,
  FileTextIcon,
  FileUp,
  FileVideoIcon,
  Folder,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Loader2,
  MoveRight,
  PlayCircle,
  Plus,
  Trash2,
} from "lucide-react";

const DRAG_KEY = "file_id";

interface TreeNode extends FolderRecord {
  children: TreeNode[];
}

type BannerState = {
  tone: "success" | "error";
  message: string;
} | null;

const TYPE_FILTERS = [
  { label: "Todo", value: null },
  { label: "Audio", value: "audio" },
  { label: "Video", value: "video" },
  { label: "Documentos", value: "doc" },
] as const;

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

function sourceTypeLabel(type: string): string {
  if (type === "audio") return "Audio";
  if (type === "video") return "Video";
  if (type === "pdf") return "PDF";
  if (type === "txt") return "Texto";
  if (type === "docx") return "Word";
  return type.toUpperCase();
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

function buildTree(folders: FolderRecord[]): TreeNode[] {
  const map: Record<string, TreeNode> = {};
  for (const folder of folders) {
    map[folder.id] = { ...folder, children: [] };
  }

  const roots: TreeNode[] = [];
  for (const folder of folders) {
    if (folder.parent_id && map[folder.parent_id]) {
      map[folder.parent_id].children.push(map[folder.id]);
    } else {
      roots.push(map[folder.id]);
    }
  }

  return roots;
}

function collectDescendantIds(folders: FolderRecord[], folderId: string): Set<string> {
  const childrenByParent = new Map<string | null, FolderRecord[]>();
  for (const folder of folders) {
    const bucket = childrenByParent.get(folder.parent_id) ?? [];
    bucket.push(folder);
    childrenByParent.set(folder.parent_id, bucket);
  }

  const descendants = new Set<string>();
  const stack = [folderId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const children = childrenByParent.get(current) ?? [];
    for (const child of children) {
      if (!descendants.has(child.id)) {
        descendants.add(child.id);
        stack.push(child.id);
      }
    }
  }

  return descendants;
}

function buildFolderLabel(folder: FolderRecord, folderMap: Map<string, FolderRecord>): string {
  const parts = [folder.name];
  let currentParent = folder.parent_id;

  while (currentParent) {
    const parent = folderMap.get(currentParent);
    if (!parent) break;
    parts.unshift(parent.name);
    currentParent = parent.parent_id;
  }

  return parts.join(" / ");
}

function Banner({ state }: { state: BannerState }) {
  if (!state) return null;

  return (
    <div
      className={`fixed right-5 top-5 z-50 max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${
        state.tone === "success"
          ? "border-green-200 bg-green-50/95 text-green-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
      role="status"
      aria-live="polite"
    >
      {state.message}
    </div>
  );
}

function FolderNode({
  node,
  selected,
  onSelect,
  onDropFile,
  depth = 0,
}: {
  node: TreeNode;
  selected: string | null;
  onSelect: (id: string) => void;
  onDropFile: (fileId: string, folderId: string | null) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const hasChildren = node.children.length > 0;
  const isSelected = selected === node.id;

  return (
    <div>
      <div
        className={[
          "group flex cursor-pointer select-none items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-all",
          dragOver
            ? "bg-blue-100 text-blue-800 ring-1 ring-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:ring-blue-500/30"
            : isSelected
              ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5",
        ].join(" ")}
        style={{ paddingLeft: `${12 + depth * 18}px` }}
        onClick={() => onSelect(node.id)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          const fileId = event.dataTransfer.getData(DRAG_KEY);
          if (fileId) onDropFile(fileId, node.id);
        }}
      >
        <button
          type="button"
          className="shrink-0 text-slate-400"
          onClick={(event) => {
            event.stopPropagation();
            if (hasChildren) setExpanded((value) => !value);
          }}
        >
          {hasChildren ? (
            expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <span className="inline-block w-3.5" />
          )}
        </button>
        {isSelected || dragOver ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-rose-500" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-slate-400" />
        )}
        <span className="truncate font-medium">{node.name}</span>
      </div>

      {expanded &&
        hasChildren &&
        node.children.map((child) => (
          <FolderNode key={child.id} node={child} selected={selected} onSelect={onSelect} onDropFile={onDropFile} depth={depth + 1} />
        ))}
    </div>
  );
}

function RootDropZone({
  selected,
  onClick,
  onDropFile,
}: {
  selected: boolean;
  onClick: () => void;
  onDropFile: (fileId: string, folderId: string | null) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={[
        "mb-2 flex cursor-pointer select-none items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-all",
        dragOver
          ? "bg-blue-100 text-blue-800 ring-1 ring-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:ring-blue-500/30"
          : selected
            ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5",
      ].join(" ")}
      onClick={onClick}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const fileId = event.dataTransfer.getData(DRAG_KEY);
        if (fileId) onDropFile(fileId, null);
      }}
    >
      <FolderOpen className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="font-medium">Todos los archivos</span>
    </div>
  );
}

function FileCard({
  file,
  onOpenAnalysis,
  onMove,
  onDelete,
  isMoving,
  isDeleting,
}: {
  file: StoredFileRecord;
  onOpenAnalysis: (file: StoredFileRecord) => void;
  onMove: (file: StoredFileRecord) => void;
  onDelete: (fileId: string) => void;
  isMoving: boolean;
  isDeleting: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const analyzed = !!file.session_id;

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_KEY, file.id);
        event.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={[
        "flex flex-col gap-3 rounded-[1.25rem] border bg-white/88 p-4 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.16)] transition-all dark:border-white/10 dark:bg-white/5 dark:shadow-[0_18px_30px_-24px_rgba(0,0,0,0.34)]",
        dragging
          ? "scale-[0.98] border-blue-300 opacity-60 shadow-lg"
          : "border-black/[0.07] hover:-translate-y-px hover:shadow-[0_22px_38px_-26px_rgba(15,23,42,0.22)]",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="flex cursor-grab items-center self-stretch pr-1 text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400">
          <GripVertical className="h-4 w-4" />
        </div>
        <button
          type="button"
          onClick={() => onOpenAnalysis(file)}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-2xl p-1 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 ring-1 ring-black/[0.05] dark:bg-white/8 dark:text-slate-300 dark:ring-white/10">
            <FileTypeIcon type={file.source_type} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800 dark:text-white" title={file.original_filename}>
              {file.original_filename}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {sourceTypeLabel(file.source_type)} - {formatBytes(file.size_bytes)} - {formatDate(file.created_at)}
            </p>
          </div>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {analyzed ? (
          <Badge className="border-green-200 bg-green-100 text-xs text-green-800">
            <CheckCircle className="mr-1 h-3 w-3" />
            Analizado
          </Badge>
        ) : (
          <Badge className="border-amber-200 bg-amber-100 text-xs text-amber-800">
            Sin analizar
          </Badge>
        )}
        <Badge variant="outline" className="text-xs">
          {sourceTypeLabel(file.source_type)}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-black/[0.05] pt-2 dark:border-white/5">
        <Button type="button" size="sm" className="min-w-[8.25rem] flex-1" onClick={() => onOpenAnalysis(file)}>
          <PlayCircle className="mr-1 h-3.5 w-3.5" />
          {analyzed ? "Ver analisis" : "Analizar"}
        </Button>
        <Button type="button" size="sm" variant="outline" className="min-w-[7.5rem] flex-1" onClick={() => onMove(file)} disabled={isMoving}>
          {isMoving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <MoveRight className="mr-1 h-3.5 w-3.5" />}
          Mover a
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
          onClick={() => onDelete(file.id)}
          disabled={isDeleting}
        >
          {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

export default function FilesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>(null);
  const [folderName, setFolderName] = useState("");
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [moveFolderOpen, setMoveFolderOpen] = useState(false);
  const [moveFolderTarget, setMoveFolderTarget] = useState<FolderRecord | null>(null);
  const [moveFolderParentId, setMoveFolderParentId] = useState<string | null>(null);
  const [moveFileTarget, setMoveFileTarget] = useState<StoredFileRecord | null>(null);
  const [moveFileOpen, setMoveFileOpen] = useState(false);
  const [moveFileDestination, setMoveFileDestination] = useState<string | null>(null);
  const [uploadTargetFolderId, setUploadTargetFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (!banner) return undefined;

    const timeoutId = window.setTimeout(() => {
      setBanner(null);
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [banner]);

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
        limit: 100,
      }),
  });

  const folderMap = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const selectedFolderRecord = selectedFolder ? folderMap.get(selectedFolder) ?? null : null;
  const tree = useMemo(() => buildTree(folders), [folders]);
  const availableFolderOptions = useMemo(
    () =>
      folders.map((folder) => ({
        ...folder,
        label: buildFolderLabel(folder, folderMap),
      })),
    [folderMap, folders]
  );
  const moveFolderCandidates = useMemo(() => {
    if (!moveFolderTarget) return availableFolderOptions;
    const descendants = collectDescendantIds(folders, moveFolderTarget.id);
    return availableFolderOptions.filter((folder) => folder.id !== moveFolderTarget.id && !descendants.has(folder.id));
  }, [availableFolderOptions, folders, moveFolderTarget]);

  const invalidateFiles = () => queryClient.invalidateQueries({ queryKey: ["files"] });
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["files"] });
    queryClient.invalidateQueries({ queryKey: ["folders"] });
  };

  const uploadFileMutation = useMutation({
    mutationFn: ({ file, folderId }: { file: File; folderId: string | null }) => apiUpload(file, folderId),
    onMutate: () => setBanner(null),
    onSuccess: () => {
      invalidateFiles();
      setBanner({ tone: "success", message: "Archivo subido correctamente." });
    },
    onError: (error) => {
      setBanner({ tone: "error", message: (error as Error)?.message || "No se pudo subir el archivo." });
    },
  });

  const moveFileMutation = useMutation({
    mutationFn: ({ fileId, folderId }: { fileId: string; folderId: string | null }) => apiMoveFile(fileId, folderId),
    onMutate: () => setBanner(null),
    onSuccess: () => {
      setMoveFileOpen(false);
      setMoveFileTarget(null);
      setBanner({ tone: "success", message: "Archivo movido correctamente." });
      invalidateFiles();
    },
    onError: (error) => {
      setBanner({ tone: "error", message: (error as Error)?.message || "No se pudo mover el archivo." });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: apiDeleteFile,
    onMutate: () => setBanner(null),
    onSuccess: () => {
      setBanner({ tone: "success", message: "Archivo eliminado correctamente." });
      invalidateFiles();
    },
    onError: (error) => {
      setBanner({ tone: "error", message: (error as Error)?.message || "No se pudo eliminar el archivo." });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: string | null }) => apiCreateFolder(name, parentId),
    onMutate: () => setBanner(null),
    onSuccess: () => {
      setFolderName("");
      setCreateFolderOpen(false);
      setBanner({ tone: "success", message: "Carpeta creada correctamente." });
      invalidateAll();
    },
    onError: (error) => {
      setBanner({ tone: "error", message: (error as Error)?.message || "No se pudo crear la carpeta." });
    },
  });

  const moveFolderMutation = useMutation({
    mutationFn: ({ folderId, parentId }: { folderId: string; parentId: string | null }) => apiMoveFolder(folderId, parentId),
    onMutate: () => setBanner(null),
    onSuccess: () => {
      setMoveFolderOpen(false);
      setMoveFolderTarget(null);
      setBanner({ tone: "success", message: "Carpeta movida correctamente." });
      invalidateAll();
    },
    onError: (error) => {
      setBanner({ tone: "error", message: (error as Error)?.message || "No se pudo mover la carpeta." });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: apiDeleteFolder,
    onMutate: () => setBanner(null),
    onSuccess: () => {
      if (selectedFolder) setSelectedFolder(null);
      setBanner({ tone: "success", message: "Carpeta eliminada correctamente." });
      invalidateAll();
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setBanner({
        tone: "error",
        message: detail?.includes("not empty")
          ? "La carpeta no esta vacia. Mueve o elimina primero sus archivos y subcarpetas."
          : (error as Error)?.message || "No se pudo eliminar la carpeta.",
      });
    },
  });

  function handleMoveFile(fileId: string, folderId: string | null) {
    moveFileMutation.mutate({ fileId, folderId });
  }

  function handleOpenAnalysis(file: StoredFileRecord) {
    const targetRoute = analyzeRoute(file.source_type);
    const query = file.session_id ? `session_id=${file.session_id}` : `file_id=${file.id}`;
    router.push(`${targetRoute}?${query}`);
  }

  function handleUploadTrigger(folderId: string | null) {
    setUploadTargetFolderId(folderId);
    fileInputRef.current?.click();
  }

  function handleUploadSelection(fileList: FileList | null) {
    const nextFile = fileList?.[0];
    if (!nextFile) return;
    uploadFileMutation.mutate({ file: nextFile, folderId: uploadTargetFolderId });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function openCreateFolder(parentId: string | null) {
    setCreateParentId(parentId);
    setFolderName("");
    setCreateFolderOpen(true);
  }

  function openMoveFolder(folder: FolderRecord) {
    setMoveFolderTarget(folder);
    setMoveFolderParentId(folder.parent_id);
    setMoveFolderOpen(true);
  }

  function openMoveFile(file: StoredFileRecord) {
    setMoveFileTarget(file);
    setMoveFileDestination(file.folder_id);
    setMoveFileOpen(true);
  }

  const movingFileId = moveFileMutation.isPending ? moveFileMutation.variables?.fileId : null;
  const deletingFileId = deleteFileMutation.isPending ? deleteFileMutation.variables : null;
  const deletingFolderId = deleteFolderMutation.isPending ? deleteFolderMutation.variables : null;

  return (
    <>
      <BlockingLoader
        open={uploadFileMutation.isPending}
        title="Subiendo archivo..."
        description="Estamos guardando el archivo y organizandolo en la carpeta seleccionada."
      />

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.txt,.docx,audio/*,video/*"
        onChange={(event) => handleUploadSelection(event.target.files)}
      />

      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{createParentId ? "Nueva subcarpeta" : "Nueva carpeta"}</DialogTitle>
            <DialogDescription>
              {createParentId
                ? "La nueva carpeta quedara dentro de la carpeta seleccionada."
                : "Crea una carpeta raiz para organizar tus evidencias."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="Nombre de la carpeta"
              className="h-11"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => createFolderMutation.mutate({ name: folderName.trim(), parentId: createParentId })}
                disabled={!folderName.trim() || createFolderMutation.isPending}
              >
                {createFolderMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderPlus className="mr-2 h-4 w-4" />}
                Crear
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={moveFolderOpen} onOpenChange={setMoveFolderOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Mover carpeta</DialogTitle>
            <DialogDescription>
              Elige la carpeta padre donde quieres ubicar <strong>{moveFolderTarget?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <button
              type="button"
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                moveFolderParentId === null ? "border-rose-200 bg-rose-50 text-rose-700" : "border-black/10 hover:bg-slate-50"
              }`}
              onClick={() => setMoveFolderParentId(null)}
            >
              Raiz
            </button>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {moveFolderCandidates.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                    moveFolderParentId === folder.id
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-black/10 hover:bg-slate-50"
                  }`}
                  onClick={() => setMoveFolderParentId(folder.id)}
                >
                  {folder.label}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setMoveFolderOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!moveFolderTarget || moveFolderMutation.isPending}
                onClick={() =>
                  moveFolderTarget &&
                  moveFolderMutation.mutate({
                    folderId: moveFolderTarget.id,
                    parentId: moveFolderParentId,
                  })
                }
              >
                {moveFolderMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MoveRight className="mr-2 h-4 w-4" />}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={moveFileOpen} onOpenChange={setMoveFileOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Mover archivo</DialogTitle>
            <DialogDescription>
              Elige la carpeta destino para <strong>{moveFileTarget?.original_filename}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <button
              type="button"
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                moveFileDestination === null ? "border-rose-200 bg-rose-50 text-rose-700" : "border-black/10 hover:bg-slate-50"
              }`}
              onClick={() => setMoveFileDestination(null)}
            >
              Sin carpeta
            </button>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {availableFolderOptions.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                    moveFileDestination === folder.id
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-black/10 hover:bg-slate-50"
                  }`}
                  onClick={() => setMoveFileDestination(folder.id)}
                >
                  {folder.label}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setMoveFileOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!moveFileTarget || moveFileMutation.isPending}
                onClick={() =>
                  moveFileTarget &&
                  handleMoveFile(moveFileTarget.id, moveFileDestination)
                }
              >
                {moveFileMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MoveRight className="mr-2 h-4 w-4" />}
                Mover
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex min-h-0 gap-5">
        <aside className="w-64 shrink-0">
          <div className="lab-card p-3 lg:sticky lg:top-5">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Carpetas</p>
              <Button size="icon-sm" variant="outline" onClick={() => openCreateFolder(null)}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            <RootDropZone selected={selectedFolder === null} onClick={() => setSelectedFolder(null)} onDropFile={handleMoveFile} />

            {tree.map((node) => (
              <FolderNode key={node.id} node={node} selected={selectedFolder} onSelect={setSelectedFolder} onDropFile={handleMoveFile} />
            ))}

            {folders.length === 0 && <p className="px-2 py-2 text-xs text-slate-400">Sin carpetas. Crea una para empezar.</p>}

            <p className="px-1 pb-1 pt-3 text-xs leading-tight text-slate-400">Arrastra archivos sobre una carpeta para moverlos.</p>
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-4">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {selectedFolderRecord ? selectedFolderRecord.name : "Todos los archivos"}
                </h1>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {files.length} archivo{files.length !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {TYPE_FILTERS.map(({ label, value }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setTypeFilter(value)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      typeFilter === value
                        ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
                        : "border-black/[0.07] bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="lab-card-soft p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {selectedFolderRecord ? `Carpeta activa: ${selectedFolderRecord.name}` : "Vista raiz"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {selectedFolderRecord
                      ? "Sube archivos aqui, crea subcarpetas o mueve esta carpeta como en una estructura tipo Drive."
                      : "Desde aqui puedes subir archivos sueltos o crear carpetas principales."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => handleUploadTrigger(selectedFolderRecord?.id ?? null)} disabled={uploadFileMutation.isPending}>
                    {uploadFileMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                    {selectedFolderRecord ? "Subir aqui" : "Subir archivo"}
                  </Button>
                  <Button variant="outline" onClick={() => openCreateFolder(selectedFolderRecord?.id ?? null)} disabled={createFolderMutation.isPending}>
                    <FolderPlus className="mr-2 h-4 w-4" />
                    {selectedFolderRecord ? "Nueva subcarpeta" : "Nueva carpeta"}
                  </Button>
                  {selectedFolderRecord && (
                    <>
                      <Button variant="outline" onClick={() => openMoveFolder(selectedFolderRecord)} disabled={moveFolderMutation.isPending}>
                        {moveFolderMutation.isPending && moveFolderTarget?.id === selectedFolderRecord.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <MoveRight className="mr-2 h-4 w-4" />
                        )}
                        Mover carpeta
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => deleteFolderMutation.mutate(selectedFolderRecord.id)}
                        disabled={deletingFolderId === selectedFolderRecord.id}
                      >
                        {deletingFolderId === selectedFolderRecord.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        Eliminar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <Banner state={banner} />
          </div>

          {filesLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span className="text-sm">Cargando archivos...</span>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
              <FolderOpen className="h-12 w-12 opacity-30" />
              <p className="text-sm">No hay archivos en esta ubicacion.</p>
              <p className="text-xs">Usa las acciones superiores para subir archivos o crear carpetas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {files.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  onOpenAnalysis={handleOpenAnalysis}
                  onMove={openMoveFile}
                  onDelete={(fileId) => deleteFileMutation.mutate(fileId)}
                  isMoving={movingFileId === file.id}
                  isDeleting={deletingFileId === file.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
