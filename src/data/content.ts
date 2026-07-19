import type {
  ContentBundle,
  Exercise,
  Factor,
  Goal,
  DiagnosticTest,
  FactorId,
} from '../types';

// The static content lives in /public/data and is fetched once at startup.
// It is precached by the service worker so the app works fully offline.

const base = import.meta.env.BASE_URL;

let bundle: ContentBundle | null = null;

async function fetchJson<T>(file: string): Promise<T> {
  const res = await fetch(`${base}data/${file}`);
  if (!res.ok) throw new Error(`Impossible de charger ${file} (${res.status})`);
  return res.json() as Promise<T>;
}

export async function loadContent(): Promise<ContentBundle> {
  if (bundle) return bundle;
  const [factors, goals, tests, exercises] = await Promise.all([
    fetchJson<{ factors: Factor[] }>('factors.json'),
    fetchJson<{ goals: Goal[] }>('goals.json'),
    fetchJson<{ tests: DiagnosticTest[] }>('tests.json'),
    fetchJson<{ exercises: Exercise[] }>('exercises.json'),
  ]);
  bundle = {
    factors: factors.factors,
    goals: [...goals.goals].sort((a, b) => a.priority - b.priority),
    tests: tests.tests,
    exercises: exercises.exercises,
  };
  return bundle;
}

// --- Convenience index helpers (used with an already-loaded bundle) --------

export function indexBy<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((it) => [it.id, it]));
}

export class Content {
  readonly factors: Factor[];
  readonly goals: Goal[];
  readonly tests: DiagnosticTest[];
  readonly exercises: Exercise[];
  readonly factorById: Map<FactorId, Factor>;
  readonly goalById: Map<string, Goal>;
  readonly testById: Map<string, DiagnosticTest>;
  readonly exerciseById: Map<string, Exercise>;

  constructor(b: ContentBundle) {
    this.factors = b.factors;
    this.goals = b.goals;
    this.tests = b.tests;
    this.exercises = b.exercises;
    this.factorById = new Map(b.factors.map((f) => [f.id, f]));
    this.goalById = indexBy(b.goals);
    this.testById = indexBy(b.tests);
    this.exerciseById = indexBy(b.exercises);
  }
}
