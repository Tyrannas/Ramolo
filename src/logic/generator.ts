import type { Content } from '../data/content';
import { cycleSetSeconds, type Exercise, type FactorId, type Goal, type TestFlag } from '../types';
import type { FactorScore } from './profile';

// ---------------------------------------------------------------------------
// Deterministic session generator (no AI needed, per the plan §6).
//   1. Weight each factor by goal weight × (3 − factor score): the weakest
//      factors get the most volume.
//   2. Pick exercises covering those factors, at the level matching the score.
//   3. Fill up to the target duration, always keeping ≥1 strength exercise
//      and rotating lightly from one session to the next.
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  goals: Goal[];
  factorScores: Map<FactorId, FactorScore>;
  targetMinutes: number;
  hiddenExerciseIds: Set<string>;
  /** Rotation seed — pass the number of sessions already completed. */
  rotation: number;
  /** Qualitative flags raised by follow-up answers. */
  flags?: Set<TestFlag>;
}

/**
 * Exercises pulled in by a flag rather than by factor weighting. Without this,
 * they would never be selected: `hip-windshield-wipers` targets internal hip
 * rotation, which no goal weights, and `seated-active-hip-flexion` is the
 * impingement-safe way to train hip flexion.
 */
const FLAG_EXERCISES: Partial<Record<TestFlag, string[]>> = {
  'limited-hip-internal-rotation': ['hip-windshield-wipers'],
  'anterior-hip-impingement': ['seated-active-hip-flexion'],
};

export interface GeneratedSession {
  exercises: Exercise[];
  estimatedSeconds: number;
  focusFactors: FactorId[];
}

/** Rough time cost of one exercise, including short inter-set rests. */
export function estimateExerciseSeconds(ex: Exercise): number {
  const d = ex.dosage;
  const sides = d.perSide ? 2 : 1;
  const sets = d.sets ?? 1;
  const perSet = d.cycles
    ? cycleSetSeconds(d.cycles)
    : (d.holdSeconds ?? (d.reps ? d.reps * 3 : 30));
  const restPerSet = 15;
  return (perSet + restPerSet) * sets * sides;
}

/** Default factor score (assume worst-but-workable) when never assessed. */
const DEFAULT_FACTOR_SCORE = 1;

function factorScore(scores: Map<FactorId, FactorScore>, f: FactorId): number {
  return scores.get(f)?.score ?? DEFAULT_FACTOR_SCORE;
}

/** Weighted demand per factor across all active goals. */
export function computeFactorDemand(
  goals: Goal[],
  scores: Map<FactorId, FactorScore>,
): Map<FactorId, number> {
  const demand = new Map<FactorId, number>();
  for (const goal of goals) {
    for (const [factorStr, weight] of Object.entries(goal.factors)) {
      const factor = factorStr as FactorId;
      const deficit = 3 - factorScore(scores, factor); // 0..3, higher = weaker
      const add = weight * deficit;
      demand.set(factor, (demand.get(factor) ?? 0) + add);
    }
  }
  return demand;
}

/**
 * Rank candidate exercises for a factor: closest level to the user's score,
 * belonging to an active goal, deprioritising already-picked ones.
 */
function candidatesForFactor(
  factor: FactorId,
  content: Content,
  activeGoalIds: Set<string>,
  targetLevel: number,
  hidden: Set<string>,
  flags: Set<TestFlag> = new Set(),
): Exercise[] {
  const prefersActive = flags.has('responds-to-active-work');
  return content.exercises
    .filter((ex) => ex.targets.includes(factor))
    .filter((ex) => !hidden.has(ex.id))
    .filter((ex) => ex.goals.some((g) => activeGoalIds.has(g)))
    .sort((a, b) => {
      // When the user responds much better to active work, interval (cycle)
      // exercises outrank long passive holds regardless of level proximity.
      if (prefersActive) {
        const aActive = a.dosage.cycles ? 0 : 1;
        const bActive = b.dosage.cycles ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
      }
      const da = Math.abs(a.level - targetLevel);
      const db = Math.abs(b.level - targetLevel);
      if (da !== db) return da - db;
      // Prefer exercises that are the primary target (single-factor) for clarity.
      return a.targets.length - b.targets.length;
    });
}

export function generateSession(opts: GenerateOptions, content: Content): GeneratedSession {
  const { goals, factorScores, targetMinutes, hiddenExerciseIds, rotation } = opts;
  const flags = opts.flags ?? new Set<TestFlag>();
  const activeGoalIds = new Set(goals.map((g) => g.id));
  const budget = targetMinutes * 60;

  const demand = computeFactorDemand(goals, factorScores);
  const sortedFactors = [...demand.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([f]) => f);

  const chosen: Exercise[] = [];
  const chosenIds = new Set<string>();
  let seconds = 0;

  const tryAdd = (ex: Exercise | undefined): boolean => {
    if (!ex || chosenIds.has(ex.id)) return false;
    const cost = estimateExerciseSeconds(ex);
    if (seconds + cost > budget && chosen.length > 0) return false;
    chosen.push(ex);
    chosenIds.add(ex.id);
    seconds += cost;
    return true;
  };

  // Pass 0: exercises mandated by an active flag, before the budget fills up.
  // These answer a qualitative finding no factor weighting would surface.
  for (const flag of flags) {
    for (const id of FLAG_EXERCISES[flag] ?? []) {
      const ex = content.exerciseById.get(id);
      if (ex && !hiddenExerciseIds.has(ex.id)) tryAdd(ex);
    }
  }

  // Pass 1: one exercise per demanded factor, weakest first, with rotation.
  for (const factor of sortedFactors) {
    if (seconds >= budget) break;
    const targetLevel = Math.round(factorScore(factorScores, factor));
    const cands = candidatesForFactor(
      factor,
      content,
      activeGoalIds,
      targetLevel,
      hiddenExerciseIds,
      flags,
    ).filter((ex) => !chosenIds.has(ex.id));
    if (cands.length === 0) continue;
    // Light rotation: offset into the equally-ranked top of the list.
    const pick = cands[rotation % Math.min(cands.length, 3)];
    tryAdd(pick);
  }

  // Guarantee at least one strength exercise (avoid the "all stretching" trap).
  if (!chosen.some((e) => e.type === 'strength')) {
    const strengthByDemand = sortedFactors
      .flatMap((f) =>
        candidatesForFactor(f, content, activeGoalIds, 1, hiddenExerciseIds, flags).filter(
          (ex) => ex.type === 'strength' && !chosenIds.has(ex.id),
        ),
      );
    if (strengthByDemand.length > 0) {
      // Drop the least-demanded pick if we're at budget, to make room.
      if (seconds + estimateExerciseSeconds(strengthByDemand[0]) > budget && chosen.length > 1) {
        const removed = chosen.pop();
        if (removed) {
          chosenIds.delete(removed.id);
          seconds -= estimateExerciseSeconds(removed);
        }
      }
      tryAdd(strengthByDemand[0]);
    }
  }

  // Pass 2: top up remaining time budget with the next-best options.
  if (seconds < budget * 0.75) {
    for (const factor of sortedFactors) {
      const cands = candidatesForFactor(
        factor,
        content,
        activeGoalIds,
        Math.round(factorScore(factorScores, factor)),
        hiddenExerciseIds,
        flags,
      ).filter((ex) => !chosenIds.has(ex.id));
      for (const c of cands) {
        if (seconds >= budget * 0.95) break;
        tryAdd(c);
      }
      if (seconds >= budget * 0.95) break;
    }
  }

  // Order the session: warm-up mobility/stretch first, strength in the middle,
  // and the signature "practice the position" drills last.
  const typeOrder: Record<Exercise['type'], number> = {
    stretch: 0,
    'mobility-drill': 1,
    strength: 2,
    'test-retest': 3,
  };
  chosen.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

  return {
    exercises: chosen,
    estimatedSeconds: seconds,
    focusFactors: sortedFactors.slice(0, 3),
  };
}

/** Find the easier variant of an exercise (regression), if any. */
export function findRegression(ex: Exercise, content: Content): Exercise | null {
  // `progressionOf: X` means "this is a progression of X" ⇒ X is the regression.
  if (ex.progressionOf) {
    const r = content.exerciseById.get(ex.progressionOf);
    if (r) return r;
  }
  // Otherwise an exercise whose `regressionOf` points at us is an easier sibling.
  const sibling = content.exercises.find((e) => e.regressionOf === ex.id);
  return sibling ?? null;
}
