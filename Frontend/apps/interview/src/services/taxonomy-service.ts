import { createPlatformApiClient } from "@repo/api";
import { DEFAULT_TAXONOMY, type Taxonomy, type TaxonomyItem, type TaxonomyList, type TaxonomyListKey } from "@/config/taxonomy";
import type {
  BackendInterviewTaxonomyDto,
  BackendTaxonomyListDto,
  UpdateInterviewTaxonomyRequest,
  UpdateTaxonomyItemRequest,
} from "./models/taxonomy-models";

const client = createPlatformApiClient();

const TAXONOMY_ENDPOINT = "/interview/taxonomy";

function mapItem(dto: BackendInterviewTaxonomyDto["lists"][string]["items"][number]): TaxonomyItem {
  return {
    value: dto.value,
    label: dto.label,
    hidden: dto.hidden,
    isDefault: dto.isDefault,
    supportsAutoGrading: dto.supportsAutoGrading ?? undefined,
  };
}

function mapList(key: TaxonomyListKey, dto: BackendTaxonomyListDto | undefined): TaxonomyList {
  // A list the server didn't return falls back to its canonical default rather than rendering empty.
  if (!dto) return DEFAULT_TAXONOMY.lists[key];
  return { key, locked: dto.locked, items: dto.items.map(mapItem) };
}

function mapTaxonomy(dto: BackendInterviewTaxonomyDto): Taxonomy {
  const keys = Object.keys(DEFAULT_TAXONOMY.lists) as TaxonomyListKey[];
  return {
    version: dto.version,
    lists: keys.reduce((acc, key) => {
      acc[key] = mapList(key, dto.lists?.[key]);
      return acc;
    }, {} as Taxonomy["lists"]),
  };
}

export async function getTaxonomy(): Promise<Taxonomy> {
  const dto = await client.get<BackendInterviewTaxonomyDto>(TAXONOMY_ENDPOINT);
  return mapTaxonomy(dto);
}

/** Saves only the given lists; every other list is left untouched server-side. */
export async function saveTaxonomyLists(
  lists: Partial<Record<TaxonomyListKey, TaxonomyItem[]>>
): Promise<Taxonomy> {
  const payload: UpdateInterviewTaxonomyRequest = {
    lists: Object.entries(lists).reduce((acc, [key, items]) => {
      acc[key] = (items ?? []).map<UpdateTaxonomyItemRequest>((item) => ({
        value: item.value,
        label: item.label,
        hidden: item.hidden,
      }));
      return acc;
    }, {} as Record<string, UpdateTaxonomyItemRequest[]>),
  };

  const dto = await client.put<BackendInterviewTaxonomyDto>(TAXONOMY_ENDPOINT, payload);
  return mapTaxonomy(dto);
}
