const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export const API_ENDPOINTS = {
  login: `${API_BASE_URL}/api/identity/auth/login`,
  register: `${API_BASE_URL}/api/identity/auth/register`,
  refresh: `${API_BASE_URL}/api/identity/auth/refresh`,
  logout: `${API_BASE_URL}/api/identity/auth/logout`,
} as const;
