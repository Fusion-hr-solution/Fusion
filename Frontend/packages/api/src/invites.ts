/** Anonymous invite validate / accept (Identity). */
import type { AccountPasswordRequirementsDto } from "./tenant-access";

export interface InviteDto {
  id: string;
  token?: string | null;
  inviteLink?: string | null;
  email: string;
  tenantId: string;
  tenantName: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  expiresAt: string;
  isExpired: boolean;
  isUsed: boolean;
  createdAt: string;
  passwordRequirements?: AccountPasswordRequirementsDto | null;
}

export interface AcceptInviteRequest {
  password: string;
  firstName?: string | null;
  lastName?: string | null;
}

export const invitePaths = {
  validate: (token: string) => `/identity/invites/${encodeURIComponent(token)}`,
  accept: (token: string) =>
    `/identity/invites/${encodeURIComponent(token)}/accept`,
} as const;

export const inviteQueryKeys = {
  all: () => ["invites"] as const,
  validate: (token: string) =>
    [...inviteQueryKeys.all(), "validate", token] as const,
} as const;
