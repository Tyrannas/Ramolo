import { useLiveQuery } from 'dexie-react-hooks';
import { useContent } from '../ContentContext';
import {
  db,
  DEFAULT_PLAN,
  DEFAULT_SETTINGS,
  type Plan,
  type Settings,
  type Assessment,
  type SessionLog,
  type FollowUpAnswer,
} from '../db';
import { computeFactorScores, computeFlags } from '../logic/profile';
import { generateSession, type GeneratedSession } from '../logic/generator';
import { retestStatus, localDay, computeStreak, type RetestStatus } from '../logic/schedule';
import type { Goal, TestFlag } from '../types';

export interface TodayData {
  loading: boolean;
  plan: Plan;
  settings: Settings;
  assessments: Assessment[];
  sessions: SessionLog[];
  activeGoals: Goal[];
  followUps: FollowUpAnswer[];
  /** Qualitative flags raised by the latest follow-up answers. */
  flags: Set<TestFlag>;
  /** Whether at least one active goal has been assessed. */
  anyAssessed: boolean;
  session: GeneratedSession | null;
  retests: RetestStatus[];
  dueRetests: RetestStatus[];
  streak: number;
  doneToday: boolean;
  rotation: number;
}

export function useTodaySession(): TodayData {
  const content = useContent();
  // Map "row absent" to null: `get` resolving to undefined is indistinguishable
  // from useLiveQuery's still-loading sentinel, and the settings row in
  // particular only exists once the user changes something.
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], undefined);
  const settings = useLiveQuery(
    () => db.settings.get('current').then((s) => s ?? null),
    [],
    undefined,
  );
  const assessments = useLiveQuery(() => db.assessments.toArray(), [], undefined);
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], undefined);
  const followUps = useLiveQuery(() => db.followUps.toArray(), [], undefined);

  const loading =
    plan === undefined ||
    settings === undefined ||
    assessments === undefined ||
    sessions === undefined ||
    followUps === undefined;

  const resolvedPlan = plan ?? DEFAULT_PLAN;
  const resolvedSettings = settings ?? DEFAULT_SETTINGS;
  const resolvedAssessments = assessments ?? [];
  const resolvedSessions = sessions ?? [];
  const resolvedFollowUps = followUps ?? [];

  const activeGoals = resolvedPlan.activeGoalIds
    .map((id) => content.goalById.get(id))
    .filter((g): g is Goal => !!g);

  const factorScores = computeFactorScores(resolvedAssessments, content, resolvedFollowUps);
  const flags = computeFlags(resolvedFollowUps, content);
  const anyAssessed = activeGoals.some((g) => g.tests.some((tid) => resolvedAssessments.some((a) => a.testId === tid)));

  const rotation = resolvedSessions.length;

  const session =
    activeGoals.length > 0
      ? generateSession(
          {
            goals: activeGoals,
            factorScores,
            targetMinutes: resolvedPlan.targetMinutes,
            hiddenExerciseIds: new Set(resolvedSettings.hiddenExerciseIds),
            rotation,
            flags,
          },
          content,
        )
      : null;

  const retests = retestStatus(activeGoals, resolvedAssessments);
  const dueRetests = retests.filter((r) => r.due);
  const streak = computeStreak(resolvedSessions);
  const today = localDay();
  const doneToday = resolvedSessions.some((s) => localDay(s.date) === today);

  return {
    loading,
    plan: resolvedPlan,
    settings: resolvedSettings,
    assessments: resolvedAssessments,
    sessions: resolvedSessions,
    activeGoals,
    followUps: resolvedFollowUps,
    flags,
    anyAssessed,
    session,
    retests,
    dueRetests,
    streak,
    doneToday,
    rotation,
  };
}
