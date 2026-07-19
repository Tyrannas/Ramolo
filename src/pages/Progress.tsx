import { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../components/PageHeader';
import FactorGauges from '../components/FactorGauges';
import ConsistencyCalendar from '../components/ConsistencyCalendar';
import { useContent } from '../ContentContext';
import { db } from '../db';
import { t } from '../i18n';
import { computeFactorScores } from '../logic/profile';
import { computeStreak } from '../logic/schedule';
import { SCORE_LABELS } from '../logic/scoring';
import type { Side } from '../types';

const SIDE_LABEL: Record<Side, string> = { left: 'gauche', right: 'droit', both: '' };

export default function Progress() {
  const content = useContent();
  const assessments = useLiveQuery(() => db.assessments.toArray(), [], []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], []);
  const followUps = useLiveQuery(() => db.followUps.toArray(), [], []);

  // Which tests have at least one measurement, for the chart selector.
  const testedIds = useMemo(() => {
    const ids = new Set(assessments.map((a) => a.testId));
    return content.tests.filter((t) => ids.has(t.id));
  }, [assessments, content]);

  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const activeTestId = selectedTestId || testedIds[0]?.id || '';
  const activeTest = content.testById.get(activeTestId);

  const factorScores = computeFactorScores(assessments, content, followUps);
  const scopedFactorIds = content.factors.map((f) => f.id);
  const streak = computeStreak(sessions);

  // Build one series per side for the selected test, ordered by date.
  const series = useMemo(() => {
    if (!activeTest) return null;
    const rows = assessments
      .filter((a) => a.testId === activeTest.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (rows.length === 0) return null;

    const sides: Side[] = activeTest.perSide ? ['left', 'right'] : ['both'];
    const dates = [...new Set(rows.map((r) => r.date))].sort();
    const useRaw = activeTest.measure.kind !== 'level';

    return {
      dates,
      useRaw,
      unit: activeTest.measure.kind === 'cm' ? 'cm' : activeTest.measure.kind === 'seconds' ? 's' : '',
      lines: sides.map((side) => ({
        label: activeTest.perSide ? `Côté ${SIDE_LABEL[side]}` : t(activeTest.name),
        data: dates.map((d) => {
          const row = rows.find((r) => r.date === d && r.side === side);
          return row ? (useRaw ? row.rawValue : row.score) : null;
        }),
      })),
    };
  }, [activeTest, assessments]);

  const totalSessions = sessions.length;
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

  return (
    <Box>
      <PageHeader title="Progression" subtitle="Des mesures objectives, pas des impressions." />

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <StatTile label="Séances" value={String(totalSessions)} />
        <StatTile label="Série" value={`${streak} j`} />
        <StatTile label="Minutes" value={String(totalMinutes)} />
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h3" sx={{ mb: 1.5 }}>
            Régularité
          </Typography>
          <ConsistencyCalendar sessions={sessions} />
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h3" sx={{ mb: 1.5 }}>
            Évolution par test
          </Typography>

          {testedIds.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Fais un diagnostic pour commencer à suivre tes mesures. Refais-le toutes les 3-4
              semaines : c’est la courbe qui rend les progrès visibles.
            </Typography>
          ) : (
            <>
              <Select
                fullWidth
                size="small"
                value={activeTestId}
                onChange={(e) => setSelectedTestId(e.target.value)}
                sx={{ mb: 2 }}
              >
                {testedIds.map((test) => (
                  <MenuItem key={test.id} value={test.id}>
                    {t(test.name)}
                  </MenuItem>
                ))}
              </Select>

              {series && series.dates.length >= 2 ? (
                <LineChart
                  height={230}
                  xAxis={[
                    {
                      scaleType: 'point',
                      data: series.dates.map((d) =>
                        new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
                      ),
                    },
                  ]}
                  yAxis={[
                    series.useRaw
                      ? { min: 0 }
                      : {
                          min: 0,
                          max: 3,
                          tickMinStep: 1,
                          valueFormatter: (v: number) => SCORE_LABELS[Math.round(v) as 0 | 1 | 2 | 3] ?? '',
                        },
                  ]}
                  series={series.lines.map((l) => ({
                    label: l.label,
                    data: l.data,
                    connectNulls: true,
                    curve: 'linear',
                  }))}
                  margin={{ left: series.useRaw ? 45 : 90, right: 16, top: 20, bottom: 30 }}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Une seule mesure enregistrée pour ce test. Refais le diagnostic dans 3-4 semaines
                  pour voir apparaître ta courbe.
                </Typography>
              )}

              {activeTest?.interpretation && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="body2" color="text.secondary">
                    {t(activeTest.interpretation)}
                  </Typography>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h3" sx={{ mb: 1.5 }}>
            Profil actuel
          </Typography>
          <FactorGauges scores={factorScores} factorIds={scopedFactorIds} />
        </CardContent>
      </Card>

      {sessions.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h3" sx={{ mb: 1.5 }}>
              Dernières séances
            </Typography>
            <Stack spacing={1}>
              {[...sessions]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 8)
                .map((s) => (
                  <Stack
                    key={s.id}
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Typography variant="body2">
                      {new Date(s.date).toLocaleDateString('fr-FR', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                      })}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {s.painFlags?.length > 0 && (
                        <Chip size="small" color="error" variant="outlined" label="douleur" />
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {s.exercises.length} exos · {s.durationMinutes ?? '?'} min
                        {s.feeling ? ` · ${s.feeling}/5` : ''}
                      </Typography>
                    </Stack>
                  </Stack>
                ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card sx={{ flex: 1 }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 }, textAlign: 'center' }}>
        <Typography variant="h2">{value}</Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}
