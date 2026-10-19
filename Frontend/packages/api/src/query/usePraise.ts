"use client";

import { useMemo } from "react";
import {
  conversationQueryKeys,
  createConversationsApi,
  type ConversationsApi,
  type PraiseListQuery,
  type PraiseReactionKind,
} from "../performance-conversations";
import { performanceQueryKeys } from "../performance";
import { createPlatformApiClient } from "../platform";
import { useApiMutation } from "./useApiMutation";
import { useApiQuery } from "./useApiQuery";

export interface UsePraiseOptions {
  enabled?: boolean;
  /** Injected for tests; defaults to the platform client through the shell's `/api`. */
  api?: ConversationsApi;
}

function useConversationsApi(api?: ConversationsApi): ConversationsApi {
  return useMemo(() => api ?? createConversationsApi(createPlatformApiClient()), [api]);
}

/**
 * A page of the tenant's praise (D-14), shared by the Fusion home and Performance. Praise is public to everyone
 * with Performance access, so callers gate on the module, not on a relationship.
 */
export function usePraiseFeed(query: PraiseListQuery, options: UsePraiseOptions = {}) {
  const api = useConversationsApi(options.api);
  return useApiQuery(conversationQueryKeys.praiseList(query), (signal) => api.listPraise(query, signal), {
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });
}

/**
 * The company's values (active competencies, by name), shared by every host so a value keeps the same identity hue
 * on every surface.
 */
export function useCompanyValues(options: UsePraiseOptions = {}) {
  const api = useConversationsApi(options.api);
  return useApiQuery(conversationQueryKeys.values(), (signal) => api.listValues(signal), {
    enabled: options.enabled ?? true,
    staleTime: 5 * 60_000,
  });
}

export interface ReactToPraiseArgs {
  praiseId: string;
  kind: PraiseReactionKind;
  add: boolean;
}

/** Adds or removes the viewer's reaction; every praise list and person summary refreshes. */
export function useReactToPraise(options: Pick<UsePraiseOptions, "api"> = {}) {
  const api = useConversationsApi(options.api);
  return useApiMutation(({ praiseId, kind, add }: ReactToPraiseArgs) => api.react(praiseId, kind, add), {
    invalidateQueries: [
      { queryKey: conversationQueryKeys.praise() },
      { queryKey: [...performanceQueryKeys.all(), "person-summary"] },
    ],
  });
}
