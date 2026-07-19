import { Alert, Box, Button, Card, CardContent, Chip, Divider, LinearProgress, Stack, Typography } from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScienceIcon from '@mui/icons-material/Science';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import FlagNotes from '../components/FlagNotes';
import { useContent } from '../ContentContext';
import { useTodaySession } from '../hooks/useTodaySession';
import { t } from '../i18n';
import { TYPE_LABELS } from '../format';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bel après-midi';
  return 'Bonsoir';
}

export default function Today() {
  const content = useContent();
  const navigate = useNavigate();
  const data = useTodaySession();

  if (data.loading) return <LinearProgress sx={{ mt: 4 }} />;

  const { activeGoals, anyAssessed, session, streak, doneToday, dueRetests, flags } = data;

  return (
    <Box>
      <PageHeader
        title={`${greeting()} 👋`}
        subtitle="Ta séance ciblée du jour, adaptée à ton dernier diagnostic."
        action={
          streak > 0 ? (
            <Chip
              icon={<LocalFireDepartmentIcon />}
              color="secondary"
              label={`${streak} j`}
              sx={{ fontWeight: 700 }}
            />
          ) : undefined
        }
      />

      <FlagNotes flags={flags} />

      {activeGoals.length === 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h3" sx={{ mb: 1 }}>
              Choisis tes objectifs
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Sélectionne 1 à 3 objectifs pour générer ton programme.
            </Typography>
            <Button variant="contained" onClick={() => navigate('/settings')}>
              Choisir mes objectifs
            </Button>
          </CardContent>
        </Card>
      )}

      {activeGoals.length > 0 && !anyAssessed && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/diagnostic')}>
              Diagnostiquer
            </Button>
          }
        >
          Fais d’abord ton diagnostic : la séance sera bien plus ciblée.
        </Alert>
      )}

      {dueRetests.length > 0 && (
        <Alert
          severity="warning"
          icon={<ScienceIcon />}
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate(`/diagnostic/${dueRetests[0].goal.id}`)}>
              Re-tester
            </Button>
          }
        >
          Un re-test est conseillé pour « {t(dueRetests[0].goal.name)} » : mesure tes progrès.
        </Alert>
      )}

      {session && session.exercises.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h3">Séance du jour</Typography>
              {doneToday && <Chip size="small" color="success" icon={<CheckCircleIcon />} label="Faite" />}
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
              <Chip size="small" variant="outlined" label={`≈ ${Math.round(session.estimatedSeconds / 60)} min`} />
              <Chip size="small" variant="outlined" label={`${session.exercises.length} exercices`} />
              {session.focusFactors.slice(0, 2).map((f) => (
                <Chip
                  key={f}
                  size="small"
                  color="primary"
                  variant="outlined"
                  label={t(content.factorById.get(f)?.name)}
                />
              ))}
            </Stack>

            <Divider sx={{ mb: 1.5 }} />

            <Stack spacing={1} sx={{ mb: 2 }}>
              {session.exercises.map((ex, i) => (
                <Stack key={ex.id} direction="row" spacing={1.5} alignItems="center">
                  <Typography sx={{ color: 'text.secondary', width: 20 }}>{i + 1}</Typography>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {t(ex.name)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {TYPE_LABELS[ex.type]}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>

            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={() => navigate('/player')}
            >
              {doneToday ? 'Refaire la séance' : 'Commencer la séance'}
            </Button>
          </CardContent>
        </Card>
      )}

      {activeGoals.length > 0 && (
        <Stack spacing={1} sx={{ mb: 2 }}>
          {activeGoals.map((g) => (
            <Chip key={g.id} label={t(g.name)} variant="outlined" sx={{ justifyContent: 'flex-start' }} />
          ))}
        </Stack>
      )}
    </Box>
  );
}
