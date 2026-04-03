"use client";

import { useRef, useCallback } from "react";
import { Upload, X, FileText, Film } from "lucide-react";
import { Button } from "@repo/ui";

interface FileUploadZoneProps {
  accept: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  existingUrl?: string;
  label: string;
  disabled?: boolean;
  error?: string;
}

export function FileUploadZone({
  accept,
  file,
  onFileChange,
  existingUrl,
  label,
  disabled,
  error,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const dropped = e.dataTransfer.files[0];
      if (dropped) onFileChange(dropped);
    },
    [onFileChange],
  );

  const isPdf = accept.includes("pdf");
  const Icon = isPdf ? FileText : Film;

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
        <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onFileChange(null)} disabled={disabled}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (existingUrl && !file) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
          <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1 truncate text-sm">{existingUrl.split("/").pop()}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled}>
          <Upload className="mr-1 h-4 w-4" /> Replace file
        </Button>
        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/30 ${error ? "border-destructive" : "border-border"}`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">Drag & drop or click to browse</p>
        </div>
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
