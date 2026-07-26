"use client";

import { useCallback, useMemo } from "react";
import {
  createPlatformApiClient,
  performancePaths,
  type ObjectiveProgressAttachmentDto,
} from "@repo/api";

const PROGRESS_OWNER_TYPE = "ObjectiveProgressUpdate";

/**
 * Evidence upload/download against the shared attachment spine. Uploads are made without an owner
 * (pending) and claimed by the record-progress command; downloads stream the committed file as a
 * blob and are saved with the original file name. Unclaimed pendings are reaped by the server sweep.
 */
export function useEvidence() {
  const apiClient = useMemo(() => createPlatformApiClient(), []);

  const upload = useCallback(
    async (file: File): Promise<ObjectiveProgressAttachmentDto> => {
      const form = new FormData();
      form.append("ownerType", PROGRESS_OWNER_TYPE);
      form.append("file", file);
      const result = await apiClient.post<ObjectiveProgressAttachmentDto>(
        performancePaths.attachments(),
        form,
      );
      return result;
    },
    [apiClient],
  );

  const download = useCallback(
    async (attachmentId: string, fileName: string): Promise<void> => {
      const blob = await apiClient.get<Blob>(performancePaths.attachment(attachmentId), {
        responseType: "blob",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
    [apiClient],
  );

  return { upload, download };
}
