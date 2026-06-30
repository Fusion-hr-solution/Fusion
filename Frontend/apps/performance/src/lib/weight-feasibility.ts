/**
 * Checks whether a set of allowed weight values can sum to exactly 100%
 * within the given maximum objective count.
 *
 * Mirrors the server-side subset-sum DP in the policy validator.
 * Works in integer cents (w × 100) to avoid float comparison issues.
 */
export function checkWeightFeasibility(
  allowedWeightValues: string,
  maxObjectives: number,
): { feasible: boolean; reason?: string; example?: string } {
  const weights = allowedWeightValues
    .split(",")
    .map((w) => parseFloat(w.trim()))
    .filter((w) => !isNaN(w) && w > 0 && w <= 100);

  if (weights.length === 0)
    return { feasible: false, reason: "No valid weights specified." };

  if (maxObjectives < 1)
    return { feasible: false, reason: "Max objectives must be at least 1." };

  const target = 10000;
  const weightInts = weights.map((w) => Math.round(w * 100));
  const reachable: number[] = new Array<number>(target + 1).fill(Infinity);
  const prev: number[] = new Array<number>(target + 1).fill(-1);
  reachable[0] = 0;

  for (let s = 1; s <= target; s++) {
    for (const w of weightInts) {
      if (w > s) continue;
      const prevVal = reachable[s - w] ?? Infinity;
      if (prevVal === Infinity) continue;
      const candidate = prevVal + 1;
      const curVal = reachable[s] ?? Infinity;
      if (candidate <= maxObjectives && candidate < curVal) {
        reachable[s] = candidate;
        prev[s] = w;
      }
    }
  }

  const finalCount = reachable[target] ?? Infinity;
  if (finalCount === Infinity || finalCount > maxObjectives) {
    return {
      feasible: false,
      reason: `No combination of {${weights.join(", ")}} sums to exactly 100% within ${maxObjectives} objective(s).`,
    };
  }

  const example: number[] = [];
  let remaining = target;
  while (remaining > 0) {
    const w = prev[remaining] ?? 0;
    if (w <= 0) break;
    example.push(w / 100);
    remaining -= w;
  }

  return { feasible: true, example: example.map((w) => `${w}%`).join(" + ") + " = 100%" };
}
