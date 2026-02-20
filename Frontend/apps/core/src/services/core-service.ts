import { type PlatformModule } from "@/types";

const MOCK_MODULES: PlatformModule[] = [
  {
    id: "1",
    title: "User Management",
    description: "Manage users, roles, and permissions across the platform.",
    status: "active",
  },
  {
    id: "2",
    title: "System Configuration",
    description: "Configure global system settings and environment variables.",
    status: "active",
  },
  {
    id: "3",
    title: "API Gateway",
    description: "Monitor and manage API endpoints and rate limiting.",
    status: "maintenance",
  },
  {
    id: "4",
    title: "Audit Logs",
    description: "View system audit trails and activity logs.",
    status: "active",
  },
];

export async function getPlatformModules(): Promise<PlatformModule[]> {
  // TODO: Replace with actual API call
  return MOCK_MODULES;
}
