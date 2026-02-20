export interface PlatformModule {
  id: string;
  title: string;
  description: string;
  status: "active" | "maintenance" | "disabled";
}

export interface PlatformSettings {
  appName: string;
  environment: string;
  version: string;
}
