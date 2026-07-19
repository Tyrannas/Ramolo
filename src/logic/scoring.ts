import type { DiagnosticTest, Score, ScoringBand } from '../types';

/** Map a raw numeric measurement to a 0-3 score using the test's scoring bands. */
export function scoreFromBands(bands: ScoringBand[], value: number): Score {
  for (const band of bands) {
    const aboveMin = value >= band.min;
    const belowMax = band.max === undefined || value < band.max;
    if (aboveMin && belowMax) return band.score;
  }
  // Fallback: below the first band's min ⇒ worst score.
  return 0;
}

/**
 * Compute the 0-3 score for a raw value entered against a test.
 * For `level` measures the raw value IS the chosen score.
 */
export function scoreTest(test: DiagnosticTest, rawValue: number): Score {
  if (test.measure.kind === 'level') {
    return clampScore(rawValue);
  }
  if (test.scoring) {
    return scoreFromBands(test.scoring, rawValue);
  }
  return 0;
}

export function clampScore(n: number): Score {
  const r = Math.round(n);
  if (r <= 0) return 0;
  if (r >= 3) return 3;
  return r as Score;
}

export const SCORE_LABELS: Record<Score, string> = {
  0: 'Bloqué',
  1: 'Limité',
  2: 'Fonctionnel',
  3: 'Bon',
};

export const SCORE_COLORS: Record<Score, string> = {
  0: '#d8624b', // clay red
  1: '#e0a341', // amber
  2: '#8fb04a', // olive
  3: '#3f7d63', // brand green
};
