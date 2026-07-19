import Dexie, { type Table } from 'dexie';
import type { Score, Side } from './types';

// ---------------------------------------------------------------------------
// Local-first persistence (IndexedDB via Dexie). No account, no network:
// every record below never leaves the device. Export/import is the only backup.
// ---------------------------------------------------------------------------

/** One recorded result of a diagnostic test, for one side, at one date. */
export interface Assessment {
  id?: number;
  testId: string;
  side: Side;
  /** Raw value entered by the user (cm, seconds, or the chosen level score). */
  rawValue: number;
  /** Derived 0-3 score. */
  score: Score;
  /** ISO timestamp. */
  date: string;
}

/**
 * The answer to a test's qualitative follow-up question. Stored separately
 * from the measurement because it feeds different things: a flag that steers
 * the program, and/or a `factorScoreOverride` that scores another factor.
 */
export interface FollowUpAnswer {
  id?: number;
  testId: string;
  side: Side;
  optionId: string;
  date: string;
}

/** Which exercise was done in a session, and how it felt. */
export interface SessionExercise {
  exerciseId: string;
  /** true if the user tapped "trop dur → régression" and swapped it out. */
  regressed: boolean;
  skipped: boolean;
}

export interface SessionLog {
  id?: number;
  date: string;
  goalIds: string[];
  exercises: SessionExercise[];
  /** Global feeling 1-5 at the end of the session. */
  feeling?: number;
  /** Free list of exercise ids where the user flagged pain. */
  painFlags: string[];
  durationMinutes?: number;
  /** true when this was an auto-injected re-test session. */
  isRetest?: boolean;
}

/** The user's training plan / preferences (single row, id = 'current'). */
export interface Plan {
  id: string; // always 'current'
  activeGoalIds: string[];
  daysPerWeek: number;
  targetMinutes: 10 | 20 | 30;
  /** ISO date the onboarding was completed; undefined ⇒ not onboarded. */
  onboardedAt?: string;
  /** Health disclaimer acknowledged. */
  disclaimerAcceptedAt?: string;
}

export interface Settings {
  id: string; // always 'current'
  locale: 'fr' | 'en';
  units: 'metric';
  remindersEnabled: boolean;
  /** Exercise ids the user permanently hid after recurring pain. */
  hiddenExerciseIds: string[];
}

export interface DbMeta {
  key: string;
  value: unknown;
}

export class MobilityDb extends Dexie {
  assessments!: Table<Assessment, number>;
  followUps!: Table<FollowUpAnswer, number>;
  sessions!: Table<SessionLog, number>;
  plan!: Table<Plan, string>;
  settings!: Table<Settings, string>;
  meta!: Table<DbMeta, string>;

  constructor() {
    super('mobility-db');
    this.version(1).stores({
      assessments: '++id, testId, side, date',
      sessions: '++id, date',
      plan: 'id',
      settings: 'id',
      meta: 'key',
    });
    // v2 adds qualitative follow-up answers. Dexie migrates existing data in
    // place; the new table simply starts empty for returning users.
    this.version(2).stores({
      followUps: '++id, testId, side, date',
    });
  }
}

export const db = new MobilityDb();

export const DEFAULT_PLAN: Plan = {
  id: 'current',
  activeGoalIds: [],
  daysPerWeek: 3,
  targetMinutes: 20,
};

export const DEFAULT_SETTINGS: Settings = {
  id: 'current',
  locale: 'fr',
  units: 'metric',
  remindersEnabled: false,
  hiddenExerciseIds: [],
};

export async function getPlan(): Promise<Plan> {
  return (await db.plan.get('current')) ?? DEFAULT_PLAN;
}

export async function savePlan(patch: Partial<Plan>): Promise<void> {
  const current = await getPlan();
  await db.plan.put({ ...current, ...patch, id: 'current' });
}

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('current')) ?? DEFAULT_SETTINGS;
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: 'current' });
}

// --- Export / import -------------------------------------------------------

export interface ExportPayload {
  app: 'mobilite-souplesse';
  version: 1 | 2;
  exportedAt: string;
  data: {
    assessments: Assessment[];
    /** Absent in v1 backups. */
    followUps?: FollowUpAnswer[];
    sessions: SessionLog[];
    plan: Plan;
    settings: Settings;
  };
}

export async function exportAll(): Promise<ExportPayload> {
  const [assessments, followUps, sessions, plan, settings] = await Promise.all([
    db.assessments.toArray(),
    db.followUps.toArray(),
    db.sessions.toArray(),
    getPlan(),
    getSettings(),
  ]);
  return {
    app: 'mobilite-souplesse',
    version: 2,
    exportedAt: new Date().toISOString(),
    data: { assessments, followUps, sessions, plan, settings },
  };
}

export async function importAll(payload: ExportPayload): Promise<void> {
  if (payload?.app !== 'mobilite-souplesse') {
    throw new Error("Fichier non reconnu : ce n'est pas une sauvegarde de l'application.");
  }
  const { assessments, followUps, sessions, plan, settings } = payload.data;
  await db.transaction(
    'rw',
    db.assessments,
    db.followUps,
    db.sessions,
    db.plan,
    db.settings,
    async () => {
      await Promise.all([db.assessments.clear(), db.followUps.clear(), db.sessions.clear()]);
      // Strip primary keys so Dexie re-assigns them cleanly.
      await db.assessments.bulkAdd(assessments.map(({ id: _id, ...a }) => a));
      // v1 backups predate follow-ups; restoring one simply leaves them empty.
      await db.followUps.bulkAdd((followUps ?? []).map(({ id: _id, ...f }) => f));
      await db.sessions.bulkAdd(sessions.map(({ id: _id, ...s }) => s));
      await db.plan.put({ ...plan, id: 'current' });
      await db.settings.put({ ...settings, id: 'current' });
    },
  );
}

export async function clearAll(): Promise<void> {
  await db.transaction(
    'rw',
    [db.assessments, db.followUps, db.sessions, db.plan, db.settings, db.meta],
    async () => {
      await Promise.all([
        db.assessments.clear(),
        db.followUps.clear(),
        db.sessions.clear(),
        db.plan.clear(),
        db.settings.clear(),
        db.meta.clear(),
      ]);
    },
  );
}
