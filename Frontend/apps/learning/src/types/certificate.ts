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

/** One row of the admin certificate registry (full, unmasked detail). */
export interface AdminCertificate {
  id: string;
  certificateNumber: string;
  employeeId: string;
  employeeFullName: string;
  gradeName?: string;
  serviceLineName?: string;
  trainingId: string;
  trainingTitle: string;
  credits: number;
  completedAt: string;
  issuedAt: string;
  status: CertificateStatus;
  revokedAt?: string;
  revokedReason?: string;
  revokedBy?: string;
}

export interface CertificateRegistryFilters {
  trainingId?: string;
  gradeId?: string;
  from?: string;
  to?: string;
  status?: CertificateStatus | "";
  search?: string;
}

export interface CertificateRegistryPage {
  items: AdminCertificate[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface CertificateCountByKey {
  key: string;
  count: number;
}

export interface CertificateStats {
  total: number;
  validCount: number;
  revokedCount: number;
  byTraining: CertificateCountByKey[];
  byMonth: CertificateCountByKey[];
}
