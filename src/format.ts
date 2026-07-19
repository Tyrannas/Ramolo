import type { Dosage, Exercise, ExerciseType } from './types';
import { t } from './i18n';

const base = import.meta.env.BASE_URL;

/** Human-readable dosage line, e.g. "3 × 45 s par côté" or "2 × 12 reps". */
export function formatDosage(d: Dosage): string {
  const parts: string[] = [];
  const sets = d.sets ?? 1;
  if (d.cycles) {
    const phases = d.cycles.phases.map((p) => `${p.seconds} s`).join(' + ');
    parts.push(`${sets} × ${d.cycles.count} cycles [${phases}]`);
  } else if (d.holdSeconds) {
    parts.push(`${sets} × ${d.holdSeconds} s`);
  } else if (d.reps) {
    parts.push(`${sets} × ${d.reps} rép.`);
  } else {
    parts.push(`${sets} série${sets > 1 ? 's' : ''}`);
  }
  if (d.perSide) parts.push('par côté');
  return parts.join(' · ');
}

export const TYPE_LABELS: Record<ExerciseType, string> = {
  stretch: 'Étirement',
  strength: 'Renforcement',
  'mobility-drill': 'Mobilité',
  'test-retest': 'Test',
};

export const LEVEL_LABELS: Record<number, string> = {
  0: 'Débutant',
  1: 'Facile',
  2: 'Intermédiaire',
  3: 'Avancé',
};

/**
 * Preferred illustration: a local image when present (works offline), else an
 * externally hosted public-domain one (needs the network).
 */
export function firstImageUrl(ex: { images: string[]; remoteImages?: string[] }): string | null {
  if (ex.images && ex.images.length > 0) return `${base}data/images/${ex.images[0]}`;
  if (ex.remoteImages && ex.remoteImages.length > 0) return ex.remoteImages[0];
  return null;
}

/** A YouTube search URL from the exercise's curated search query. */
export function videoSearchUrl(item: { videoUrl: string | null; videoQuery?: string; name: { fr: string } }): string | null {
  if (item.videoUrl) return item.videoUrl;
  const q = item.videoQuery ?? t(item.name);
  if (!q) return null;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

export function equipmentLabel(ex: Exercise): string | null {
  const e = t(ex.equipment);
  return e && e.toLowerCase() !== 'aucun' ? e : null;
}
