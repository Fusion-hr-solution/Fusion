"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { createPlatformApiClient } from "../platform";
import { corePeopleQueryKeys, createCorePeopleApi } from "../core-people";

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
