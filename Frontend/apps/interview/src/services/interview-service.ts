import { type Interview } from "@/types";

type ProcessLike = { env?: Record<string, string | undefined> };

type InterviewStatus = Interview["status"];

interface ApiEnvelope<T> {
  data?: T;
  errors?: string[];
  message?: string;
}

interface PagedResultDto<T> {
  items: T[];
}

interface BackendInterviewDto {
  id: string;
  candidate?: string;
  candidateName?: string;
  role?: string;
  title?: string;
  status?: string;
  date?: string;
  scheduledAt?: string;
  createdAt?: string;
}

function getApiBaseUrl(): string {
  const env = (globalThis as { process?: ProcessLike }).process?.env;
  const base = env?.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!base) {
    return "/api";
  }

  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function normalizeStatus(value?: string): InterviewStatus {
  switch ((value ?? "").toLowerCase()) {
    case "scheduled":
      return "scheduled";
    case "in-progress":
    case "inprogress":
      return "in-progress";
    case "completed":
      return "completed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      return "scheduled";
  }
}

function toDateOnly(value?: string): string {
  if (!value) {
    return new Date().toISOString().split("T")[0] ?? "";
  }

  return value.includes("T") ? (value.split("T")[0] ?? value) : value;
}

function mapBackendInterview(dto: BackendInterviewDto): Interview {
  return {
    id: dto.id,
    candidate: dto.candidateName ?? dto.candidate ?? "Unknown Candidate",
    role: dto.role ?? dto.title ?? "Unassigned Role",
    status: normalizeStatus(dto.status),
    date: toDateOnly(dto.date ?? dto.scheduledAt ?? dto.createdAt),
  };
}

function extractList(payload: ApiEnvelope<PagedResultDto<BackendInterviewDto> | BackendInterviewDto[]>) {
  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (payload.data && "items" in payload.data && Array.isArray(payload.data.items)) {
    return payload.data.items;
  }

  return [];
}

function extractMessage(payload: ApiEnvelope<unknown>, statusText: string): string {
  if (payload.errors && payload.errors.length > 0) {
    return payload.errors[0] ?? statusText;
  }

  return payload.message ?? statusText;
}

export async function getInterviews(): Promise<Interview[]> {
  const response = await fetch(`${getApiBaseUrl()}/interview/interviews`, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<
    PagedResultDto<BackendInterviewDto> | BackendInterviewDto[]
  >;

  if (!response.ok) {
    throw new Error(extractMessage(payload, "Failed to fetch interviews."));
  }

  return extractList(payload).map(mapBackendInterview);
}

export async function getInterviewById(id: string): Promise<Interview | undefined> {
  const response = await fetch(`${getApiBaseUrl()}/interview/interviews/${encodeURIComponent(id)}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (response.status === 404) {
    return undefined;
  }

  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<BackendInterviewDto>;

  if (!response.ok) {
    throw new Error(extractMessage(payload, "Failed to fetch interview details."));
  }

  if (!payload.data) {
    return undefined;
  }

  return mapBackendInterview(payload.data);
}
