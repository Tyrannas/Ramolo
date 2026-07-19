// Exercises the persistence layer against a real (in-memory) IndexedDB.
// Guards the first-run path in particular: a missing row must be
// distinguishable from "still loading", otherwise the app hangs on a loader.
// Run: npm run verify-db
import 'fake-indexeddb/auto';
import {
  db,
  getPlan,
  savePlan,
  getSettings,
  saveSettings,
  exportAll,
  importAll,
  clearAll,
  DEFAULT_PLAN,
  DEFAULT_SETTINGS,
} from '../src/db';

let failures = 0;
const check = (label: string, cond: boolean, detail = '') => {
  if (!cond) {
    failures++;
    console.error(`  FAIL  ${label} ${detail}`);
  } else {
    console.log(`  ok    ${label}`);
  }
};

async function main() {
  // --- 1. First run: the rows genuinely do not exist ----------------------
  console.log('\n[1] Premier lancement (base vide)');
  const rawPlan = await db.plan.get('current');
  const rawSettings = await db.settings.get('current');
  check('db.plan.get renvoie undefined si absent', rawPlan === undefined);
  check('db.settings.get renvoie undefined si absent', rawSettings === undefined);

  // This is the exact expression the UI uses. It must yield null, not
  // undefined — undefined is useLiveQuery's "loading" sentinel, and conflating
  // the two is what left the app stuck on an infinite loading bar.
  const gated = await db.plan.get('current').then((p) => p ?? null);
  check('l’expression du garde d’onboarding donne null, pas undefined', gated === null);
  check('null se distingue bien de la sentinelle de chargement', gated !== undefined);

  const settingsGated = await db.settings.get('current').then((s) => s ?? null);
  check('idem pour settings', settingsGated === null && settingsGated !== undefined);

  // --- 2. Defaults --------------------------------------------------------
  console.log('\n[2] Valeurs par défaut');
  const plan = await getPlan();
  check('getPlan retombe sur DEFAULT_PLAN', plan.id === 'current' && plan.activeGoalIds.length === 0);
  check('durée cible par défaut = 20 min', plan.targetMinutes === DEFAULT_PLAN.targetMinutes);
  const settings = await getSettings();
  check('getSettings retombe sur DEFAULT_SETTINGS', settings.locale === DEFAULT_SETTINGS.locale);
  check('aucun exercice masqué au départ', settings.hiddenExerciseIds.length === 0);

  // --- 3. Onboarding writes a real row ------------------------------------
  console.log('\n[3] Fin d’onboarding');
  const now = new Date().toISOString();
  await savePlan({ activeGoalIds: ['deep-squat'], onboardedAt: now, disclaimerAcceptedAt: now });
  const after = await db.plan.get('current');
  check('la ligne plan existe désormais', after !== undefined);
  check('onboardedAt est persisté', !!after?.onboardedAt);
  check('objectif actif persisté', after?.activeGoalIds[0] === 'deep-squat');
  check(
    'le garde laisse passer après onboarding',
    !!(await db.plan.get('current').then((p) => p ?? null))?.onboardedAt,
  );

  // savePlan must merge, not clobber.
  await savePlan({ targetMinutes: 30 });
  const merged = await getPlan();
  check('savePlan fusionne au lieu d’écraser', merged.activeGoalIds[0] === 'deep-squat' && merged.targetMinutes === 30);

  await saveSettings({ hiddenExerciseIds: ['plank'] });
  const s2 = await getSettings();
  check('saveSettings persiste et conserve le reste', s2.hiddenExerciseIds[0] === 'plank' && s2.locale === 'fr');

  // --- 4. Assessments & sessions -----------------------------------------
  console.log('\n[4] Données de suivi');
  await db.assessments.bulkAdd([
    { testId: 'knee-to-wall', side: 'left', rawValue: 8, score: 2, date: now },
    { testId: 'knee-to-wall', side: 'right', rawValue: 6, score: 1, date: now },
  ]);
  await db.sessions.add({
    date: now,
    goalIds: ['deep-squat'],
    exercises: [{ exerciseId: 'ankle-rocks', regressed: false, skipped: false }],
    painFlags: [],
    feeling: 4,
    durationMinutes: 18,
  });
  await db.followUps.bulkAdd([
    { testId: 'test-90-90', side: 'left', optionId: 'rear-up', date: now },
    { testId: 'knee-hug-supine-test', side: 'left', optionId: 'pinch-front', date: now },
  ]);
  check('2 assessments enregistrés', (await db.assessments.count()) === 2);
  check('2 réponses de followUp enregistrées', (await db.followUps.count()) === 2);
  check('1 séance enregistrée', (await db.sessions.count()) === 1);

  // --- 5. Export / import round-trip --------------------------------------
  console.log('\n[5] Export / import');
  const payload = await exportAll();
  check('payload marqué avec l’app et la version', payload.app === 'mobilite-souplesse' && payload.version === 2);
  check('export contient les assessments', payload.data.assessments.length === 2);
  check('export contient les followUps (sinon les flags seraient perdus)', payload.data.followUps?.length === 2);
  check('export contient le plan', payload.data.plan.activeGoalIds[0] === 'deep-squat');

  // Survives a JSON round-trip (that's how it travels as a file).
  const roundTripped = JSON.parse(JSON.stringify(payload));

  await clearAll();
  check(
    'clearAll vide bien la base',
    (await db.assessments.count()) === 0 &&
      (await db.sessions.count()) === 0 &&
      (await db.followUps.count()) === 0,
  );
  check('plan effacé aussi', (await db.plan.get('current')) === undefined);

  await importAll(roundTripped);
  check('import restaure les assessments', (await db.assessments.count()) === 2);
  check('import restaure les séances', (await db.sessions.count()) === 1);
  check('import restaure les followUps', (await db.followUps.count()) === 2);
  const restoredPlan = await getPlan();
  check('import restaure le plan', restoredPlan.activeGoalIds[0] === 'deep-squat' && restoredPlan.targetMinutes === 30);
  const restoredSettings = await getSettings();
  check('import restaure les réglages', restoredSettings.hiddenExerciseIds[0] === 'plank');

  // Import must be idempotent, not additive.
  await importAll(roundTripped);
  check(
    'réimporter ne duplique pas',
    (await db.assessments.count()) === 2 && (await db.followUps.count()) === 2,
  );

  // A v1 backup predates follow-ups; restoring it must not throw.
  const v1 = JSON.parse(JSON.stringify(roundTripped));
  v1.version = 1;
  delete v1.data.followUps;
  await importAll(v1);
  check('une sauvegarde v1 (sans followUps) se restaure sans erreur', (await db.assessments.count()) === 2);
  check('les followUps sont simplement vides après un import v1', (await db.followUps.count()) === 0);

  // --- 6. Import rejects junk ---------------------------------------------
  console.log('\n[6] Robustesse de l’import');
  let rejected = false;
  try {
    await importAll({ hello: 'world' } as never);
  } catch {
    rejected = true;
  }
  check('un fichier étranger est rejeté', rejected);
  check('les données sont intactes après un import refusé', (await db.assessments.count()) === 2);

  console.log(
    failures === 0 ? '\nTous les contrôles passent.\n' : `\n${failures} contrôle(s) en échec.\n`,
  );
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
