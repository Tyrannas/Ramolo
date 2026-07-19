import { Box, LinearProgress, Stack, Tooltip, Typography, Chip } from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useContent } from '../ContentContext';
import { t } from '../i18n';
import { SCORE_COLORS, SCORE_LABELS } from '../logic/scoring';
import type { FactorScore } from '../logic/profile';
import type { FactorId } from '../types';

function bucket(score: number): 0 | 1 | 2 | 3 {
  return Math.max(0, Math.min(3, Math.round(score))) as 0 | 1 | 2 | 3;
}

/**
 * A factor with no measurement renders explicitly as "non évalué" with an
 * empty, greyed bar — never as a full or "Bon" gauge, which would be a lie
 * (a missing score is not a good score).
 */
export function FactorGauge({ factor, fs }: { factor: FactorId; fs: FactorScore | null }) {
  const content = useContent();
  const def = content.factorById.get(factor);
  const measured = fs !== null;
  const b = measured ? bucket(fs.score) : 0;
  const pct = measured ? (fs.score / 3) * 100 : 0;

  return (
    <Box sx={{ opacity: measured ? 1 : 0.65 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {t(def?.name)}
        </Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {measured && fs.asymmetric && (
            <Tooltip title="Différence nette entre tes deux côtés">
              <CompareArrowsIcon sx={{ fontSize: 16, color: 'warning.main' }} />
            </Tooltip>
          )}
          {measured ? (
            <Typography variant="caption" sx={{ color: SCORE_COLORS[b], fontWeight: 700 }}>
              {SCORE_LABELS[b]}
            </Typography>
          ) : (
            <Tooltip title="Aucun test n’a encore mesuré ce facteur">
              <Stack direction="row" spacing={0.4} alignItems="center">
                <HelpOutlineIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700 }}>
                  Non évalué
                </Typography>
              </Stack>
            </Tooltip>
          )}
        </Stack>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 10,
          borderRadius: 999,
          bgcolor: 'rgba(32,48,42,0.08)',
          ...(measured
            ? { '& .MuiLinearProgress-bar': { bgcolor: SCORE_COLORS[b], borderRadius: 999 } }
            : {
                // Dashed outline reads as "empty on purpose", not "zero".
                border: '1px dashed rgba(32,48,42,0.25)',
                bgcolor: 'transparent',
                '& .MuiLinearProgress-bar': { bgcolor: 'transparent' },
              }),
        }}
      />
    </Box>
  );
}

export default function FactorGauges({
  scores,
  factorIds,
  emptyHint,
}: {
  scores: Map<FactorId, FactorScore>;
  /**
   * Factors in scope. Any of these without a score renders as "non évalué".
   * When omitted, only measured factors are shown.
   */
  factorIds?: FactorId[];
  emptyHint?: string;
}) {
  const ids = factorIds ?? [...scores.keys()];

  if (ids.length === 0) {
    return (
      <Chip
        label={emptyHint ?? 'Aucun facteur évalué pour l’instant'}
        variant="outlined"
        sx={{ borderStyle: 'dashed' }}
      />
    );
  }

  // Weakest measured first (that's the actionable end), unevaluated last.
  const rows = ids
    .map((id) => ({ id, fs: scores.get(id) ?? null }))
    .sort((a, b) => {
      if (a.fs && b.fs) return a.fs.score - b.fs.score;
      if (a.fs) return -1;
      if (b.fs) return 1;
      return 0;
    });

  return (
    <Stack spacing={1.75}>
      {rows.map(({ id, fs }) => (
        <FactorGauge key={id} factor={id} fs={fs} />
      ))}
    </Stack>
  );
}
