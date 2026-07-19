import { Card, CardActionArea, CardContent, Chip, Stack, Typography } from '@mui/material';
import { t } from '../i18n';
import { formatDosage, LEVEL_LABELS, TYPE_LABELS } from '../format';
import type { Exercise } from '../types';

export default function ExerciseCard({
  exercise,
  onClick,
}: {
  exercise: Exercise;
  onClick: () => void;
}) {
  return (
    <Card>
      <CardActionArea onClick={onClick}>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
            <Chip size="small" color="primary" variant="outlined" label={TYPE_LABELS[exercise.type]} />
            <Chip size="small" variant="outlined" label={LEVEL_LABELS[exercise.level]} />
          </Stack>
          <Typography variant="h3" sx={{ mb: 0.5 }}>
            {t(exercise.name)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatDosage(exercise.dosage)}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
