export type CertificateStatus = "Valid" | "Revoked";

/** An employee's own certificate (full detail) shown on "Mes Certificats". */
export interface MyCertificate {
  id: string;
  certificateNumber: string;
  trainingTitle: string;
  trainingDescription?: string;
  credits: number;
  duration?: string;
  trainerName?: string;
  gradeName?: string;
  serviceLineName?: string;
  completedAt: string;
  issuedAt: string;
  status: CertificateStatus;
  revokedAt?: string;
  revokedReason?: string;
}

/** The public, masked payload returned by the verification page. */
export interface CertificateVerification {
  certificateNumber: string;
  maskedEmployeeName: string;
  trainingTitle: string;
  issuedAt: string;
  status: CertificateStatus;
}
