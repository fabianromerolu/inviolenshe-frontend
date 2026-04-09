"use client";
import { createContext, useContext, useReducer, useCallback, type ReactNode } from "react";
import type { DocumentProcessResponse, ProcessResponse } from "@/lib/api";

export type StoredUploadResult = ProcessResponse | DocumentProcessResponse;

export type UploadStatus = "uploading" | "done" | "error";
export type UploadMediaType = "audio" | "video" | "document";

export interface UploadEntry {
  id: string;
  filename: string;
  mediaType: UploadMediaType;
  status: UploadStatus;
  result?: StoredUploadResult;
  startedAt: Date;
  finishedAt?: Date;
}

type Action =
  | { type: "ADD"; entry: UploadEntry }
  | { type: "UPDATE"; id: string; patch: Partial<UploadEntry> }
  | { type: "DISMISS"; id: string };

function reducer(state: UploadEntry[], action: Action): UploadEntry[] {
  switch (action.type) {
    case "ADD":
      return [action.entry, ...state];
    case "UPDATE":
      return state.map((e) => (e.id === action.id ? { ...e, ...action.patch } : e));
    case "DISMISS":
      return state.filter((e) => e.id !== action.id);
    default:
      return state;
  }
}

interface UploadStore {
  uploads: UploadEntry[];
  addUpload: (entry: UploadEntry) => void;
  updateUpload: (id: string, patch: Partial<UploadEntry>) => void;
  dismissUpload: (id: string) => void;
}

const UploadContext = createContext<UploadStore | null>(null);

export function UploadProvider({ children }: { children: ReactNode }) {
  const [uploads, dispatch] = useReducer(reducer, []);

  const addUpload = useCallback((entry: UploadEntry) => {
    dispatch({ type: "ADD", entry });
  }, []);

  const updateUpload = useCallback((id: string, patch: Partial<UploadEntry>) => {
    dispatch({ type: "UPDATE", id, patch });
  }, []);

  const dismissUpload = useCallback((id: string) => {
    dispatch({ type: "DISMISS", id });
  }, []);

  return (
    <UploadContext.Provider value={{ uploads, addUpload, updateUpload, dismissUpload }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUploadStore(): UploadStore {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUploadStore must be used inside UploadProvider");
  return ctx;
}
