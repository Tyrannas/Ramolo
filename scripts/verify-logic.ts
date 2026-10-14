// End-to-end exercise of the diagnostic → profile → session-generation pipeline
// against the real content in public/data. Run: npm run verify-logic
import { readFileSync } from 'node:fs';
import { computeFactorScores, computeFlags, computeGoalReadiness } from '../src/logic/profile';
import { generateSession, findRegression, estimateExerciseSeconds } from '../src/logic/generator';
import { scoreTest } from '../src/logic/scoring';
import { computeStreak, retestStatus } from '../src/logic/schedule';
import type { Content } from '../src/data/content';
import type { Assessment, FollowUpAnswer, SessionLog } from '../src/db';
import type { DiagnosticTest, Exercise, Factor, FactorId, Goal, Side, TestFlag } from '../src/types';

const read = (f: string) => JSON.parse(readFileSync(`public/data/${f}`, 'utf8'));
const factors: Factor[] = read('factors.json').factors;
const goals: Goal[] = read('goals.json').goals;
const tests: DiagnosticTest[] = read('tests.json').tests;
const exercises: Exercise[] = read('exercises.json').exercises;

const idx = <T extends { id: string }>(a: T[]) => new Map(a.map((x) => [x.id, x]));
const content = {
  factors,
  goals,
  tests,
  exercises,
  factorById: idx(factors),
  goalById: idx(goals),
  testById: idx(tests),
  exerciseById: idx(exercises),
} as unknown as Content;

let failures = 0;
const check = (label: string, cond: boolean, detail = '') => {
  if (!cond) {
    failures++;
    console.error(`  FAIL  ${label} ${detail}`);
  } else {
    console.log(`  ok    ${label}`);
  }
};

// --- 1. Scoring maps raw values to the documented bands --------------------
console.log('\n[1] Scoring');
const kneeToWall = content.testById.get('knee-to-wall')!;
check('knee-to-wall 2cm → 0 (bloqué)', scoreTest(kneeToWall, 2) === 0);
check('knee-to-wall 6cm → 1 (limité)', scoreTest(kneeToWall, 6) === 1);
check('knee-to-wall 9cm → 2 (fonctionnel)', scoreTest(kneeToWall, 9) === 2);
check('knee-to-wall 13cm → 3 (bon)', scoreTest(kneeToWall, 13) === 3);
check('knee-to-wall borne 11cm → 3', scoreTest(kneeToWall, 11) === 3);
const plank = content.testById.get('plank-hold')!;
check('plank 10s → 0', scoreTest(plank, 10) === 0);
check('plank 120s → 3', scoreTest(plank, 120) === 3);
// Inverted scale: fewer centimetres between fingertips and floor is better.
const fingertips = content.testById.get('fingertip-floor-distance')!;
check('doigts-sol 0 cm (touche le sol) → 3', scoreTest(fingertips, 0) === 3);
check('doigts-sol 12 cm → 1', scoreTest(fingertips, 12) === 1);
check('doigts-sol 30 cm → 0', scoreTest(fingertips, 30) === 0);
const levelTest = content.testById.get('wall-cross-legged')!;
check('mesure "level": la valeur EST le score', scoreTest(levelTest, 2) === 2);

// --- 2. The headline promise: "ankles, not hips" ---------------------------
console.log('\n[2] Diagnostic croisé du deep-squat');
const now = new Date().toISOString();
const mk = (testId: string, side: Side, raw: number): Assessment => ({
  testId,
  side,
  rawValue: raw,
  score: scoreTest(content.testById.get(testId)!, raw),
  date: now,
});

// Profile A: terrible ankles, good hips → the verdict must blame the ankles.
const ankleLimited: Assessment[] = [
  mk('knee-to-wall', 'left', 3),
  mk('knee-to-wall', 'right', 3),
  mk('heel-elevated-squat', 'both', 3), // much easier with heels raised
  mk('knee-hug-supine-test', 'left', 3),
  mk('knee-hug-supine-test', 'right', 3),
  mk('deep-squat-baseline', 'both', 1),
  mk('toe-touch-standing', 'both', 2),
];
const scoresA = computeFactorScores(ankleLimited, content);
const squatGoal = content.goalById.get('deep-squat')!;
const readinessA = computeGoalReadiness(squatGoal, scoresA, content);
console.log(`  synthèse: ${readinessA.synthesis}`);
check(
  'chevilles identifiées comme facteur limitant #1',
  readinessA.factors[0].factor === 'ankle-dorsiflexion',
  `(reçu ${readinessA.factors[0].factor})`,
);
check('la synthèse nomme la cheville', /cheville/i.test(readinessA.synthesis));

// Profile B: good ankles, poor hip flexion → the verdict must shift.
const hipLimited: Assessment[] = [
  mk('knee-to-wall', 'left', 14),
  mk('knee-to-wall', 'right', 14),
  mk('heel-elevated-squat', 'both', 0), // still impossible with heels raised
  mk('knee-hug-supine-test', 'left', 0),
  mk('knee-hug-supine-test', 'right', 0),
  mk('deep-squat-baseline', 'both', 1),
  mk('toe-touch-standing', 'both', 1),
];
const scoresB = computeFactorScores(hipLimited, content);
const readinessB = computeGoalReadiness(squatGoal, scoresB, content);
console.log(`  synthèse: ${readinessB.synthesis}`);
check(
  'profil B ne blâme PAS les chevilles',
  readinessB.factors[0].factor !== 'ankle-dorsiflexion',
  `(reçu ${readinessB.factors[0].factor})`,
);
check(
  'chevilles bien notées en profil B',
  (scoresB.get('ankle-dorsiflexion')?.score ?? 0) >= 2.5,
);

// --- 3. Asymmetry detection ------------------------------------------------
console.log('\n[3] Asymétrie');
const asym = computeFactorScores(
  [mk('knee-to-wall', 'left', 3), mk('knee-to-wall', 'right', 13)],
  content,
);
check('écart gauche/droite détecté', asym.get('ankle-dorsiflexion')!.asymmetric === true);
const sym = computeFactorScores(
  [mk('knee-to-wall', 'left', 12), mk('knee-to-wall', 'right', 13)],
  content,
);
check('pas de faux positif si les côtés sont proches', sym.get('ankle-dorsiflexion')!.asymmetric === false);

// --- 4. Session generation -------------------------------------------------
console.log('\n[4] Génération de séance');
for (const minutes of [10, 20, 30] as const) {
  const session = generateSession(
    {
      goals: [squatGoal],
      factorScores: scoresA,
      targetMinutes: minutes,
      hiddenExerciseIds: new Set(),
      rotation: 0,
    },
    content,
  );
  const mins = session.estimatedSeconds / 60;
  check(
    `séance ${minutes} min : non vide et dans le budget`,
    session.exercises.length > 0 && mins <= minutes,
    `(${session.exercises.length} exos, ${mins.toFixed(1)} min)`,
  );
  check(
    `séance ${minutes} min : au moins un renforcement`,
    session.exercises.some((e) => e.type === 'strength'),
  );
  check(
    `séance ${minutes} min : pas de doublon`,
    new Set(session.exercises.map((e) => e.id)).size === session.exercises.length,
  );
}

// The strength guarantee must hold for every goal, even in the shortest session,
// now that timed dosages (cycles) are budgeted at their real length.
for (const goal of content.goals) {
  const short = generateSession(
    { goals: [goal], factorScores: new Map(), targetMinutes: 10, hiddenExerciseIds: new Set(), rotation: 0 },
    content,
  );
  check(
    `${goal.id} en 10 min : au moins un renforcement, dans le budget`,
    short.exercises.some((e) => e.type === 'strength') && short.estimatedSeconds <= 600,
    `(${short.exercises.map((e) => e.id).join(', ')} · ${(short.estimatedSeconds / 60).toFixed(1)} min)`,
  );
}

// Weakest factor should receive attention.
const s20 = generateSession(
  { goals: [squatGoal], factorScores: scoresA, targetMinutes: 20, hiddenExerciseIds: new Set(), rotation: 0 },
  content,
);
check(
  'la séance cible bien le facteur le plus faible (cheville)',
  s20.exercises.some((e) => e.targets.includes('ankle-dorsiflexion')),
);
console.log(`  séance: ${s20.exercises.map((e) => e.id).join(', ')}`);

// Rotation must actually vary the selection.
const rotations = [0, 1, 2].map((r) =>
  generateSession(
    { goals: [squatGoal], factorScores: scoresA, targetMinutes: 20, hiddenExerciseIds: new Set(), rotation: r },
    content,
  ).exercises.map((e) => e.id).join(','),
);
check('la rotation change la séance', new Set(rotations).size > 1, `(${new Set(rotations).size} variantes)`);

// Variety: over twelve sessions, a goal must not loop through a handful of
// identical sessions, and the imposed strength exercise must rotate as well.
for (const goal of content.goals) {
  const twelve = Array.from({ length: 12 }, (_, r) =>
    generateSession(
      { goals: [goal], factorScores: new Map(), targetMinutes: 20, hiddenExerciseIds: new Set(), rotation: r },
      content,
    ).exercises,
  );
  const distinct = new Set(twelve.map((s) => s.map((e) => e.id).sort().join(','))).size;
  const strengths = new Set(twelve.flatMap((s) => s.filter((e) => e.type === 'strength').map((e) => e.id)));
  check(`${goal.id} : au moins 4 séances différentes sur 12`, distinct >= 4, `(${distinct})`);
  check(`${goal.id} : le renforcement varie d'une séance à l'autre`, strengths.size >= 2, `(${[...strengths].join(', ')})`);
}

// Every goal active at once: no factor may be starved, and the weakest factor
// must still be worked every single session.
{
  const weakAnkles = computeFactorScores([mk('knee-to-wall', 'left', 2), mk('knee-to-wall', 'right', 2)], content);
  const allGoals = Array.from({ length: 12 }, (_, r) =>
    generateSession(
      { goals: content.goals, factorScores: weakAnkles, targetMinutes: 20, hiddenExerciseIds: new Set(), rotation: r },
      content,
    ),
  );
  const weighted = [...new Set(content.goals.flatMap((g) => Object.keys(g.factors)))] as FactorId[];
  const starved = weighted.filter(
    (f) => allGoals.filter((s) => s.exercises.some((e) => e.targets.includes(f))).length < 2,
  );
  check('tous les objectifs actifs : chaque facteur revient au moins 2 fois sur 12 séances', starved.length === 0, `(${starved.join(', ')})`);
  check(
    'tous les objectifs actifs : le facteur le plus faible est travaillé à chaque séance',
    allGoals.every((s) => s.exercises.some((e) => e.targets.includes('ankle-dorsiflexion'))),
  );
  check(
    'tous les objectifs actifs : budget respecté',
    allGoals.every((s) => s.estimatedSeconds <= 20 * 60),
  );
}

// Level cap: a blocked factor must never receive advanced work, even through an
// exercise selected for a strong factor that also loads the weak one.
const adductorBlocked = computeFactorScores(
  [
    mk('wall-cross-legged', 'both', 3),
    mk('toe-touch-standing', 'both', 3),
    mk('test-90-90', 'left', 3),
    mk('test-90-90', 'right', 3),
    mk('butterfly-knee-height', 'both', 0),
    mk('standing-pelvic-tilt-control', 'both', 3),
  ],
  content,
);
const tooHard = Array.from({ length: 12 }, (_, r) =>
  generateSession(
    { goals: [content.goalById.get('cross-legged')!], factorScores: adductorBlocked, targetMinutes: 30, hiddenExerciseIds: new Set(), rotation: r },
    content,
  ).exercises,
)
  .flat()
  .filter((e) => e.targets.includes('adductors') && e.level > 1);
check(
  'adducteurs bloqués (score 0) → jamais d\'exercice d\'adducteurs au-delà du niveau 1',
  tooHard.length === 0,
  `(${[...new Set(tooHard.map((e) => `${e.id} L${e.level}`))].join(', ')})`,
);

// Hidden exercises must be excluded.
const hiddenId = s20.exercises[0].id;
const filtered = generateSession(
  {
    goals: [squatGoal],
    factorScores: scoresA,
    targetMinutes: 20,
    hiddenExerciseIds: new Set([hiddenId]),
    rotation: 0,
  },
  content,
);
check('un exercice masqué n’apparaît plus', !filtered.exercises.some((e) => e.id === hiddenId));

// Multi-goal sessions stay within budget.
const multi = generateSession(
  {
    goals: content.goals,
    factorScores: scoresA,
    targetMinutes: 20,
    hiddenExerciseIds: new Set(),
    rotation: 0,
  },
  content,
);
check(
  '3 objectifs simultanés : budget respecté',
  multi.estimatedSeconds / 60 <= 20,
  `(${(multi.estimatedSeconds / 60).toFixed(1)} min)`,
);

// Un-assessed user still gets a usable session.
const cold = generateSession(
  {
    goals: [content.goalById.get('cross-legged')!],
    factorScores: new Map(),
    targetMinutes: 20,
    hiddenExerciseIds: new Set(),
    rotation: 0,
  },
  content,
);
check('séance générée sans aucun diagnostic', cold.exercises.length >= 3, `(${cold.exercises.length} exos)`);

// --- 5. Regressions --------------------------------------------------------
console.log('\n[5] Régressions');
const plankEx = content.exerciseById.get('plank')!;
const plankReg = findRegression(plankEx, content);
check('planche → planche sur les genoux', plankReg?.id === 'plank-knees', `(reçu ${plankReg?.id})`);
const couch = content.exerciseById.get('couch-stretch')!;
const couchReg = findRegression(couch, content);
check(
  'couch stretch → psoas contracté-relâché → fente basse',
  couchReg?.id === 'hip-flexor-contract-relax' &&
    findRegression(couchReg, content)?.id === 'kneeling-hip-flexor-stretch',
  `(reçu ${couchReg?.id})`,
);
check('un exercice de base n’a pas de régression', findRegression(content.exerciseById.get('cat-cow')!, content) === null);

// Every exercise the generator can pick that is level ≥2 should offer a way down.
const noRegression = exercises.filter((e) => e.level >= 2 && !findRegression(e, content));
check(
  'tout exercice de niveau ≥2 a une régression',
  noRegression.length === 0,
  noRegression.length ? `(sans régression : ${noRegression.map((e) => e.id).join(', ')})` : '',
);

// --- 6. Dosage sanity ------------------------------------------------------
console.log('\n[6] Dosages');
const absurd = exercises.filter((e) => {
  const s = estimateExerciseSeconds(e);
  return s < 20 || s > 900;
});
check('aucun dosage absurde (<20 s ou >15 min)', absurd.length === 0, absurd.map((e) => `${e.id}=${estimateExerciseSeconds(e)}s`).join(', '));

// --- 7. Scheduling ---------------------------------------------------------
console.log('\n[7] Planification');
const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString();
};
const mkSession = (offset: number): SessionLog => ({
  date: day(offset),
  goalIds: ['deep-squat'],
  exercises: [],
  painFlags: [],
});
check('série de 3 jours consécutifs', computeStreak([mkSession(0), mkSession(1), mkSession(2)]) === 3);
check('série interrompue par un trou', computeStreak([mkSession(0), mkSession(3)]) === 1);
check('aucune séance → série 0', computeStreak([]) === 0);
check(
  'série conservée si hier compte mais pas aujourd’hui',
  computeStreak([mkSession(1), mkSession(2)]) === 2,
);

const oldAssessment: Assessment[] = [{ ...mk('knee-to-wall', 'left', 8), date: day(30) }];
const freshAssessment: Assessment[] = [{ ...mk('knee-to-wall', 'left', 8), date: day(2) }];
check('re-test dû après 30 jours', retestStatus([squatGoal], oldAssessment)[0].due === true);
check('pas de re-test après 2 jours', retestStatus([squatGoal], freshAssessment)[0].due === false);
check('pas de re-test si jamais évalué', retestStatus([squatGoal], [])[0].due === false);

// --- 8. Latest-wins semantics ---------------------------------------------
console.log('\n[8] Historique');
const progression = computeFactorScores(
  [
    { ...mk('knee-to-wall', 'left', 2), date: day(60) },
    { ...mk('knee-to-wall', 'left', 13), date: day(1) },
  ],
  content,
);
check(
  'seule la mesure la plus récente compte',
  progression.get('ankle-dorsiflexion')!.score === 3,
  `(reçu ${progression.get('ankle-dorsiflexion')!.score})`,
);

// --- 9. Dosage en cycles ---------------------------------------------------
console.log('\n[9] Dosage en cycles');
const butterfly = content.exerciseById.get('butterfly-wall')!;
check('butterfly-wall utilise bien des cycles', !!butterfly.dosage.cycles);
const cyc = butterfly.dosage.cycles!;
const expectedCycleSeconds =
  (cyc.count * cyc.phases.reduce((s, p) => s + p.seconds, 0) + 15) * (butterfly.dosage.sets ?? 1);
check(
  'la durée des cycles est budgétée correctement',
  estimateExerciseSeconds(butterfly) === expectedCycleSeconds,
  `(reçu ${estimateExerciseSeconds(butterfly)}, attendu ${expectedCycleSeconds})`,
);
check(
  'un dosage en cycles n’est jamais confondu avec une tenue',
  butterfly.dosage.holdSeconds === undefined && butterfly.dosage.reps === undefined,
);
check(
  'toutes les phases ont un label et une durée',
  cyc.phases.every((p) => p.label?.fr && p.seconds > 0),
);
// Exactly one dosage kind per exercise, everywhere.
const ambiguous = exercises.filter(
  (e) => ['reps', 'holdSeconds', 'cycles'].filter((k) => (e.dosage as never)[k] !== undefined).length !== 1,
);
check('chaque exercice a exactement un type de dosage', ambiguous.length === 0, ambiguous.map((e) => e.id).join(', '));

// --- 10. followUp : overrides et flags -------------------------------------
console.log('\n[10] followUp, overrides et flags');
const fu = (testId: string, side: Side, optionId: string): FollowUpAnswer => ({
  testId,
  side,
  optionId,
  date: now,
});

// secondaryFactors must never score on their own.
const secondaryOnly = computeFactorScores([mk('deep-squat-baseline', 'both', 1)], content);
check(
  'un facteur seulement secondaire n’est PAS noté',
  !secondaryOnly.has('ankle-dorsiflexion'),
  `(deep-squat-baseline a ankle-dorsiflexion en secondaire ; reçu ${[...secondaryOnly.keys()].join(',')})`,
);
check('le facteur principal est noté', secondaryOnly.has('balance-control'));

// The 90/90 rear-glute answer is the ONLY source for internal hip rotation.
const noOverride = computeFactorScores([mk('test-90-90', 'left', 2), mk('test-90-90', 'right', 2)], content);
check(
  'sans followUp, la rotation interne reste NON ÉVALUÉE',
  !noOverride.has('hip-internal-rotation'),
);
const withOverride = computeFactorScores(
  [mk('test-90-90', 'left', 2), mk('test-90-90', 'right', 2)],
  content,
  [fu('test-90-90', 'left', 'rear-up'), fu('test-90-90', 'right', 'rear-up')],
);
check(
  'avec followUp « fesse en l’air », la rotation interne est notée 1',
  withOverride.get('hip-internal-rotation')?.score === 1,
  `(reçu ${withOverride.get('hip-internal-rotation')?.score})`,
);
check(
  'la rotation externe reste notée par les paliers',
  withOverride.get('hip-external-rotation')?.score === 2,
);
// Asymmetry must be detected on overrides too.
const asymOverride = computeFactorScores(
  [mk('test-90-90', 'left', 2), mk('test-90-90', 'right', 2)],
  content,
  [fu('test-90-90', 'left', 'rear-down'), fu('test-90-90', 'right', 'rear-up')],
);
check(
  'asymétrie détectée sur un override',
  asymOverride.get('hip-internal-rotation')?.asymmetric === true,
);

const flagsRaised = computeFlags(
  [fu('test-90-90', 'left', 'rear-up'), fu('knee-hug-supine-test', 'left', 'pinch-front')],
  content,
);
check('flag limited-hip-internal-rotation levé', flagsRaised.has('limited-hip-internal-rotation'));
check('flag anterior-hip-impingement levé', flagsRaised.has('anterior-hip-impingement'));
check('aucun flag parasite', flagsRaised.size === 2);
check(
  'flag seek-professional-advice sur douleur franche',
  computeFlags([fu('knee-hug-supine-test', 'left', 'pain-front')], content).has(
    'seek-professional-advice',
  ),
);
check(
  'une option sans flag n’en lève aucun',
  computeFlags([fu('knee-hug-supine-test', 'left', 'stretch-back')], content).size === 0,
);
// Only the latest answer counts.
const older = { ...fu('knee-hug-supine-test', 'left', 'pain-front'), date: day(40) };
const newer = { ...fu('knee-hug-supine-test', 'left', 'stretch-back'), date: day(1) };
check(
  'seule la réponse la plus récente compte',
  computeFlags([older, newer], content).size === 0,
);

// --- 11. Effets des flags sur le générateur --------------------------------
console.log('\n[11] Effets des flags sur la séance');
const crossLegged = content.goalById.get('cross-legged')!;
const baseOpts = {
  goals: [crossLegged],
  factorScores: computeFactorScores([], content),
  targetMinutes: 20,
  hiddenExerciseIds: new Set<string>(),
  rotation: 0,
};
const noFlagSession = generateSession(baseOpts, content);
check(
  'sans flag, les essuie-glaces ne sont pas proposés',
  !noFlagSession.exercises.some((e) => e.id === 'hip-windshield-wipers'),
  '(aucun objectif ne pondère la rotation interne)',
);
const wiperSession = generateSession(
  { ...baseOpts, flags: new Set<TestFlag>(['limited-hip-internal-rotation']) },
  content,
);
check(
  'flag rotation interne → essuie-glaces inclus',
  wiperSession.exercises.some((e) => e.id === 'hip-windshield-wipers'),
);
const squatGoalForFlags = content.goalById.get('deep-squat')!;
const impingementSession = generateSession(
  {
    ...baseOpts,
    goals: [squatGoalForFlags],
    flags: new Set<TestFlag>(['anterior-hip-impingement']),
  },
  content,
);
check(
  'flag pincement → flexion de hanche assise incluse',
  impingementSession.exercises.some((e) => e.id === 'seated-active-hip-flexion'),
);
check(
  'les exercices de squat portent une consigne adaptée au pincement',
  impingementSession.exercises
    .filter((e) => ['assisted-squat-hold', 'elevated-heel-squat', 'free-squat-hold', 'goblet-squat-pause'].includes(e.id))
    .every((e) => !!e.impingementFriendlySetup),
);
// Active work preference: cycles must outrank passive holds.
const activeSession = generateSession(
  { ...baseOpts, flags: new Set<TestFlag>(['responds-to-active-work']) },
  content,
);
const cyclesIdx = activeSession.exercises.findIndex((e) => !!e.dosage.cycles);
check(
  'flag travail actif → un exercice en cycles est retenu',
  cyclesIdx >= 0,
  `(séance : ${activeSession.exercises.map((e) => e.id).join(', ')})`,
);
// Real profile: good on every capacity test, yet barely an hour standing still,
// with an arched default posture. The diagnosis must not call that "all fine".
const standingGoal = content.goalById.get('long-standing')!;
const staticLimited = computeFactorScores(
  [
    mk('standing-tolerance', 'both', 1),
    mk('thomas-test', 'left', 3),
    mk('thomas-test', 'right', 3),
    mk('plank-hold', 'both', 100),
    mk('single-leg-bridge-hold', 'left', 35),
    mk('single-leg-bridge-hold', 'right', 35),
    mk('side-lying-hip-abduction-test', 'left', 3),
    mk('side-lying-hip-abduction-test', 'right', 3),
    mk('standing-pelvic-tilt-control', 'both', 3),
  ],
  content,
);
const staticReadiness = computeGoalReadiness(standingGoal, staticLimited, content);
console.log(`  synthèse: ${staticReadiness.synthesis}`);
check(
  'bons tests mais tolérance debout faible → la tolérance statique est le facteur limitant',
  staticReadiness.factors[0].factor === 'standing-endurance',
);
const archedSession = generateSession(
  {
    ...baseOpts,
    goals: [standingGoal],
    factorScores: staticLimited,
    flags: new Set<TestFlag>(['habitual-lumbar-extension']),
  },
  content,
);
check(
  'flag cambrure par défaut → bascule au mur et reset debout inclus',
  ['wall-posterior-tilt-hold', 'standing-reset'].every((id) => archedSession.exercises.some((e) => e.id === id)),
  `(séance : ${archedSession.exercises.map((e) => e.id).join(', ')})`,
);
check(
  'la séance reste majoritairement active/renfo, pas que des étirements',
  archedSession.exercises.filter((e) => e.type === 'stretch').length <= archedSession.exercises.length / 3,
);

// Knee pain in cross-legged positions: knee-twisting floor positions must vanish,
// and hip work must go on through knee-friendly exercises.
const kneeSafeSession = generateSession(
  { ...baseOpts, flags: new Set<TestFlag>(['knee-pain-in-rotation']) },
  content,
);
check(
  'flag genou en rotation → aucune position au sol qui tord le genou',
  kneeSafeSession.exercises.length > 0 &&
    !kneeSafeSession.exercises.some((e) => e.avoidWithFlags?.includes('knee-pain-in-rotation')),
  `(séance : ${kneeSafeSession.exercises.map((e) => e.id).join(', ')})`,
);
check(
  'flag genou en rotation → la rotation externe de hanche reste travaillée',
  kneeSafeSession.exercises.some((e) => e.targets.includes('hip-external-rotation')),
);
for (const flag of ['limited-hip-internal-rotation', 'anterior-hip-impingement'] as TestFlag[]) {
  const s = generateSession(
    { ...baseOpts, goals: content.goals, flags: new Set<TestFlag>(['knee-pain-in-rotation', flag]) },
    content,
  );
  check(
    `un exercice imposé par [${flag}] ne contourne pas l'exclusion du genou`,
    !s.exercises.some((e) => e.avoidWithFlags?.includes('knee-pain-in-rotation')),
  );
}

// Real knee profile: front-of-kneecap pain on one side, outer-knee pain on the other.
const kneeGoal = content.goalById.get('resilient-knees')!;
const kneeSession = generateSession(
  {
    ...baseOpts,
    goals: [kneeGoal],
    flags: new Set<TestFlag>(['patellofemoral-pain', 'lateral-knee-pain']),
  },
  content,
);
check(
  'rotulien + bandelette → isométriques et travail de hanche au programme',
  ['straight-leg-raise', 'wall-sit', 'side-lying-hip-abduction'].every((id) =>
    kneeSession.exercises.some((e) => e.id === id),
  ),
  `(séance : ${kneeSession.exercises.map((e) => e.id).join(', ')})`,
);
check(
  'objectif genou : séance majoritairement en renforcement',
  kneeSession.exercises.filter((e) => e.type === 'strength').length > kneeSession.exercises.length / 2,
);
check(
  'tout renfo du quadriceps de l\'objectif genou suit la règle de douleur 0-10',
  content.exercises
    .filter((e) => e.goals.includes('resilient-knees') && e.targets.includes('quadriceps-strength'))
    .every((e) => e.painMonitoring === true),
);

// Budget must still hold with flags forcing extra exercises in.
for (const flagSet of [
  ['limited-hip-internal-rotation'],
  ['anterior-hip-impingement'],
  ['responds-to-active-work'],
  ['habitual-lumbar-extension'],
  ['limited-hip-internal-rotation', 'anterior-hip-impingement', 'responds-to-active-work', 'habitual-lumbar-extension'],
] as TestFlag[][]) {
  const s = generateSession(
    { ...baseOpts, goals: content.goals, flags: new Set(flagSet) },
    content,
  );
  check(
    `budget respecté avec [${flagSet.join('+')}]`,
    s.estimatedSeconds / 60 <= 20,
    `(${(s.estimatedSeconds / 60).toFixed(1)} min)`,
  );
}

// --- 12. Couverture : chaque pondération a une source de score -------------
console.log('\n[12] Matrice facteur × objectif');
for (const goal of content.goals) {
  for (const factor of Object.keys(goal.factors) as FactorId[]) {
    const sources = goal.tests.filter((testId) => {
      const test = content.testById.get(testId);
      if (!test) return false;
      if (test.factor === factor) return true;
      return (test.followUp?.options ?? []).some((o) => o.factorScoreOverride?.factor === factor);
    });
    check(`${goal.id} / ${factor} a une source de score`, sources.length > 0);
  }
}

console.log(
  failures === 0
    ? '\nTous les contrôles passent.\n'
    : `\n${failures} contrôle(s) en échec.\n`,
);
process.exit(failures > 0 ? 1 : 0);
