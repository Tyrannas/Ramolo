import { Box, Button, Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';
import ReplayIcon from '@mui/icons-material/Replay';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import FactorGauges from '../components/FactorGauges';
import FlagNotes from '../components/FlagNotes';
import { useContent } from '../ContentContext';
import { db } from '../db';
import { t } from '../i18n';
import { computeFactorScores, computeFlags, computeGoalReadiness } from '../logic/profile';
import { retestStatus } from '../logic/schedule';

export default function Diagnostic() {
  const content = useContent();
  const navigate = useNavigate();
  const assessments = useLiveQuery(() => db.assessments.toArray(), [], []);
  const followUps = useLiveQuery(() => db.followUps.toArray(), [], []);

  const factorScores = computeFactorScores(assessments, content, followUps);
  const flags = computeFlags(followUps, content);
  // The overall profile shows the whole taxonomy: a factor no test has scored
  // yet (hip internal rotation, until the 90/90 follow-up is answered) must
  // appear as "non évalué" rather than vanish or default to a full gauge.
  const scopedFactorIds = content.factors.map((f) => f.id);
  const retests = retestStatus(content.goals, assessments);

  return (
    <Box>
      <PageHeader
        title="Diagnostic"
        subtitle="Quelques tests de 5 minutes pour savoir ce qui te bloque, objectif par objectif."
      />

      <Card sx={{ mb: 3, bgcolor: 'rgba(63,125,99,0.05)' }}>
        <CardContent>
          <Typography variant="h3" sx={{ mb: 1.5 }}>
            Ton profil par facteur
          </Typography>
          <FactorGauges
            scores={factorScores}
            factorIds={scopedFactorIds}
            emptyHint="Lance un diagnostic pour révéler ton profil"
          />
        </CardContent>
      </Card>

      <FlagNotes flags={flags} />

      <Stack spacing={2}>
        {content.goals.map((goal) => {
          const readiness = computeGoalReadiness(goal, factorScores, content);
          const rt = retests.find((r) => r.goal.id === goal.id);
          return (
            <Card key={goal.id}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="h3">{t(goal.name)}</Typography>
                  {rt?.due && <Chip size="small" color="warning" label="Re-test conseillé" />}
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {readiness.synthesis}
                </Typography>
                <Divider sx={{ mb: 1.5 }} />
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">
                    {goal.tests.length} tests
                    {rt?.assessed && rt.daysAgo != null && ` · dernier il y a ${rt.daysAgo} j`}
                  </Typography>
                  <Button
                    size="small"
                    variant={readiness.assessed ? 'outlined' : 'contained'}
                    startIcon={readiness.assessed ? <ReplayIcon /> : <PlayArrowIcon />}
                    onClick={() => navigate(`/diagnostic/${goal.id}`)}
                  >
                    {readiness.assessed ? 'Refaire' : 'Faire le diagnostic'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}
