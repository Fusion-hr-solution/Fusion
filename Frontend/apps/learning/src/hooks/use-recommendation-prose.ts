import { useEffect, useState } from "react";
import type { Recommendation } from "@/types";
import { getRecommendationsProse } from "@/services/learning-service";

// Two attempts, giving the AI service's async prose generation time to land.
const POLL_DELAYS_MS = [4000, 8000];

/**
 * Progressive 'why this' prose (AI-L-6 R6). The rail renders instantly with template
 * reasons; this polls the prose endpoint for any recommendation whose prose isn't ready
 * yet and merges it in when it arrives. Fail-soft — if prose never generates (AI service
 * down/slow), the template reason simply stays.
 */
export function useRecommendationProse(
  recommendations: Recommendation[],
): Recommendation[] {
  const [prose, setProse] = useState<Record<string, string>>({});

  // Re-run only when the set of recommendations changes, not on every prose merge.
  const hashKey = recommendations.map((r) => r.provenanceHash).join(",");

  useEffect(() => {
    let remaining = recommendations
      .filter((r) => r.provenanceHash && !r.prose)
      .map((r) => r.provenanceHash);
    if (remaining.length === 0) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const attempt = (i: number) => {
      timers.push(
        setTimeout(async () => {
          if (cancelled) return;
          const got = await getRecommendationsProse(remaining);
          if (cancelled) return;
          if (Object.keys(got).length > 0) {
            setProse((prev) => ({ ...prev, ...got }));
            remaining = remaining.filter((h) => !(h in got));
          }
          if (i + 1 < POLL_DELAYS_MS.length && remaining.length > 0) attempt(i + 1);
        }, POLL_DELAYS_MS[i]),
      );
    };
    attempt(0);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hashKey]);

  return recommendations.map((r) => ({
    ...r,
    prose: r.prose ?? prose[r.provenanceHash] ?? null,
  }));
}
