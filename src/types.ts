// ---------------------------------------------------------------------------
// Domain model — mirrors the static JSON in /public/data.
// All user-facing strings are localised objects: { fr: string, en?: string }.
// ---------------------------------------------------------------------------

export type Locale = 'fr' | 'en';

/** A localised string. `fr` is always present; other locales are optional. */
export type L10n = { fr: string } & Partial<Record<Locale, string>>;

/** A localised list of strings (e.g. step-by-step instructions). */
export type L10nList = { fr: string[] } & Partial<Record<Locale, string[]>>;

export type FactorId =
  | 'ankle-dorsiflexion'
  | 'hip-flexion'
  | 'hip-external-rotation'
  | 'hip-internal-rotation'
  | 'adductors'
  | 'hamstrings'
  | 'hip-flexors'
  | 'pelvic-control'
  | 'core-endurance'
  | 'glute-strength'
  | 'lateral-hip-stability'
  | 'standing-endurance'
  | 'balance-control'
  | 'quadriceps-strength'
  | 'knee-control'
  | 'knee-load-tolerance'
  | 'thoracic-mobility'
  | 'shoulder-mobility'
  | 'upper-back-strength'
  | 'neck-endurance'
  | 'nerve-mobility';

export interface Factor {
  id: FactorId;
  name: L10n;
  description: L10n;
}

export interface Goal {
  id: string;
  priority: number;
  name: L10n;
  tagline: L10n;
  description: L10n;
  tests: string[];
  /** Weight of each factor in this goal's overall readiness (sums to ~1). */
  factors: Partial<Record<FactorId, number>>;
  milestones: L10nList;
  prerequisites: { goalId: string; minLevel: number }[];
}

// --- Tests -----------------------------------------------------------------

/** A discrete level option (score 0-3) for `kind: 'level'` measures. */
export interface MeasureLevel {
  score: 0 | 1 | 2 | 3;
  label: L10n;
}

/** A scoring band mapping a raw numeric value to a 0-3 score. */
export interface ScoringBand {
  min: number;
  /** Upper bound (exclusive). Omitted on the last, open-ended band. */
  max?: number;
  score: 0 | 1 | 2 | 3;
}

export type TestMeasure =
  | { kind: 'level'; levels: MeasureLevel[] }
  | { kind: 'cm'; prompt: L10n }
  | { kind: 'seconds'; prompt: L10n };

/** Qualitative flags a follow-up answer can raise; they steer the program. */
export type TestFlag =
  | 'limited-hip-internal-rotation'
  | 'responds-to-active-work'
  | 'anterior-hip-impingement'
  | 'seek-professional-advice'
  | 'habitual-lumbar-extension'
  | 'knee-pain-in-rotation'
  | 'patellofemoral-pain'
  | 'lateral-knee-pain';

export interface FollowUpOption {
  id: string;
  label: L10n;
  flag: TestFlag | null;
  /** Feeds a factor gauge directly — the other legitimate source of a score. */
  factorScoreOverride?: { factor: FactorId; score: Score };
}

/** A qualitative question asked right after the test's measurement. */
export interface FollowUp {
  prompt: L10n;
  options: FollowUpOption[];
}

export interface DiagnosticTest {
  id: string;
  name: L10n;
  factor: FactorId;
  /**
   * Informative only — shown for context, never contributes a score.
   * Only `factor` and follow-up `factorScoreOverride` produce scores.
   */
  secondaryFactors: FactorId[];
  /** When true, the test is performed and stored per side (left/right). */
  perSide: boolean;
  equipment: L10n;
  measure: TestMeasure;
  /** Present only for `cm`/`seconds` measures. */
  scoring?: ScoringBand[];
  instructions: L10nList;
  interpretation?: L10n;
  images: string[];
  videoUrl: string | null;
  videoQuery?: string;
  followUp?: FollowUp;
}

// --- Exercises -------------------------------------------------------------

export type ExerciseType = 'stretch' | 'strength' | 'mobility-drill' | 'test-retest';

/** One phase of an interval cycle, e.g. 5 s "contract" then 20 s "release". */
export interface CyclePhase {
  label: L10n;
  seconds: number;
}

/** Interval dosage: `count` repetitions of the `phases` sequence, per set. */
export interface Cycles {
  count: number;
  phases: CyclePhase[];
}

/**
 * Exactly one of `holdSeconds`, `reps` or `cycles` is set — they are the three
 * exclusive dosage kinds. All timing lives here, never only in `note`, which
 * carries context alone.
 */
export interface Dosage {
  reps?: number;
  sets?: number;
  holdSeconds?: number;
  cycles?: Cycles;
  perSide?: boolean;
  note?: L10n;
}

export type DosageKind = 'hold' | 'reps' | 'cycles';

export function dosageKind(d: Dosage): DosageKind {
  if (d.cycles) return 'cycles';
  if (d.holdSeconds) return 'hold';
  return 'reps';
}

/** Total seconds of one set of an interval dosage. */
export function cycleSetSeconds(c: Cycles): number {
  return c.count * c.phases.reduce((sum, p) => sum + p.seconds, 0);
}

export interface Exercise {
  id: string;
  name: L10n;
  targets: FactorId[];
  goals: string[];
  type: ExerciseType;
  /** 0 = max regression, 3 = advanced. */
  level: 0 | 1 | 2 | 3;
  regressionOf: string | null;
  progressionOf: string | null;
  dosage: Dosage;
  equipment?: L10n;
  instructions: L10nList;
  commonMistakes?: L10nList;
  safetyNotes?: L10nList;
  expectedFeeling?: L10n;
  images: string[];
  /** Externally hosted illustrations (public domain); not available offline. */
  remoteImages?: string[];
  imageAttribution?: { text: string; url: string; license: string };
  /** Alternative setup shown when the `anterior-hip-impingement` flag is on. */
  impingementFriendlySetup?: L10n;
  /** Never generated while one of these flags is active (e.g. knee torque on a painful knee). */
  avoidWithFlags?: TestFlag[];
  /**
   * Knee-loading work where mild pain (≤ 3/10, stable, settled by the next
   * morning) is acceptable: the player asks how strong the pain is instead of
   * treating any report as a stop signal.
   */
  painMonitoring?: boolean;
  videoUrl: string | null;
  videoQuery?: string;
  sourceAttribution?: { text: string; url: string; license: string };
}

/** The full static content bundle loaded once at startup. */
export interface ContentBundle {
  factors: Factor[];
  goals: Goal[];
  tests: DiagnosticTest[];
  exercises: Exercise[];
}

export type Score = 0 | 1 | 2 | 3;
export type Side = 'left' | 'right' | 'both';
