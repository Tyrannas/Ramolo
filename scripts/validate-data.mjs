#!/usr/bin/env node
// Validates the static content in public/data:
//  - shape of every record (required fields, types, allowed values)
//  - referential integrity across factors / goals / tests / exercises
//  - scoring bands cover the range without gaps
// Run with: npm run validate-data

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'public', 'data');

const errors = [];
const warnings = [];
const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

const read = (file) => JSON.parse(readFileSync(join(dataDir, file), 'utf8'));

const { factors } = read('factors.json');
const { goals } = read('goals.json');
const { tests } = read('tests.json');
const { exercises } = read('exercises.json');

const factorIds = new Set(factors.map((f) => f.id));
const goalIds = new Set(goals.map((g) => g.id));
const testIds = new Set(tests.map((t) => t.id));
const exerciseIds = new Set(exercises.map((e) => e.id));

const EXERCISE_TYPES = new Set(['stretch', 'strength', 'mobility-drill', 'test-retest']);
const MEASURE_KINDS = new Set(['level', 'cm', 'seconds']);
// Mirrors `TestFlag` in src/types.ts: a new flag needs app support before content can raise it.
const FLAGS = new Set([
  'limited-hip-internal-rotation',
  'responds-to-active-work',
  'anterior-hip-impingement',
  'seek-professional-advice',
  'habitual-lumbar-extension',
  'knee-pain-in-rotation',
  'patellofemoral-pain',
  'lateral-knee-pain',
]);

/** A localised string must at least carry French. */
const isL10n = (v) => v && typeof v === 'object' && typeof v.fr === 'string' && v.fr.length > 0;
const isL10nList = (v) => v && typeof v === 'object' && Array.isArray(v.fr);

const dupes = (ids, label) => {
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) err(`${label}: identifiant dupliqué « ${id} »`);
    seen.add(id);
  }
};
dupes(factors.map((f) => f.id), 'factors');
dupes(goals.map((g) => g.id), 'goals');
dupes(tests.map((t) => t.id), 'tests');
dupes(exercises.map((e) => e.id), 'exercises');

// --- factors ---------------------------------------------------------------
for (const f of factors) {
  if (!isL10n(f.name)) err(`factor ${f.id}: name.fr manquant`);
  if (!isL10n(f.description)) err(`factor ${f.id}: description.fr manquante`);
}

// --- goals -----------------------------------------------------------------
for (const g of goals) {
  if (!isL10n(g.name)) err(`goal ${g.id}: name.fr manquant`);
  if (!isL10n(g.tagline)) err(`goal ${g.id}: tagline.fr manquante`);
  if (!isL10nList(g.milestones)) err(`goal ${g.id}: milestones.fr manquants`);

  for (const testId of g.tests ?? []) {
    if (!testIds.has(testId)) err(`goal ${g.id}: test inconnu « ${testId} »`);
  }

  const weights = Object.entries(g.factors ?? {});
  if (weights.length === 0) err(`goal ${g.id}: aucun facteur pondéré`);
  let sum = 0;
  for (const [factorId, weight] of weights) {
    if (!factorIds.has(factorId)) err(`goal ${g.id}: facteur inconnu « ${factorId} »`);
    if (typeof weight !== 'number' || weight <= 0) {
      err(`goal ${g.id}: poids invalide pour « ${factorId} »`);
    }
    sum += weight;
  }
  if (Math.abs(sum - 1) > 0.001) {
    err(`goal ${g.id}: la somme des poids vaut ${sum.toFixed(3)} au lieu de 1`);
  }

  // Every weighted factor must be *scored* by at least one of the goal's tests: through the
  // test's primary factor or a follow-up factorScoreOverride. secondaryFactors never score.
  const covered = new Set();
  for (const testId of g.tests ?? []) {
    const test = tests.find((t) => t.id === testId);
    if (!test) continue;
    covered.add(test.factor);
    for (const o of test.followUp?.options ?? []) {
      if (o.factorScoreOverride) covered.add(o.factorScoreOverride.factor);
    }
  }
  for (const [factorId] of weights) {
    if (!covered.has(factorId)) {
      err(`goal ${g.id}: le facteur « ${factorId} » n'est noté par aucun de ses tests`);
    }
  }

  for (const p of g.prerequisites ?? []) {
    if (!goalIds.has(p.goalId)) err(`goal ${g.id}: prérequis vers un objectif inconnu « ${p.goalId} »`);
  }
}

// --- tests -----------------------------------------------------------------
for (const t of tests) {
  if (!isL10n(t.name)) err(`test ${t.id}: name.fr manquant`);
  if (!isL10nList(t.instructions)) err(`test ${t.id}: instructions.fr manquantes`);
  if (!factorIds.has(t.factor)) err(`test ${t.id}: facteur inconnu « ${t.factor} »`);
  for (const sf of t.secondaryFactors ?? []) {
    if (!factorIds.has(sf)) err(`test ${t.id}: facteur secondaire inconnu « ${sf} »`);
  }
  if (typeof t.perSide !== 'boolean') err(`test ${t.id}: perSide doit être un booléen`);

  if (t.followUp) {
    if (!isL10n(t.followUp.prompt)) err(`test ${t.id}: followUp.prompt.fr manquant`);
    const options = t.followUp.options ?? [];
    if (options.length < 2) err(`test ${t.id}: followUp doit proposer au moins 2 options`);
    dupes(options.map((o) => o.id), `test ${t.id} followUp`);
    for (const o of options) {
      if (!isL10n(o.label)) err(`test ${t.id}: option ${o.id} sans label.fr`);
      if (o.flag != null && !FLAGS.has(o.flag)) err(`test ${t.id}: option ${o.id}, flag inconnu « ${o.flag} »`);
      const ov = o.factorScoreOverride;
      if (ov) {
        if (!factorIds.has(ov.factor)) err(`test ${t.id}: option ${o.id}, facteur inconnu « ${ov.factor} »`);
        if (![0, 1, 2, 3].includes(ov.score)) err(`test ${t.id}: option ${o.id}, score doit être 0..3`);
      }
    }
  }

  const kind = t.measure?.kind;
  if (!MEASURE_KINDS.has(kind)) {
    err(`test ${t.id}: measure.kind invalide « ${kind} »`);
    continue;
  }

  if (kind === 'level') {
    const levels = t.measure.levels ?? [];
    const scores = levels.map((l) => l.score).sort((a, b) => a - b);
    if (JSON.stringify(scores) !== JSON.stringify([0, 1, 2, 3])) {
      err(`test ${t.id}: les paliers doivent couvrir exactement les scores 0,1,2,3 (reçu ${scores})`);
    }
    for (const l of levels) {
      if (!isL10n(l.label)) err(`test ${t.id}: palier ${l.score} sans label.fr`);
    }
    if (t.scoring) warn(`test ${t.id}: 'scoring' est ignoré pour une mesure de type 'level'`);
  } else {
    if (!isL10n(t.measure.prompt)) err(`test ${t.id}: measure.prompt.fr manquant`);
    const bands = t.scoring ?? [];
    if (bands.length === 0) {
      err(`test ${t.id}: mesure numérique sans bandes 'scoring'`);
    } else {
      const sorted = [...bands].sort((a, b) => a.min - b.min);
      if (sorted[0].min !== 0) err(`test ${t.id}: la première bande doit démarrer à 0`);
      if (sorted[sorted.length - 1].max !== undefined) {
        err(`test ${t.id}: la dernière bande doit être ouverte (pas de 'max')`);
      }
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].max !== sorted[i + 1].min) {
          err(
            `test ${t.id}: trou ou chevauchement entre les bandes ${sorted[i].max} et ${sorted[i + 1].min}`,
          );
        }
      }
      const scores = sorted.map((b) => b.score);
      if (new Set(scores).size !== scores.length) {
        err(`test ${t.id}: scores dupliqués dans les bandes`);
      }
    }
  }
}

// --- exercises -------------------------------------------------------------
for (const e of exercises) {
  if (!isL10n(e.name)) err(`exercise ${e.id}: name.fr manquant`);
  if (!isL10nList(e.instructions)) err(`exercise ${e.id}: instructions.fr manquantes`);
  if (!EXERCISE_TYPES.has(e.type)) err(`exercise ${e.id}: type invalide « ${e.type} »`);
  if (![0, 1, 2, 3].includes(e.level)) err(`exercise ${e.id}: level doit être 0..3`);

  if (!Array.isArray(e.targets) || e.targets.length === 0) {
    err(`exercise ${e.id}: aucun facteur ciblé`);
  }
  for (const target of e.targets ?? []) {
    if (!factorIds.has(target)) err(`exercise ${e.id}: facteur inconnu « ${target} »`);
  }
  for (const g of e.goals ?? []) {
    if (!goalIds.has(g)) err(`exercise ${e.id}: objectif inconnu « ${g} »`);
  }
  if (e.regressionOf && !exerciseIds.has(e.regressionOf)) {
    err(`exercise ${e.id}: regressionOf pointe vers un exercice inconnu « ${e.regressionOf} »`);
  }
  if (e.progressionOf && !exerciseIds.has(e.progressionOf)) {
    err(`exercise ${e.id}: progressionOf pointe vers un exercice inconnu « ${e.progressionOf} »`);
  }
  for (const f of e.avoidWithFlags ?? []) {
    if (!FLAGS.has(f)) err(`exercise ${e.id}: avoidWithFlags, flag inconnu « ${f} »`);
  }
  if (e.painMonitoring !== undefined && typeof e.painMonitoring !== 'boolean') {
    err(`exercise ${e.id}: painMonitoring doit être un booléen`);
  }
  if (e.progressionOf === e.id || e.regressionOf === e.id) {
    err(`exercise ${e.id}: référence circulaire sur lui-même`);
  }

  // Exactly one of the three dosage kinds, and all timing must be structured.
  const d = e.dosage ?? {};
  const kinds = ['reps', 'holdSeconds', 'cycles'].filter((k) => d[k] !== undefined);
  if (kinds.length === 0) {
    err(`exercise ${e.id}: dosage sans 'reps', 'holdSeconds' ni 'cycles'`);
  } else if (kinds.length > 1) {
    err(`exercise ${e.id}: dosage ambigu, types multiples (${kinds.join(' + ')})`);
  }
  if (d.cycles) {
    const c = d.cycles;
    if (typeof c.count !== 'number' || c.count < 1) {
      err(`exercise ${e.id}: cycles.count invalide`);
    }
    if (!Array.isArray(c.phases) || c.phases.length < 2) {
      err(`exercise ${e.id}: cycles.phases doit contenir au moins 2 phases`);
    } else {
      for (const p of c.phases) {
        if (!isL10n(p.label)) err(`exercise ${e.id}: une phase de cycle sans label.fr`);
        if (typeof p.seconds !== 'number' || p.seconds <= 0) {
          err(`exercise ${e.id}: une phase de cycle avec une durée invalide`);
        }
      }
    }
  }
  // Timing described only in a free-text note is exactly the bug this rule exists to catch.
  const noteText = e.dosage?.note?.fr ?? '';
  if (/\d+\s*(s|sec|secondes?)\b/i.test(noteText) && !d.cycles && !d.holdSeconds) {
    err(`exercise ${e.id}: la note mentionne un timing mais le dosage n'en porte aucun`);
  }
  if (!e.safetyNotes) warn(`exercise ${e.id}: pas de safetyNotes`);
  if (!e.expectedFeeling) warn(`exercise ${e.id}: pas de expectedFeeling`);
}

// --- regression chains -----------------------------------------------------
// Every exercise of level ≥ 2 must lead, regression after regression, down to a
// level-0 variant anyone can do. Same resolution as findRegression (generator.ts).
const exerciseById = new Map(exercises.map((e) => [e.id, e]));
const regressionOf = (e) =>
  (e.progressionOf && exerciseById.get(e.progressionOf)) ??
  exercises.find((x) => x.regressionOf === e.id) ??
  null;
for (const e of exercises) {
  if (e.level < 2) continue;
  const seen = new Set([e.id]);
  let cur = e;
  while (cur && cur.level > 0) {
    const next = regressionOf(cur);
    if (!next || seen.has(next.id)) break;
    seen.add(next.id);
    cur = next;
  }
  if (!cur || cur.level > 0) {
    err(`exercise ${e.id}: level ${e.level} sans chaîne de régression jusqu'au level 0`);
  }
}

// --- generator coverage ----------------------------------------------------
// Every factor a goal weights must have exercises available at each level the
// generator may request, otherwise sessions come out thin. The generator only
// draws from exercises tagged with an active goal, so `goals` counts here.
for (const g of goals) {
  for (const factorId of Object.keys(g.factors ?? {})) {
    const matching = exercises.filter(
      (e) => e.targets.includes(factorId) && e.goals.includes(g.id),
    );
    if (matching.length === 0) {
      err(`couverture: objectif ${g.id}, facteur ${factorId} — aucun exercice disponible`);
    } else if (!matching.some((e) => e.level <= 1)) {
      err(`couverture: objectif ${g.id}, facteur ${factorId} — aucun exercice débutant (level 0-1)`);
    } else if (matching.length < 2) {
      warn(
        `couverture: objectif ${g.id}, facteur ${factorId} — un seul exercice (${matching[0].id}), rotation impossible`,
      );
    }
  }
  const strength = exercises.filter((e) => e.goals.includes(g.id) && e.type === 'strength');
  if (strength.length === 0) {
    warn(`objectif ${g.id}: aucun exercice de renforcement (le générateur en impose un)`);
  }
}

// --- report ----------------------------------------------------------------
for (const w of warnings) console.warn(`  avertissement  ${w}`);
for (const e of errors) console.error(`  ERREUR         ${e}`);

console.log(
  `\n${factors.length} facteurs · ${goals.length} objectifs · ${tests.length} tests · ${exercises.length} exercices`,
);
console.log(`${errors.length} erreur(s), ${warnings.length} avertissement(s)`);

process.exit(errors.length > 0 ? 1 : 0);
