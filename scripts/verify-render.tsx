// Renders the real app in jsdom against a real (in-memory) IndexedDB and walks
// the first-run path. This is the test that would have caught the infinite
// loading bar: the app must reach onboarding, not sit on a progress indicator.
// Run: npm run verify-render
// Static (hoisted) so the fake IndexedDB is installed on globalThis before
// Dexie's module ever evaluates and captures its dependencies.
import 'fake-indexeddb/auto';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

// The app is served from '/' in dev and '/Ramolo/' on GitHub Pages. The whole
// suite runs against both, because a mismatched router basename renders a
// blank page in production while passing every test at the root.
const BASE = import.meta.env.BASE_URL;
const ORIGIN = 'http://localhost';
const at = (path: string) => `${BASE}${path.replace(/^\//, '')}`;
/** '/Ramolo' and '/Ramolo/' address the same page — compare them as equal. */
const samePath = (a: string, b: string) =>
  a.replace(/\/$/, '') === b.replace(/\/$/, '');

// --- Environment must exist before React/Dexie are imported ---------------
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: `${ORIGIN}${BASE}`,
  pretendToBeVisual: true,
});
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
// Node 24 exposes `navigator` as a getter-only global, so it needs redefining.
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});
g.HTMLElement = dom.window.HTMLElement;
g.Element = dom.window.Element;
g.Node = dom.window.Node;
g.getComputedStyle = dom.window.getComputedStyle;
g.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0);
g.cancelAnimationFrame = (id: number) => clearTimeout(id);
g.matchMedia =
  dom.window.matchMedia ??
  (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
dom.window.matchMedia = g.matchMedia as typeof dom.window.matchMedia;
g.IS_REACT_ACT_ENVIRONMENT = true;

// Serve /data/*.json from the real content files.
g.fetch = async (input: unknown) => {
  const url = String(input);
  const file = url.split('/data/')[1];
  if (!file) throw new Error(`unexpected fetch: ${url}`);
  const body = readFileSync(`public/data/${file}`, 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};

// Dexie resolves indexedDB off `window` when one exists, so mirror the fake
// onto the jsdom window too, not just globalThis.
dom.window.indexedDB = g.indexedDB as typeof dom.window.indexedDB;
dom.window.IDBKeyRange = g.IDBKeyRange as typeof dom.window.IDBKeyRange;

const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { BrowserRouter } = await import('react-router-dom');
const { ThemeProvider } = await import('@mui/material');
const { ContentProvider } = await import('../src/ContentContext');
const { theme } = await import('../src/theme');
const App = (await import('../src/App')).default;
const { routerBasename } = await import('../src/basename');
const { db, getPlan, savePlan } = await import('../src/db');

let failures = 0;
const check = (label: string, cond: boolean, detail = '') => {
  if (!cond) {
    failures++;
    console.error(`  FAIL  ${label} ${detail}`);
  } else {
    console.log(`  ok    ${label}`);
  }
};

const root = createRoot(document.getElementById('root')!);
const text = () => document.body.textContent ?? '';
const html = () => document.body.innerHTML;
const stuckOnLoader = () =>
  html().includes('MuiLinearProgress') && text().trim().length === 0;

/** Let effects, Dexie queries and router transitions settle. */
async function settle(ms = 120) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

const click = async (label: string | RegExp) => {
  const buttons = [...document.querySelectorAll('button')];
  const target = buttons.find((b) =>
    typeof label === 'string' ? b.textContent?.includes(label) : label.test(b.textContent ?? ''),
  );
  if (!target) throw new Error(`bouton introuvable : ${label}\nvus : ${buttons.map((b) => b.textContent).join(' | ')}`);
  await act(async () => {
    target.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
  });
};

const mount = async () => {
  await act(async () => {
    root.render(
      React.createElement(
        ThemeProvider,
        { theme },
        React.createElement(
          ContentProvider,
          null,
          React.createElement(
            BrowserRouter,
            { basename: routerBasename },
            React.createElement(App),
          ),
        ),
      ),
    );
    await new Promise((r) => setTimeout(r, 200));
  });
  // The mount settles in two waves: the content fetch resolves and mounts the
  // children, whose own Dexie live queries then resolve. Each wave needs its
  // own act() flush, so one settle() is not enough.
  await settle(250);
  await settle(250);
};

/**
 * Mode "--seeded": the DB already holds an onboarded plan before the very first
 * mount. This is what a browser reload actually looks like (fresh JS context,
 * populated IndexedDB) — the path where a loading sentinel that never resolves
 * would leave a returning user staring at a blank screen.
 */
async function seededRun() {
  console.log('\n[R] Rechargement : base déjà peuplée, contexte neuf');
  const now = new Date().toISOString();
  await savePlan({
    activeGoalIds: ['cross-legged', 'deep-squat'],
    onboardedAt: now,
    disclaimerAcceptedAt: now,
  });
  await db.assessments.bulkAdd([
    { testId: 'knee-to-wall', side: 'left', rawValue: 5, score: 1, date: now },
    { testId: 'knee-to-wall', side: 'right', rawValue: 5, score: 1, date: now },
  ]);
  check('plan présent avant le premier rendu', !!(await db.plan.get('current'))?.onboardedAt);
  check('aucune ligne settings (jamais créée)', (await db.settings.get('current')) === undefined);

  await mount();

  check(
    'pas de redirection vers l’onboarding',
    samePath(dom.window.location.pathname, at('')),
    `(base ${BASE} ; reçu ${dom.window.location.pathname})`,
  );
  check(
    'aucun indicateur de chargement bloqué',
    !document.querySelector('[role="progressbar"]'),
    `(texte : « ${text().slice(0, 160)} »)`,
  );
  check('l’accueil affiche la séance du jour', /Séance du jour/i.test(text()), `(vu : « ${text().slice(0, 160)} »)`);
  check('le diagnostic existant est pris en compte', !/Fais d’abord ton diagnostic/i.test(text()));

  // --- The 90/90 follow-up drives the internal-rotation gauge -------------
  console.log('\n[R2] Jauge « non évalué » et followUp');
  const goToDiagnostic = async () => {
    dom.window.history.pushState({}, '', at('diagnostic'));
    await act(async () => {
      dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
      await new Promise((r) => setTimeout(r, 120));
    });
    await settle(250);
  };
  await goToDiagnostic();

  check(
    'la rotation interne apparaît, non évaluée',
    /Rotation interne/i.test(text()) && /Non évalué/i.test(text()),
    `(vu : « ${text().slice(0, 200)} »)`,
  );
  check(
    'un facteur non mesuré n’est jamais annoncé « Bon »',
    !/Rotation interne de hanche\s*Bon/i.test(text()),
  );

  // Now answer the follow-up and confirm the gauge stops lying.
  await db.followUps.bulkAdd([
    { testId: 'test-90-90', side: 'left', optionId: 'rear-up', date: new Date().toISOString() },
    { testId: 'test-90-90', side: 'right', optionId: 'rear-up', date: new Date().toISOString() },
  ]);
  await settle(300);
  // Assert the gauge is actually rendered *with a score* — merely losing the
  // "non évalué" label would also be true if the factor vanished entirely.
  const internalRow = /Rotation interne de hanche\s*(Bloqué|Limité|Fonctionnel|Bon)/i.exec(text());
  check(
    'après réponse, la rotation interne affiche un vrai score',
    internalRow !== null,
    `(vu : « ${text().slice(0, 240)} »)`,
  );
  check(
    'et ce score est « Limité », pas « Bon »',
    internalRow?.[1] === 'Limité',
    `(reçu ${internalRow?.[1]})`,
  );
  check(
    'le flag rotation interne est expliqué à l’écran',
    /essuie-glaces/i.test(text()),
    `(vu : « ${text().slice(0, 240)} »)`,
  );

  console.log(
    failures === 0 ? '\nTous les contrôles passent.\n' : `\n${failures} contrôle(s) en échec.\n`,
  );
  process.exit(failures > 0 ? 1 : 0);
}

async function main() {
  if (process.argv.includes('--seeded')) return seededRun();

  // --- 1. First run must reach onboarding, not hang -----------------------
  console.log('\n[1] Premier lancement');
  check('la base est bien vide au départ', (await db.plan.get('current')) === undefined);

  await mount();

  check('l’app ne reste PAS bloquée sur la barre de chargement', !stuckOnLoader(), `(html: ${html().slice(0, 120)})`);
  check('quelque chose est rendu', text().trim().length > 0);
  check(
    'l’écran d’onboarding est affiché',
    /objectifs de mouvement concrets/i.test(text()),
    `(vu : « ${text().slice(0, 90)} »)`,
  );
  check(
    'l’URL a basculé sur onboarding',
    samePath(dom.window.location.pathname, at('onboarding')),
    `(base ${BASE} ; reçu ${dom.window.location.pathname})`,
  );

  // --- 2. Walk the onboarding ---------------------------------------------
  console.log('\n[2] Parcours d’onboarding');
  await click('Commencer');
  await settle();
  check('écran 2 : disclaimer santé', /ne remplace pas un avis médical/i.test(text()));
  check('« Continuer » est désactivé tant que la case n’est pas cochée', !!document.querySelector('button[disabled]'));

  const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
  check('la case à cocher existe', !!checkbox);
  await act(async () => {
    checkbox!.click();
    await new Promise((r) => setTimeout(r, 60));
  });

  await click('Continuer');
  await settle();
  check('écran 3 : choix des objectifs', /Que veux-tu débloquer/i.test(text()));
  check('les 3 objectifs du contenu sont proposés', /tailleur/i.test(text()) && /squat profond/i.test(text()));

  // Select a goal, then finish.
  const goalButton = [...document.querySelectorAll('button')].find((b) => /tailleur/i.test(b.textContent ?? ''));
  check('un objectif est cliquable', !!goalButton);
  await act(async () => {
    goalButton!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
  });

  await click(/C’est parti|C'est parti/);
  await settle(250);

  // --- 3. Landing on the home screen --------------------------------------
  console.log('\n[3] Accueil après onboarding');
  const plan = await getPlan();
  check('le plan est persisté', !!plan.onboardedAt, JSON.stringify(plan));
  check('l’objectif choisi est enregistré', plan.activeGoalIds.includes('cross-legged'), JSON.stringify(plan.activeGoalIds));
  check(
    'redirection vers l’accueil',
    samePath(dom.window.location.pathname, at('')),
    `(base ${BASE} ; reçu ${dom.window.location.pathname})`,
  );
  check('l’accueil ne reste PAS bloqué sur un loader', !stuckOnLoader(), `(html: ${html().slice(0, 120)})`);
  check('l’accueil affiche la séance du jour', /Séance du jour/i.test(text()), `(vu : « ${text().slice(0, 140)} »)`);
  check(
    'la séance propose des exercices',
    /exercices/i.test(text()) && /min/i.test(text()),
  );
  check('l’invitation au diagnostic est affichée', /diagnostic/i.test(text()));
  check('la navigation du bas est présente', /Aujourd|Exercices|Réglages/i.test(text()));

  console.log(
    failures === 0 ? '\nTous les contrôles passent.\n' : `\n${failures} contrôle(s) en échec.\n`,
  );
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
