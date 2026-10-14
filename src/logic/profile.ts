import type { Assessment, FollowUpAnswer } from '../db';
import type { Content } from '../data/content';
import type { FactorId, FollowUpOption, Goal, Score, TestFlag } from '../types';
import { t } from '../i18n';

// ---------------------------------------------------------------------------
// From raw assessments → a "profile of limitations": a 0-3 score per factor,
// plus a per-goal readiness and a plain-language synthesis sentence.
// This is what powers "your squat is limited by your ankles, not your hips".
// ---------------------------------------------------------------------------

export interface FactorScore {
  factor: FactorId;
  /** 0-3, averaged across the tests (and both sides) that measure this factor. */
  score: number;
  /** true when a left/right gap ≥ 1 point was observed. */
  asymmetric: boolean;
  /** Number of underlying assessments contributing. */
  sampleCount: number;
}

/** Keep only the most recent assessment per (testId, side). */
export function latestAssessments(assessments: Assessment[]): Assessment[] {
  const byKey = new Map<string, Assessment>();
  for (const a of assessments) {
    const key = `${a.testId}::${a.side}`;
    const prev = byKey.get(key);
    if (!prev || a.date > prev.date) byKey.set(key, a);
  }
  return [...byKey.values()];
}

/** Keep only the most recent follow-up answer per (testId, side). */
export function latestFollowUps(answers: FollowUpAnswer[]): FollowUpAnswer[] {
  const byKey = new Map<string, FollowUpAnswer>();
  for (const a of answers) {
    const key = `${a.testId}::${a.side}`;
    const prev = byKey.get(key);
    if (!prev || a.date > prev.date) byKey.set(key, a);
  }
  return [...byKey.values()];
}

/** Resolve a stored answer back to its option definition in the content. */
function resolveOption(answer: FollowUpAnswer, content: Content): FollowUpOption | undefined {
  return content.testById.get(answer.testId)?.followUp?.options.find((o) => o.id === answer.optionId);
}

/**
 * Compute a 0-3 score per factor.
 *
 * Only two things produce a score: a test's primary `factor`, and a follow-up
 * option's `factorScoreOverride`. `secondaryFactors` is informative only — it
 * is shown for context but never scores, because a composite test (a failed
 * deep squat) says little about any one of its secondary factors and would
 * blur the discrimination the app exists to provide ("your ankles are fine —
 * it's your hips").
 *
 * A factor absent from the returned map is *not evaluated* — callers must
 * render it as such, never as a full or good gauge.
 */
export function computeFactorScores(
  assessments: Assessment[],
  content: Content,
  followUps: FollowUpAnswer[] = [],
): Map<FactorId, FactorScore> {
  const latest = latestAssessments(assessments);

  const acc = new Map<FactorId, { sum: number; weight: number; count: number }>();
  // Track per-test per-side scores to detect asymmetry.
  const perTestSides = new Map<string, { side: string; score: Score }[]>();

  const contribute = (factor: FactorId, score: number) => {
    const cur = acc.get(factor) ?? { sum: 0, weight: 0, count: 0 };
    cur.sum += score;
    cur.weight += 1;
    cur.count += 1;
    acc.set(factor, cur);
  };

  for (const a of latest) {
    const test = content.testById.get(a.testId);
    if (!test) continue;

    const arr = perTestSides.get(a.testId) ?? [];
    arr.push({ side: a.side, score: a.score });
    perTestSides.set(a.testId, arr);

    contribute(test.factor, a.score);
  }

  // Follow-up overrides score their own factor (e.g. the 90/90 rear-glute
  // question is the only source for hip internal rotation).
  const overridePerTestSides = new Map<string, { side: string; score: Score }[]>();
  for (const answer of latestFollowUps(followUps)) {
    const override = resolveOption(answer, content)?.factorScoreOverride;
    if (!override) continue;
    contribute(override.factor, override.score);
    const key = `override::${override.factor}`;
    const arr = overridePerTestSides.get(key) ?? [];
    arr.push({ side: answer.side, score: override.score });
    overridePerTestSides.set(key, arr);
  }

  // Which factors show a meaningful left/right gap.
  const asymmetricFactors = new Set<FactorId>();
  const gapOf = (scores: number[]) =>
    scores.length >= 2 && Math.max(...scores) - Math.min(...scores) >= 1;

  for (const [testId, sides] of perTestSides) {
    const test = content.testById.get(testId);
    if (!test) continue;
    if (gapOf(sides.map((s) => s.score))) asymmetricFactors.add(test.factor);
  }
  // Overrides are scored per side too (the 90/90 rear glute differs L/R).
  for (const [key, sides] of overridePerTestSides) {
    const factor = key.replace('override::', '') as FactorId;
    if (gapOf(sides.map((s) => s.score))) asymmetricFactors.add(factor);
  }

  const result = new Map<FactorId, FactorScore>();
  for (const [factor, { sum, weight, count }] of acc) {
    result.set(factor, {
      factor,
      score: weight > 0 ? sum / weight : 0,
      asymmetric: asymmetricFactors.has(factor),
      sampleCount: count,
    });
  }
  return result;
}

/**
 * The set of qualitative flags currently raised by the user's latest follow-up
 * answers. These steer the program (which exercises, which setup cues) and the
 * safety banners.
 */
export function computeFlags(followUps: FollowUpAnswer[], content: Content): Set<TestFlag> {
  const flags = new Set<TestFlag>();
  for (const answer of latestFollowUps(followUps)) {
    const flag = resolveOption(answer, content)?.flag;
    if (flag) flags.add(flag);
  }
  return flags;
}

/** Short, plain-language notes for the flags worth surfacing in the profile. */
export const FLAG_NOTES: Record<TestFlag, string> = {
  'limited-hip-internal-rotation':
    "Ta rotation interne de hanche est limitée (fesse arrière en l'air au 90/90). Ce n'est pas un obstacle au tailleur, mais on l'entretient avec les essuie-glaces.",
  'responds-to-active-work':
    'Tu descends nettement plus bas en contractant activement : ton programme privilégiera les cycles actifs (contracté-relâché) aux tenues passives longues.',
  'anterior-hip-impingement':
    "Tu ressens un pincement à l'avant de la hanche. On travaille sous la butée, jamais dedans : les squats passent en stance large, pointes ouvertes.",
  'seek-professional-advice':
    "Tu as signalé une douleur franche à l'avant de la hanche. Fais le point avec un professionnel de santé avant de travailler le squat en amplitude.",
  'habitual-lumbar-extension':
    "Debout, ta position par défaut est cambrée : ton bas du dos reste en extension tant que tu ne bouges pas. Ton programme inclut le « reset » debout et les bascules au mur, et en concert : un pied sur un rebord, en alternant.",
  'knee-pain-in-rotation':
    "Tu as signalé une douleur dans le genou en position assise jambes croisées. Quand la hanche ne tourne pas assez, c'est le genou qui encaisse la torsion : les positions au sol qui tordent le genou (tailleur, papillon, 90/90) sont retirées de ton programme, la hanche se travaille autrement. Si la douleur dure plus de 2-3 semaines, ou si le genou gonfle, se bloque ou lâche, consulte un kiné ou un médecin du sport.",
  'patellofemoral-pain':
    "Tu as une douleur sous ou autour de la rotule à l'effort. Une gêne jusqu'à 3/10 pendant les exercices du genou est acceptable si elle reste stable et s'est calmée le lendemain matin : le player te demandera son intensité. Ton programme commence par des tenues isométriques, qui calment souvent la douleur. En course : raccourcis un peu tes pas (cadence +5 à 10 %) et reste sous ton seuil de douleur en allongeant les sorties progressivement.",
  'lateral-knee-pain':
    "Tu as une douleur sur l'extérieur du genou en course, typique d'une bandelette ilio-tibiale surmenée. Le levier principal est la hanche : ton programme inclut l'abduction couchée et l'élévation du bassin sur une marche. En course : cadence un peu plus élevée, et des sorties allongées progressivement, en t'arrêtant avant l'apparition de la douleur.",
};

export interface GoalReadiness {
  goal: Goal;
  /** 0-3 weighted readiness across the goal's factors. */
  readiness: number;
  /** Factors measured for this goal, sorted weakest first. */
  factors: { factor: FactorId; score: number; weight: number }[];
  /** true if the user has completed at least one of the goal's tests. */
  assessed: boolean;
  /** Plain-language synthesis, e.g. "Ton squat est surtout limité par tes chevilles." */
  synthesis: string;
}

export function computeGoalReadiness(
  goal: Goal,
  factorScores: Map<FactorId, FactorScore>,
  content: Content,
): GoalReadiness {
  const entries = Object.entries(goal.factors) as [FactorId, number][];
  let weightedSum = 0;
  let weightTotal = 0;
  let assessedAny = false;

  const factors = entries.map(([factor, weight]) => {
    const fs = factorScores.get(factor);
    const score = fs ? fs.score : 0;
    if (fs) {
      assessedAny = true;
      weightedSum += score * weight;
      weightTotal += weight;
    }
    return { factor, score, weight };
  });

  const readiness = weightTotal > 0 ? weightedSum / weightTotal : 0;
  factors.sort((a, b) => a.score - b.score);

  return {
    goal,
    readiness,
    factors,
    assessed: assessedAny,
    synthesis: buildSynthesis(goal, factors, factorScores, content, assessedAny),
  };
}

function buildSynthesis(
  goal: Goal,
  sortedFactors: { factor: FactorId; score: number; weight: number }[],
  factorScores: Map<FactorId, FactorScore>,
  content: Content,
  assessed: boolean,
): string {
  if (!assessed) {
    return "Fais le diagnostic de cet objectif pour découvrir ton facteur limitant.";
  }
  const measured = sortedFactors.filter((f) => factorScores.has(f.factor));
  if (measured.length === 0) {
    return "Fais le diagnostic de cet objectif pour découvrir ton facteur limitant.";
  }

  const weakest = measured[0];
  const factorName = t(content.factorById.get(weakest.factor)?.name).toLowerCase();
  const goalName = t(goal.name).toLowerCase();

  const strong = measured.filter((f) => f.score >= 2.3 && f.factor !== weakest.factor);
  const strongName =
    strong.length > 0 ? t(content.factorById.get(strong[0].factor)?.name).toLowerCase() : null;

  const asym = factorScores.get(weakest.factor)?.asymmetric;
  const asymSuffix = asym ? ' On note aussi une différence nette entre tes deux côtés.' : '';

  // Factor names carry no article ("mobilité de cheville"), so the sentences are
  // built around "côté …" / a colon rather than "ta …", which would not agree.
  if (weakest.score <= 1) {
    const contrast = strongName ? ` Côté ${strongName}, en revanche, ça va.` : '';
    return `Pour « ${goalName} », ton facteur limitant est nettement : ${factorName}.${contrast}${asymSuffix}`;
  }
  if (weakest.score < 2.3) {
    return `Pour « ${goalName} », c'est surtout côté ${factorName} que ça freine encore, mais tu n'es pas loin.${asymSuffix}`;
  }
  return `Pour « ${goalName} », tous tes facteurs sont fonctionnels : place à la pratique de la position elle-même.${asymSuffix}`;
}

/** Overall 0-3 across every measured factor (for the header dashboard). */
export function overallScore(factorScores: Map<FactorId, FactorScore>): number | null {
  if (factorScores.size === 0) return null;
  let sum = 0;
  for (const fs of factorScores.values()) sum += fs.score;
  return sum / factorScores.size;
}
