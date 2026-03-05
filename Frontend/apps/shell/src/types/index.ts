export interface Microfrontend {
  title: string;
  description: string;
  href: string;
  badge: string;
}

export interface NavItem {
  label: string;
  href: string;
}

export type {
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  AuthResponse,
  ApiResponse,
  AuthUser,
  AuthState,
} from "./auth";
