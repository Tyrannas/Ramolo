import { useMemo, useState } from 'react';
import { Box, Chip, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import PageHeader from '../components/PageHeader';
import ExerciseCard from '../components/ExerciseCard';
import ExerciseDetailDialog from '../components/ExerciseDetailDialog';
import { useContent } from '../ContentContext';
import { t } from '../i18n';
import type { Exercise, FactorId } from '../types';

type GoalFilter = string | 'all';

export default function Library() {
  const content = useContent();
  const [goalFilter, setGoalFilter] = useState<GoalFilter>('all');
  const [factorFilter, setFactorFilter] = useState<FactorId | null>(null);
  const [selected, setSelected] = useState<Exercise | null>(null);

  const factorsInUse = useMemo(() => {
    const ids = new Set<FactorId>();
    content.exercises.forEach((e) => e.targets.forEach((f) => ids.add(f)));
    return content.factors.filter((f) => ids.has(f.id));
  }, [content]);

  const filtered = useMemo(() => {
    return content.exercises.filter((ex) => {
      if (goalFilter !== 'all' && !ex.goals.includes(goalFilter)) return false;
      if (factorFilter && !ex.targets.includes(factorFilter)) return false;
      return true;
    });
  }, [content, goalFilter, factorFilter]);

  return (
    <Box>
      <PageHeader
        title="Bibliothèque"
        subtitle={`${content.exercises.length} exercices, du plus facile au plus avancé.`}
      />

      <ToggleButtonGroup
        value={goalFilter}
        exclusive
        size="small"
        onChange={(_, v) => v && setGoalFilter(v)}
        sx={{ mb: 2, flexWrap: 'wrap', gap: 1, '& .MuiToggleButton-root': { borderRadius: 999, border: '1px solid rgba(32,48,42,0.15)' } }}
      >
        <ToggleButton value="all">Tous</ToggleButton>
        {content.goals.map((g) => (
          <ToggleButton key={g.id} value={g.id}>
            {t(g.name)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Box sx={{ mb: 2, overflowX: 'auto' }}>
        <Stack direction="row" spacing={1} sx={{ pb: 1 }}>
          <Chip
            label="Tous les facteurs"
            color={factorFilter === null ? 'primary' : 'default'}
            variant={factorFilter === null ? 'filled' : 'outlined'}
            onClick={() => setFactorFilter(null)}
          />
          {factorsInUse.map((f) => (
            <Chip
              key={f.id}
              label={t(f.name)}
              color={factorFilter === f.id ? 'primary' : 'default'}
              variant={factorFilter === f.id ? 'filled' : 'outlined'}
              onClick={() => setFactorFilter(f.id)}
              sx={{ flexShrink: 0 }}
            />
          ))}
        </Stack>
      </Box>

      {filtered.length === 0 ? (
        <Typography color="text.secondary">Aucun exercice ne correspond à ces filtres.</Typography>
      ) : (
        <Stack spacing={1.5} sx={{ pb: 2 }}>
          {filtered.map((ex) => (
            <ExerciseCard key={ex.id} exercise={ex} onClick={() => setSelected(ex)} />
          ))}
        </Stack>
      )}

      <ExerciseDetailDialog exercise={selected} open={!!selected} onClose={() => setSelected(null)} />
    </Box>
  );
}
