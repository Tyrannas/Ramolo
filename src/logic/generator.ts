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
 * impingement-safe way to train hip flexion. A habitually arched standing
 * posture calls for practising the way out of it, whatever the factor scores.
 */
const FLAG_EXERCISES: Partial<Record<TestFlag, string[]>> = {
  'limited-hip-internal-rotation': ['hip-windshield-wipers'],
  'anterior-hip-impingement': ['seated-active-hip-flexion'],
  'habitual-lumbar-extension': ['wall-posterior-tilt-hold', 'standing-reset'],
  'patellofemoral-pain': ['straight-leg-raise', 'wall-sit'],
  'lateral-knee-pain': ['side-lying-hip-abduction', 'standing-hip-hike'],
};

/** An exercise the content marks as unsafe while one of the user's flags is active. */
function isAvoided(ex: Exercise, flags: Set<TestFlag>): boolean {
  return (ex.avoidWithFlags ?? []).some((f) => flags.has(f));
}

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

/** Never prescribe more than one level above the factor score; easier is always allowed. */
const MAX_LEVELS_ABOVE_SCORE = 1;

/** How many near-equivalent candidates a factor rotates through. */
const ROTATION_POOL_SIZE = 4;

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
  /** Highest level allowed for an exercise, given the scores of everything it works. */
  levelCap: (ex: Exercise) => number = () => targetLevel + MAX_LEVELS_ABOVE_SCORE,
): Exercise[] {
  const prefersActive = flags.has('responds-to-active-work');
  return content.exercises
    .filter((ex) => ex.targets.includes(factor))
    .filter((ex) => !hidden.has(ex.id))
    .filter((ex) => !isAvoided(ex, flags))
    .filter((ex) => ex.goals.some((g) => activeGoalIds.has(g)))
    .filter((ex) => ex.level <= levelCap(ex))
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

/**
 * The near-equivalent top of a ranked candidate list: within one level of the
 * best match, and active (cycle) work only when the user responds to it.
 */
function rotationPool(ranked: Exercise[], targetLevel: number, flags: Set<TestFlag>): Exercise[] {
  if (ranked.length === 0) return [];
  let pool = ranked;
  if (flags.has('responds-to-active-work') && pool.some((ex) => ex.dosage.cycles)) {
    pool = pool.filter((ex) => ex.dosage.cycles);
  }
  const bestDistance = Math.min(...pool.map((ex) => Math.abs(ex.level - targetLevel)));
  return pool
    .filter((ex) => Math.abs(ex.level - targetLevel) <= bestDistance + 1)
    .slice(0, ROTATION_POOL_SIZE);
}

/** Rotate a list by `offset`, so that each session starts from a different element. */
function rotate<T>(list: T[], offset: number): T[] {
  if (list.length === 0) return list;
  const k = offset % list.length;
  return [...list.slice(k), ...list.slice(0, k)];
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
      if (ex && !hiddenExerciseIds.has(ex.id) && !isAvoided(ex, flags)) tryAdd(ex);
    }
  }

  const targetLevelOf = (f: FactorId) => Math.round(factorScore(factorScores, f));
  // An exercise picked for a strong factor may also load a blocked one (a cross-legged
  // forward fold stretches the adductors too): its weakest target sets the cap.
  const levelCap = (ex: Exercise) =>
    Math.min(...ex.targets.map(targetLevelOf)) + MAX_LEVELS_ABOVE_SCORE;
  const rankedFor = (f: FactorId) =>
    candidatesForFactor(
      f,
      content,
      activeGoalIds,
      targetLevelOf(f),
      hiddenExerciseIds,
      flags,
      levelCap,
    ).filter((ex) => !chosenIds.has(ex.id));

  // Pass 1: one exercise per demanded factor, weakest first. Each factor rotates
  // through its own pool, offset by its rank: factors do not all turn in step,
  // so the combinations repeat far less often than the pools themselves.
  sortedFactors.forEach((factor, rank) => {
    if (seconds >= budget) return;
    const pool = rotationPool(rankedFor(factor), targetLevelOf(factor), flags);
    if (pool.length > 0) tryAdd(pool[(rotation + rank) % pool.length]);
  });

  // Guarantee at least one strength exercise (avoid the "all stretching" trap),
  // itself rotating among the strength options of the most-demanded factors.
  if (!chosen.some((e) => e.type === 'strength')) {
    const strengthByDemand = [
      ...new Map(
        sortedFactors
          .flatMap((f) => rankedFor(f).filter((ex) => ex.type === 'strength'))
          .map((ex) => [ex.id, ex]),
      ).values(),
    ].slice(0, 3);
    if (strengthByDemand.length > 0) {
      const strength = strengthByDemand[rotation % strengthByDemand.length];
      // Drop the least-demanded picks (chosen is in demand order) until it fits:
      // one removal is not always enough once timed dosages are budgeted honestly.
      const strengthCost = estimateExerciseSeconds(strength);
      while (seconds + strengthCost > budget && chosen.length > 0) {
        const removed = chosen.pop()!;
        chosenIds.delete(removed.id);
        seconds -= estimateExerciseSeconds(removed);
      }
      tryAdd(strength);
    }
  }

  // Pass 2: top up remaining time budget, starting each session from a
  // different candidate so the filler varies too.
  if (seconds < budget * 0.75) {
    for (const factor of sortedFactors) {
      for (const c of rotate(rankedFor(factor), rotation)) {
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
