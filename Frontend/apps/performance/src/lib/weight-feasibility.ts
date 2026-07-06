/**
 * Checks whether a set of allowed weight values can sum to exactly 100%
 * within the given maximum objective count.
 *
 * Mirrors the server-side subset-sum DP in the planning configuration validator.
 * Uses the P1.1 weight standard: unique whole percentages in 5% increments.
 */
export function checkWeightFeasibility(
  allowedWeightValues: string,
  maxObjectives: number,
): { feasible: boolean; reason?: string; example?: string } {
  const tokens = allowedWeightValues.split(",").map((w) => w.trim()).filter(Boolean);
  const weights: number[] = [];

  for (const token of tokens) {
    const weight = Number(token);
    if (!Number.isInteger(weight) || weight <= 0 || weight > 100 || weight % 5 !== 0) {
      return {
        feasible: false,
        reason: "Weights must be unique whole percentages using 5% increments.",
      };
    }
    weights.push(weight);
  }

  if (weights.length !== new Set(weights).size) {
    return {
      feasible: false,
      reason: "Weights must be unique whole percentages using 5% increments.",
    };
  }

  if (weights.length === 0)
    return { feasible: false, reason: "No valid weights specified." };

  if (maxObjectives < 1)
    return { feasible: false, reason: "Max objectives must be at least 1." };

  const target = 100;
  const reachable: number[] = new Array<number>(target + 1).fill(Infinity);
  const prev: number[] = new Array<number>(target + 1).fill(-1);
  reachable[0] = 0;

  for (let s = 1; s <= target; s++) {
    for (const w of weights) {
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
    example.push(w);
    remaining -= w;
  }

  return { feasible: true, example: example.map((w) => `${w}%`).join(" + ") + " = 100%" };
}
