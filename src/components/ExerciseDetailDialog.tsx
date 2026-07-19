import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutline';
import WarningIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import TuneIcon from '@mui/icons-material/Tune';
import MediaBlock from './MediaBlock';
import { useContent } from '../ContentContext';
import { t, tList } from '../i18n';
import { equipmentLabel, firstImageUrl, formatDosage, LEVEL_LABELS, TYPE_LABELS, videoSearchUrl } from '../format';
import type { Exercise } from '../types';

export default function ExerciseDetailDialog({
  exercise,
  open,
  onClose,
}: {
  exercise: Exercise | null;
  open: boolean;
  onClose: () => void;
}) {
  const content = useContent();
  if (!exercise) return null;

  const equipment = equipmentLabel(exercise);
  const note = exercise.dosage.note ? t(exercise.dosage.note) : null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <Box sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: 'background.paper', px: 2, pt: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Typography variant="h2" sx={{ pr: 4 }}>
            {t(exercise.name)}
          </Typography>
          <IconButton onClick={onClose} edge="end" aria-label="Fermer">
            <CloseIcon />
          </IconButton>
        </Stack>
      </Box>

      <DialogContent sx={{ pt: 1 }}>
        <MediaBlock
          imageUrl={firstImageUrl(exercise)}
          videoUrl={videoSearchUrl(exercise)}
          alt={t(exercise.name)}
        />

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ my: 2 }}>
          <Chip size="small" color="primary" label={TYPE_LABELS[exercise.type]} />
          <Chip size="small" variant="outlined" label={LEVEL_LABELS[exercise.level]} />
          <Chip size="small" variant="outlined" label={formatDosage(exercise.dosage)} />
          {exercise.targets.map((factorId) => (
            <Chip
              key={factorId}
              size="small"
              variant="outlined"
              sx={{ borderStyle: 'dashed' }}
              label={t(content.factorById.get(factorId)?.name)}
            />
          ))}
        </Stack>

        {equipment && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <strong>Matériel :</strong> {equipment}
          </Typography>
        )}
        {note && (
          <Typography variant="body2" sx={{ mb: 2, fontStyle: 'italic' }}>
            {note}
          </Typography>
        )}

        <Section title="Comment faire">
          <List dense disablePadding>
            {tList(exercise.instructions).map((step, i) => (
              <ListItem key={i} alignItems="flex-start" sx={{ px: 0 }}>
                <ListItemIcon sx={{ minWidth: 30 }}>
                  <Typography sx={{ fontWeight: 700, color: 'primary.main' }}>{i + 1}.</Typography>
                </ListItemIcon>
                <ListItemText primary={step} />
              </ListItem>
            ))}
          </List>
        </Section>

        {exercise.expectedFeeling && (
          <IconLine icon={<FavoriteBorderIcon color="primary" />} title="Sensation attendue">
            {t(exercise.expectedFeeling)}
          </IconLine>
        )}

        {exercise.commonMistakes && tList(exercise.commonMistakes).length > 0 && (
          <Section title="Erreurs fréquentes" icon={<WarningIcon sx={{ color: 'warning.main' }} />}>
            <Bullets items={tList(exercise.commonMistakes)} icon={<WarningIcon sx={{ fontSize: 18, color: 'warning.main' }} />} />
          </Section>
        )}

        {exercise.safetyNotes && tList(exercise.safetyNotes).length > 0 && (
          <Section title="Sécurité" icon={<ErrorOutlineIcon color="error" />}>
            <Bullets items={tList(exercise.safetyNotes)} icon={<CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />} />
          </Section>
        )}

        {exercise.impingementFriendlySetup && (
          <IconLine icon={<TuneIcon color="warning" />} title="Si tu as un pincement de hanche">
            {t(exercise.impingementFriendlySetup)}
          </IconLine>
        )}

        {(exercise.sourceAttribution || exercise.imageAttribution) && (
          <>
            <Divider sx={{ my: 2 }} />
            {exercise.sourceAttribution && (
              <Typography variant="caption" color="text.secondary" display="block">
                Source : {exercise.sourceAttribution.text} ({exercise.sourceAttribution.license})
              </Typography>
            )}
            {exercise.imageAttribution && (
              <Typography variant="caption" color="text.secondary" display="block">
                <Link
                  href={exercise.imageAttribution.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  color="inherit"
                >
                  {exercise.imageAttribution.text}
                </Link>
              </Typography>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box sx={{ mt: 2.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        {icon}
        <Typography variant="h3">{title}</Typography>
      </Stack>
      {children}
    </Box>
  );
}

function IconLine({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mt: 2.5, p: 1.5, borderRadius: 2, bgcolor: 'rgba(63,125,99,0.06)' }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        {icon}
        <Typography variant="h3">{title}</Typography>
      </Stack>
      <Typography variant="body2">{children}</Typography>
    </Box>
  );
}

function Bullets({ items, icon }: { items: string[]; icon: React.ReactNode }) {
  return (
    <List dense disablePadding>
      {items.map((it, i) => (
        <ListItem key={i} alignItems="flex-start" sx={{ px: 0 }}>
          <ListItemIcon sx={{ minWidth: 28 }}>{icon}</ListItemIcon>
          <ListItemText primary={it} />
        </ListItem>
      ))}
    </List>
  );
}
