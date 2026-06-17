"use client";

import { useCallback } from "react";
import { useApiQuery } from "@repo/api/react";
import { verifyCertificate } from "@/services";
import type { CertificateVerification } from "@/types";

export function useVerifyCertificate(certificateNumber: string) {
  // Memoize so useApiQuery's effect doesn't abort/refetch on every render
  // (its dependency array includes the query function's identity).
  const queryFn = useCallback(
    () => verifyCertificate(certificateNumber),
    [certificateNumber],
  );

  return useApiQuery<CertificateVerification>(queryFn, {
    enabled: Boolean(certificateNumber),
  });
}
