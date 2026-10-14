import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  Link,
  Snackbar,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import LockIcon from '@mui/icons-material/Lock';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../components/PageHeader';
import { useContent } from '../ContentContext';
import {
  clearAll,
  db,
  DEFAULT_PLAN,
  DEFAULT_SETTINGS,
  exportAll,
  importAll,
  savePlan,
  saveSettings,
  type ExportPayload,
} from '../db';
import { t } from '../i18n';
import { localDay } from '../logic/schedule';

export default function Settings() {
  const content = useContent();
  const plan = useLiveQuery(() => db.plan.get('current'), [], undefined) ?? DEFAULT_PLAN;
  const settings = useLiveQuery(() => db.settings.get('current'), [], undefined) ?? DEFAULT_SETTINGS;

  const fileRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const toggleGoal = async (id: string) => {
    const active = plan.activeGoalIds.includes(id);
    const next = active ? plan.activeGoalIds.filter((g) => g !== id) : [...plan.activeGoalIds, id];
    await savePlan({ activeGoalIds: next });
  };

  const doExport = async () => {
    const payload = await exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mobilite-sauvegarde-${localDay()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast('Sauvegarde téléchargée.');
  };

  const doImport = async (file: File) => {
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as ExportPayload;
      await importAll(payload);
      setToast('Données restaurées.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fichier illisible.');
    }
  };

  const doReset = async () => {
    await clearAll();
    setConfirmReset(false);
    setToast('Toutes les données ont été effacées.');
  };

  const hidden = settings.hiddenExerciseIds;

  return (
    <Box>
      <PageHeader title="Réglages" />

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h3" sx={{ mb: 0.5 }}>
            Mes objectifs
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Ils déterminent le contenu de tes séances. Active-en autant que tu veux : tes facteurs
            les plus faibles sont travaillés à chaque séance, les autres à tour de rôle.
          </Typography>
          {plan.activeGoalIds.length > 3 && plan.targetMinutes < 30 && (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              Avec {plan.activeGoalIds.length} objectifs, une séance de {plan.targetMinutes} min ne
              peut travailler qu’une partie de tes facteurs à la fois : chacun revient toutes les
              quelques séances. Passe à 30 min pour qu’ils reviennent plus souvent.
            </Alert>
          )}
          <Stack spacing={1}>
            {content.goals.map((g) => {
              const active = plan.activeGoalIds.includes(g.id);
              return (
                <Stack key={g.id} direction="row" alignItems="center" justifyContent="space-between">
                  <Box sx={{ pr: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {t(g.name)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t(g.tagline)}
                    </Typography>
                  </Box>
                  <Switch checked={active} onChange={() => toggleGoal(g.id)} />
                </Stack>
              );
            })}
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h3" sx={{ mb: 1.5 }}>
            Format des séances
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Durée cible
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={plan.targetMinutes}
            onChange={(_, v) => v && savePlan({ targetMinutes: v })}
            sx={{ mb: 2 }}
          >
            {[10, 20, 30].map((m) => (
              <ToggleButton key={m} value={m}>
                {m} min
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Jours par semaine
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={plan.daysPerWeek}
            onChange={(_, v) => v && savePlan({ daysPerWeek: v })}
          >
            {[2, 3, 4, 5].map((d) => (
              <ToggleButton key={d} value={d}>
                {d}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </CardContent>
      </Card>

      {hidden.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h3" sx={{ mb: 1 }}>
              Exercices masqués
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Masqués automatiquement après des douleurs répétées. Si la gêne persiste au quotidien,
              parles-en à un professionnel de santé.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {hidden.map((id) => (
                <Chip
                  key={id}
                  label={t(content.exerciseById.get(id)?.name) || id}
                  onDelete={() =>
                    saveSettings({ hiddenExerciseIds: hidden.filter((h) => h !== id) })
                  }
                />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <LockIcon fontSize="small" color="primary" />
            <Typography variant="h3">Mes données</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Tout est stocké sur cet appareil uniquement — aucun compte, aucun serveur. C’est aussi
            pour ça que <strong>l’export est ton seul backup</strong> : fais-le avant de changer de
            téléphone ou d’effacer ton navigateur.
          </Typography>

          <Stack spacing={1}>
            <Button variant="contained" startIcon={<DownloadIcon />} onClick={doExport}>
              Sauvegarder mes données
            </Button>
            <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => fileRef.current?.click()}>
              Restaurer une sauvegarde
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) doImport(f);
                e.target.value = '';
              }}
            />
            <Button
              variant="text"
              color="error"
              startIcon={<DeleteForeverIcon />}
              onClick={() => setConfirmReset(true)}
            >
              Tout effacer
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h3" sx={{ mb: 1 }}>
            Rappels
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={settings.remindersEnabled}
                onChange={async (e) => {
                  const on = e.target.checked;
                  if (on && 'Notification' in window && Notification.permission === 'default') {
                    await Notification.requestPermission();
                  }
                  await saveSettings({ remindersEnabled: on });
                }}
              />
            }
            label="Me rappeler de m’entraîner"
          />
          <Typography variant="caption" color="text.secondary" display="block">
            Rappels locaux uniquement, envoyés par ton navigateur quand l’app est ouverte.
          </Typography>
        </CardContent>
      </Card>

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h3" sx={{ mb: 1 }}>
            À propos
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Les tests proposés sont des auto-évaluations indicatives, pas des diagnostics cliniques.
            En cas de douleur aiguë, d’irradiation, d’engourdissement ou de fourmillements
            persistants, consulte un professionnel de santé.
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="caption" color="text.secondary" display="block">
            Contenus rédigés spécifiquement pour cette application. Les tests s’appuient sur des
            protocoles d’évaluation courants (weight-bearing lunge test, test de Thomas modifié,
            sit-and-reach, 90/90). Les démonstrations vidéo renvoient vers des recherches YouTube
            (Squat University, Tom Merrick, GMB Fitness…) : les droits restent à leurs auteurs.
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            Les illustrations et contenus issus de bases libres sont crédités sur la fiche de
            chaque exercice concerné. Voir{' '}
            <Link href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener">
              free-exercise-db
            </Link>{' '}
            et{' '}
            <Link href="https://wger.de" target="_blank" rel="noopener">
              wger.de
            </Link>
            .
          </Typography>
        </CardContent>
      </Card>

      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)}>
        <DialogTitle>Tout effacer ?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Cette action supprime définitivement tes diagnostics, tes séances et tes réglages sur cet
            appareil. Elle est irréversible : pense à exporter une sauvegarde d’abord.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmReset(false)}>Annuler</Button>
          <Button color="error" onClick={doReset}>
            Effacer définitivement
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        message={toast ?? ''}
      />
      {error && (
        <Snackbar open autoHideDuration={5000} onClose={() => setError(null)}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Snackbar>
      )}
    </Box>
  );
}
