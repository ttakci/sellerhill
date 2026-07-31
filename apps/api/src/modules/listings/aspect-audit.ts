/**
 * Compact per-listing audit of how each item specific was resolved.
 *
 * Stored on the listing row (JSONB) rather than a child table: at 100k listings
 * x ~20 specifics that would be millions of rows for data only ever read in
 * aggregate or per listing. Keys are short for the same reason.
 */
export function summarizeAspectResolution(resolution: {
  decisions: Array<{ aspectName: string; value: string | null; layer: string; required: boolean }>;
}): { summary: Record<string, unknown>; autofilledCount: number } {
  const byLayer: Record<string, number> = {};
  const lowConfidence: string[] = [];

  for (const decision of resolution.decisions) {
    if (!decision.value) {
      continue;
    }
    byLayer[decision.layer] = (byLayer[decision.layer] ?? 0) + 1;
    if (decision.layer === 'terminal_fallback') {
      lowConfidence.push(decision.aspectName);
    }
  }

  return {
    summary: {
      v: 1,
      at: new Date().toISOString(),
      layers: byLayer,
      low: lowConfidence,
      decisions: resolution.decisions
        .filter((decision) => decision.value)
        .map((decision) => ({ n: decision.aspectName, v: decision.value, l: decision.layer })),
    },
    autofilledCount: lowConfidence.length,
  };
}
