"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { createPlatformApiClient } from "../platform";
import { corePeoplePaths, corePeopleQueryKeys, createCorePeopleApi } from "../core-people";

/**
 * A person's photo, ready for `<img src>`: the API needs the bearer token, so the photo loads as a blob through
 * the client. Cached per versioned `photoUrl` for the session (a new upload is a new address); null while it
 * loads, without a photo, or when it fails, so the initials stay in place.
 */
export function usePhoto(photoUrl: string | null | undefined): string | null {
  const api = useMemo(() => createCorePeopleApi(createPlatformApiClient()), []);
  const { data } = useQuery({
    queryKey: corePeopleQueryKeys.photo(photoUrl ?? ""),
    queryFn: ({ signal }) => api.photo(photoUrl!, signal),
    enabled: Boolean(photoUrl),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
  });
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!photoUrl || !(data instanceof Blob)) {
      setSrc(null);
      return;
    }
    const url = URL.createObjectURL(data);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [data, photoUrl]);
  return src;
}

/**
 * Photos of several people by employee id, for faces in a list (the notification bell): id → displayable address,
 * absent while loading, without a photo, or when the viewer may not see it. Each id is fetched once per session.
 */
export function usePeoplePhotos(employeeIds: readonly string[]): ReadonlyMap<string, string> {
  const api = useMemo(() => createCorePeopleApi(createPlatformApiClient()), []);
  const ids = [...new Set(employeeIds)].sort();
  const results = useQueries({
    queries: ids.map((id) => {
      const url = corePeoplePaths.photo(id);
      return {
        queryKey: corePeopleQueryKeys.photo(url),
        queryFn: ({ signal }: { signal: AbortSignal }) => api.photo(url, signal),
        staleTime: Infinity,
        gcTime: 30 * 60_000,
        retry: false,
        // Most people have no photo: one 404 per session is enough.
        retryOnMount: false,
      };
    }),
  });
  const blobs = results.map((result) => (result.data instanceof Blob ? result.data : null));
  const [photos, setPhotos] = useState<ReadonlyMap<string, string>>(new Map());
  const signature = ids.map((id, index) => `${id}:${blobs[index] ? results[index]!.dataUpdatedAt : 0}`).join(",");
  useEffect(() => {
    const next = new Map<string, string>();
    ids.forEach((id, index) => {
      const blob = blobs[index];
      if (blob) next.set(id, URL.createObjectURL(blob));
    });
    setPhotos(next);
    return () => next.forEach((url) => URL.revokeObjectURL(url));
    // The signature names every id and the version of its photo.
  }, [signature]);
  return photos;
}
