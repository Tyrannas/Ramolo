import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Checkbox,
  Chip,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import CheckIcon from '@mui/icons-material/Check';
import { useNavigate } from 'react-router-dom';
import { useContent } from '../ContentContext';
import { t } from '../i18n';
import { savePlan } from '../db';

export default function Onboarding() {
  const content = useContent();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [goals, setGoals] = useState<string[]>([]);

  const toggleGoal = (id: string) =>
    setGoals((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : prev.length < 3 ? [...prev, id] : prev));

  const finish = async () => {
    const now = new Date().toISOString();
    await savePlan({ activeGoalIds: goals, onboardedAt: now, disclaimerAcceptedAt: now });
    navigate('/', { replace: true });
  };

  return (
    <Box sx={{ minHeight: '80dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', py: 3 }}>
      {step === 0 && (
        <Stack spacing={2}>
          <Typography variant="h1">Des objectifs de mouvement concrets.</Typography>
          <Typography color="text.secondary">
            Pas des « séances d’étirement » génériques. On identifie <strong>ce qui te bloque
            vraiment</strong> — cheville, hanche, ischios… — et on construit un programme ciblé, avec
            des tests pour objectiver tes progrès.
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'primary.main' }}>
            <LockIcon fontSize="small" />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              100 % sur ton appareil. Aucun compte, aucune donnée envoyée.
            </Typography>
          </Stack>
          <Button variant="contained" size="large" onClick={() => setStep(1)}>
            Commencer
          </Button>
        </Stack>
      )}

      {step === 1 && (
        <Stack spacing={2}>
          <Typography variant="h1">Avant de commencer</Typography>
          <Alert severity="info" variant="outlined">
            Cette application propose des auto-évaluations et des exercices <strong>indicatifs</strong>.
            Elle ne remplace pas un avis médical. En cas de douleur aiguë, d’irradiation dans une jambe
            ou un bras, d’engourdissements ou de fourmillements persistants, arrête-toi et consulte un
            professionnel de santé.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            Les exercices proposent toujours une version plus facile. Rien ne doit provoquer de douleur
            vive : l’étirement se sent, il ne se subit pas.
          </Typography>
          <FormControlLabel
            control={<Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />}
            label="J’ai compris que ces tests et conseils sont indicatifs et ne remplacent pas un avis médical."
          />
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setStep(0)}>Retour</Button>
            <Button variant="contained" disabled={!accepted} onClick={() => setStep(2)} sx={{ flex: 1 }}>
              Continuer
            </Button>
          </Stack>
        </Stack>
      )}

      {step === 2 && (
        <Stack spacing={2}>
          <Box>
            <Typography variant="h1">Que veux-tu débloquer ?</Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
              Choisis 1 à 3 objectifs (modifiable à tout moment).
            </Typography>
          </Box>
          <Stack spacing={1.5}>
            {content.goals.map((g) => {
              const active = goals.includes(g.id);
              return (
                <Card key={g.id} sx={{ borderColor: active ? 'primary.main' : undefined, borderWidth: active ? 2 : 1 }}>
                  <CardActionArea onClick={() => toggleGoal(g.id)}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="h3">{t(g.name)}</Typography>
                        {active && <Chip size="small" color="primary" icon={<CheckIcon />} label="Choisi" />}
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {t(g.tagline)}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              );
            })}
          </Stack>
          <Button variant="contained" size="large" disabled={goals.length === 0} onClick={finish}>
            C’est parti {goals.length > 0 && `(${goals.length})`}
          </Button>
        </Stack>
      )}
    </Box>
  );
}
