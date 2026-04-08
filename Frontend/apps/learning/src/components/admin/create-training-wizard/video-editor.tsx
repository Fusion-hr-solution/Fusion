"use client";

import { useState } from "react";
import { Input, Label } from "@repo/ui";
import { FileUploadZone } from "../file-upload-zone";

interface VideoEditorProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  videoUrl: string;
  onVideoUrlChange: (url: string) => void;
}

export function VideoEditor({ file, onFileChange, videoUrl, onVideoUrlChange }: VideoEditorProps) {
  const [mode, setMode] = useState<"upload" | "url">(videoUrl ? "url" : "upload");

  return (
    <div className="space-y-4">
      <Label className="text-[13px] font-semibold">Video Source</Label>

      {/* Mode toggle */}
      <div className="flex gap-2">
        {(["upload", "url"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg px-4 py-2 text-[13px] font-medium transition-colors ${
              mode === m
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {m === "upload" ? "Upload File" : "External URL"}
          </button>
        ))}
      </div>

      {mode === "upload" ? (
        <FileUploadZone
          accept=".mp4,.webm,.mov"
          file={file}
          onFileChange={onFileChange}
          label="Upload a video file (MP4, WebM, MOV — max 50 MB)"
        />
      ) : (
        <div className="space-y-2">
          <Input
            value={videoUrl}
            onChange={(e) => onVideoUrlChange(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
          />
          <p className="text-[11px] text-muted-foreground">
            Paste a YouTube, Vimeo, or direct video URL
          </p>
        </div>
      )}
    </div>
  );
}
