/** Anonymous invite validate / accept (Identity). */

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
