export interface BackendTaxonomyItemDto {
  value: string;
  label: string;
  hidden: boolean;
  isDefault: boolean;
  supportsAutoGrading?: boolean | null;
}

export interface BackendTaxonomyListDto {
  key: string;
  locked: boolean;
  items: BackendTaxonomyItemDto[];
}

export interface BackendInterviewTaxonomyDto {
  version: number;
  lists: Record<string, BackendTaxonomyListDto>;
}

export interface UpdateTaxonomyItemRequest {
  value: string;
  label: string;
  hidden: boolean;
}

/** Partial by design — only the lists being saved are sent. */
export interface UpdateInterviewTaxonomyRequest {
  lists: Record<string, UpdateTaxonomyItemRequest[]>;
}
