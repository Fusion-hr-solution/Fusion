import { createPlatformApiClient } from "@repo/api";
import type { CertificateStatus, CertificateVerification, MyCertificate } from "@/types";

const client = createPlatformApiClient();

interface BackendMyCertificateDto {
  id: string;
  certificateNumber: string;
  trainingTitle: string;
  trainingDescription?: string | null;
  credits: number;
  duration?: string | null;
  trainerName?: string | null;
  gradeName?: string | null;
  serviceLineName?: string | null;
  completedAt: string;
  issuedAt: string;
  status: string;
  revokedAt?: string | null;
  revokedReason?: string | null;
}

interface BackendCertificateVerificationDto {
  certificateNumber: string;
  maskedEmployeeName: string;
  trainingTitle: string;
  issuedAt: string;
  status: string;
}

function mapStatus(status: string): CertificateStatus {
  return status === "Revoked" ? "Revoked" : "Valid";
}

function mapMyCertificate(dto: BackendMyCertificateDto): MyCertificate {
  return {
    id: dto.id,
    certificateNumber: dto.certificateNumber,
    trainingTitle: dto.trainingTitle,
    trainingDescription: dto.trainingDescription ?? undefined,
    credits: dto.credits,
    duration: dto.duration ?? undefined,
    trainerName: dto.trainerName ?? undefined,
    gradeName: dto.gradeName ?? undefined,
    serviceLineName: dto.serviceLineName ?? undefined,
    completedAt: dto.completedAt,
    issuedAt: dto.issuedAt,
    status: mapStatus(dto.status),
    revokedAt: dto.revokedAt ?? undefined,
    revokedReason: dto.revokedReason ?? undefined,
  };
}

export async function getMyCertificates(): Promise<MyCertificate[]> {
  const dtos = await client.get<BackendMyCertificateDto[]>("/training/certificates/mine");
  return dtos.map(mapMyCertificate);
}

/** Public — no authentication required. Throws ApiError(404) for an unknown number. */
export async function verifyCertificate(certificateNumber: string): Promise<CertificateVerification> {
  const dto = await client.get<BackendCertificateVerificationDto>(
    `/training/certificates/${encodeURIComponent(certificateNumber)}/verify`,
  );
  return {
    certificateNumber: dto.certificateNumber,
    maskedEmployeeName: dto.maskedEmployeeName,
    trainingTitle: dto.trainingTitle,
    issuedAt: dto.issuedAt,
    status: mapStatus(dto.status),
  };
}

export async function downloadCertificatePdf(certificateNumber: string): Promise<Blob> {
  return client.get<Blob>(
    `/training/certificates/${encodeURIComponent(certificateNumber)}/download`,
    { responseType: "blob" },
  );
}
