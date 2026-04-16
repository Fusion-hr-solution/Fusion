export type DraftStructureWorkspaceStatus = "empty" | "inProgress";

export interface DraftOrgUnitDto {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId: string | null;
  parentName: string | null;
  createdAt: string;
  updatedAt: string | null;
  version: number;
}

export interface DraftOrgUnitTreeNodeDto {
  id: string;
  code: string;
  name: string;
  type: string;
  level: number;
  isOrphaned: boolean;
  children: DraftOrgUnitTreeNodeDto[];
}

export interface DraftStructureWorkspaceDto {
  workspaceStatus: DraftStructureWorkspaceStatus;
  unitCount: number;
  rootUnitCount: number;
  lastModifiedAt: string | null;
  allowedTypes: string[];
  units: DraftOrgUnitDto[];
}

export interface CreateDraftOrgUnitRequest {
  code: string;
  name: string;
  type: string;
  parentId: string | null;
}

export interface UpdateDraftOrgUnitRequest {
  code: string;
  name: string;
  type: string;
  parentId: string | null;
}

export const draftStructurePaths = {
  workspace: () => "/corehr/setup/draft-structure",
  tree: () => "/corehr/setup/draft-structure/tree",
  detail: (id: string) => `/corehr/setup/draft-structure/${id}`,
  create: () => "/corehr/setup/draft-structure",
  update: (id: string) => `/corehr/setup/draft-structure/${id}`,
  remove: (id: string) => `/corehr/setup/draft-structure/${id}`,
} as const;