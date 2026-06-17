"use client";

import { useApiQuery } from "@repo/api/react";
import { getMyCertificates } from "@/services";
import type { MyCertificate } from "@/types";

export function useMyCertificates() {
  return useApiQuery<MyCertificate[]>(getMyCertificates);
}
