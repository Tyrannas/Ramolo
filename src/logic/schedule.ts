import type { Assessment, SessionLog } from '../db';
import type { Goal } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;
export const RETEST_INTERVAL_DAYS = 24; // ~3-4 weeks

export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
}

/** ISO date (yyyy-mm-dd) in local time. */
export function localDay(d: Date | string = new Date()): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Most recent assessment date for any of the goal's tests, or null. */
export function lastAssessmentForGoal(goal: Goal, assessments: Assessment[]): string | null {
  const relevant = assessments.filter((a) => goal.tests.includes(a.testId));
  if (relevant.length === 0) return null;
  return relevant.reduce((max, a) => (a.date > max ? a.date : max), relevant[0].date);
}

export interface RetestStatus {
  goal: Goal;
  assessed: boolean;
  lastDate: string | null;
  daysAgo: number | null;
  due: boolean;
}

export function retestStatus(goals: Goal[], assessments: Assessment[]): RetestStatus[] {
  return goals.map((goal) => {
    const lastDate = lastAssessmentForGoal(goal, assessments);
    const daysAgo = lastDate ? daysSince(lastDate) : null;
    return {
      goal,
      assessed: lastDate != null,
      lastDate,
      daysAgo,
      due: lastDate != null && daysAgo != null && daysAgo >= RETEST_INTERVAL_DAYS,
    };
  });
}

/** Count consecutive days (ending today or yesterday) with ≥1 logged session. */
export function computeStreak(sessions: SessionLog[]): number {
  if (sessions.length === 0) return 0;
  const days = new Set(sessions.map((s) => localDay(s.date)));
  let streak = 0;
  const cursor = new Date();
  // Allow the streak to still count if today has no session yet but yesterday does.
  if (!days.has(localDay(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(localDay(cursor))) return 0;
  }
  while (days.has(localDay(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
