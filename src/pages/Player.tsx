import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Rating,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ReplayIcon from '@mui/icons-material/Replay';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import HealingIcon from '@mui/icons-material/Healing';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import TuneIcon from '@mui/icons-material/Tune';
import { useNavigate } from 'react-router-dom';
import { useContent } from '../ContentContext';
import { useTodaySession } from '../hooks/useTodaySession';
import { useWakeLock } from '../hooks/useWakeLock';
import { db, saveSettings, type SessionExercise } from '../db';
import { t, tList } from '../i18n';
import { formatDosage } from '../format';
import { findRegression, estimateExerciseSeconds } from '../logic/generator';
import { dosageKind, type Exercise } from '../types';

export default function Player() {
  const content = useContent();
  const navigate = useNavigate();
  const data = useTodaySession();
  useWakeLock(true);

  // Snapshot the generated exercise list once so it doesn't shift mid-session.
  const [queue, setQueue] = useState<Exercise[] | null>(null);
  useEffect(() => {
    if (!data.loading && data.session && queue === null) {
      setQueue(data.session.exercises);
    }
  }, [data.loading, data.session, queue]);

  const [index, setIndex] = useState(0);
  const [regressed, setRegressed] = useState<Record<string, boolean>>({});
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const [painFlags, setPainFlags] = useState<string[]>([]);
  // Mild pain on pain-monitored (knee-loading) exercises: acceptable, never hides the exercise.
  const [mildPain, setMildPain] = useState<string[]>([]);
  const [askPainLevel, setAskPainLevel] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feeling, setFeeling] = useState<number | null>(4);
  const startedAt = useRef<number>(Date.now());

  if (data.loading || queue === null) return <LinearProgress sx={{ mt: 4 }} />;

  if (queue.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography sx={{ mb: 2 }}>Aucune séance disponible. Choisis un objectif d’abord.</Typography>
        <Button variant="contained" onClick={() => navigate('/')}>
          Retour à l’accueil
        </Button>
      </Box>
    );
  }

  const current = queue[index];
  const isLast = index === queue.length - 1;
  const painFlagged = painFlags.includes(current.id);
  const mildPainNoted = mildPain.includes(current.id) && !painFlagged;

  const swapToRegression = () => {
    const reg = findRegression(current, content);
    if (!reg) return;
    setQueue((q) => q!.map((e, i) => (i === index ? reg : e)));
    setRegressed((r) => ({ ...r, [reg.id]: true }));
  };

  const flagPain = () => {
    setPainFlags((p) => (p.includes(current.id) ? p : [...p, current.id]));
  };

  const reportPain = () => {
    if (current.painMonitoring) setAskPainLevel(true);
    else flagPain();
  };

  const answerPainLevel = (mild: boolean) => {
    setAskPainLevel(false);
    if (mild) setMildPain((p) => (p.includes(current.id) ? p : [...p, current.id]));
    else flagPain();
  };

  const skipExercise = () => {
    setSkipped((s) => ({ ...s, [current.id]: true }));
    goNext();
  };

  const goNext = () => {
    if (isLast) setShowFeedback(true);
    else setIndex((i) => i + 1);
  };

  const finish = async () => {
    const exercises: SessionExercise[] = queue.map((e) => ({
      exerciseId: e.id,
      regressed: !!regressed[e.id],
      skipped: !!skipped[e.id],
    }));
    const durationMinutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));

    await db.sessions.add({
      date: new Date().toISOString(),
      goalIds: data.activeGoals.map((g) => g.id),
      exercises,
      feeling: feeling ?? undefined,
      painFlags,
      durationMinutes,
    });

    // Safety rule: an exercise flagged for pain twice across recent sessions gets hidden.
    if (painFlags.length > 0) {
      const recent = (await db.sessions.orderBy('date').reverse().limit(6).toArray())
        .flatMap((s) => s.painFlags ?? []);
      const counts = new Map<string, number>();
      for (const id of recent) counts.set(id, (counts.get(id) ?? 0) + 1);
      const toHide = [...counts.entries()].filter(([, c]) => c >= 2).map(([id]) => id);
      if (toHide.length > 0) {
        const hidden = new Set([...data.settings.hiddenExerciseIds, ...toHide]);
        await saveSettings({ hiddenExerciseIds: [...hidden] });
      }
    }

    navigate('/', { replace: true });
  };

  return (
    <Box sx={{ py: 1 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <IconButton onClick={() => navigate('/')} aria-label="Quitter">
          <CloseIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Exercice {index + 1}/{queue.length}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(index / queue.length) * 100}
            sx={{ height: 6, borderRadius: 999, mt: 0.5 }}
          />
        </Box>
      </Stack>

      <Typography variant="h1" sx={{ mb: 0.5 }}>
        {t(current.name)}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Chip size="small" color="primary" label={formatDosage(current.dosage)} />
        {current.dosage.note && <Chip size="small" variant="outlined" label={t(current.dosage.note)} />}
      </Stack>

      <ExerciseTimer key={current.id} exercise={current} />

      {painFlagged && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Passe à la version plus facile ci-dessous. Si la douleur revient à chaque séance,
          consulte un professionnel de santé et mets cet exercice de côté.
        </Alert>
      )}

      {mildPainNoted && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Une gêne légère et stable est acceptable sur cet exercice : continue. Si elle augmente
          pendant l’exercice, ou si elle est encore là demain matin, passe à la version plus facile
          la prochaine fois.
        </Alert>
      )}

      <List dense sx={{ mt: 1 }}>
        {tList(current.instructions).map((ins, i) => (
          <ListItem key={i} alignItems="flex-start" sx={{ px: 0 }}>
            <ListItemIcon sx={{ minWidth: 28 }}>
              <Typography sx={{ fontWeight: 700, color: 'primary.main' }}>{i + 1}.</Typography>
            </ListItemIcon>
            <ListItemText primary={ins} />
          </ListItem>
        ))}
      </List>

      {/* With an anterior impingement flagged, the safe setup replaces the
          default one: we work below the bony block, never into it. */}
      {data.flags.has('anterior-hip-impingement') && current.impingementFriendlySetup && (
        <Alert severity="warning" icon={<TuneIcon />} sx={{ mt: 1 }}>
          <strong>Adapté à ton pincement de hanche :</strong> {t(current.impingementFriendlySetup)}
          <br />
          On travaille sous la butée, jamais dedans.
        </Alert>
      )}

      {current.expectedFeeling && (
        <Alert severity="info" icon={false} sx={{ mt: 1, bgcolor: 'rgba(63,125,99,0.08)' }}>
          <strong>Sensation attendue :</strong> {t(current.expectedFeeling)}
        </Alert>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
        <Button
          size="small"
          variant="outlined"
          startIcon={<TrendingDownIcon />}
          onClick={swapToRegression}
          disabled={!findRegression(current, content)}
        >
          Trop dur → plus facile
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="error"
          startIcon={<HealingIcon />}
          onClick={reportPain}
        >
          J’ai une douleur
        </Button>
        <Button size="small" variant="text" startIcon={<SkipNextIcon />} onClick={skipExercise}>
          Passer
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
        <Button variant="outlined" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          Précédent
        </Button>
        <Button fullWidth variant="contained" size="large" onClick={goNext}>
          {isLast ? 'Terminer' : 'Exercice suivant'}
        </Button>
      </Stack>

      <Dialog open={askPainLevel} onClose={() => setAskPainLevel(false)} fullWidth maxWidth="xs">
        <DialogTitle>Comment est cette douleur ?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Sur cet exercice du genou, une gêne légère est acceptable : jusqu’à 3 sur 10, stable
            pendant l’exercice, et calmée le lendemain matin. Au-delà, on allège.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1, px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => answerPainLevel(true)}>
            Légère (3/10 au plus) et stable
          </Button>
          <Button variant="contained" color="error" onClick={() => answerPainLevel(false)}>
            Nette (plus de 3/10) ou qui augmente
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showFeedback} fullWidth maxWidth="xs">
        <DialogTitle>Séance terminée 🎉</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Comment tu te sens ?
          </Typography>
          <Stack alignItems="center" spacing={1}>
            <Rating
              value={feeling}
              onChange={(_, v) => setFeeling(v)}
              max={5}
              size="large"
            />
            <Typography variant="caption" color="text.secondary">
              1 = épuisé · 5 = au top
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={finish}>Enregistrer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/** Short audible cue + haptic, for phase changes and end of hold. */
function cue(strong = false) {
  try {
    navigator.vibrate?.(strong ? [120, 60, 120] : 180);
  } catch {
    /* ignore */
  }
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = strong ? 880 : 620;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
    osc.onended = () => ctx.close();
  } catch {
    /* audio unavailable — the vibration still fires */
  }
}

const TIMER_BOX = { p: 2, borderRadius: 3, bgcolor: 'rgba(63,125,99,0.08)', textAlign: 'center' } as const;

/** Dispatches to the right timer for the exercise's dosage kind. */
function ExerciseTimer({ exercise }: { exercise: Exercise }) {
  const kind = dosageKind(exercise.dosage);
  if (kind === 'cycles') return <CycleTimer exercise={exercise} />;
  if (kind === 'hold') return <HoldTimer exercise={exercise} />;
  return <RepsPanel exercise={exercise} />;
}

/** Rep-based: no countdown, just the target and an estimate. */
function RepsPanel({ exercise }: { exercise: Exercise }) {
  const totalSeconds = useMemo(() => estimateExerciseSeconds(exercise), [exercise]);
  return (
    <Box sx={TIMER_BOX}>
      <Typography variant="h2">{formatDosage(exercise.dosage)}</Typography>
      <Typography variant="caption" color="text.secondary">
        À ton rythme · ≈ {Math.round(totalSeconds / 60)} min
      </Typography>
    </Box>
  );
}

/** Simple descending hold timer. */
function HoldTimer({ exercise }: { exercise: Exercise }) {
  const hold = exercise.dosage.holdSeconds ?? 0;
  const [remaining, setRemaining] = useState(hold);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setRemaining(hold);
    setRunning(false);
  }, [hold, exercise.id]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          cue(true);
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const pct = hold > 0 ? ((hold - remaining) / hold) * 100 : 0;

  return (
    <Box sx={TIMER_BOX}>
      <Typography variant="h1" sx={{ fontSize: '3rem', fontVariantNumeric: 'tabular-nums' }}>
        {remaining}s
      </Typography>
      <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 999, my: 1.5 }} />
      <Stack direction="row" spacing={1} justifyContent="center">
        <Button
          variant="contained"
          startIcon={running ? <PauseIcon /> : <PlayArrowIcon />}
          onClick={() => setRunning((r) => !r)}
        >
          {running ? 'Pause' : remaining === 0 ? 'Refait' : 'Démarrer la tenue'}
        </Button>
        <IconButton onClick={() => { setRemaining(hold); setRunning(false); }} aria-label="Réinitialiser">
          <ReplayIcon />
        </IconButton>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {formatDosage(exercise.dosage)}
      </Typography>
    </Box>
  );
}

/**
 * Interval timer: `count` cycles of the phase sequence, announcing each phase
 * by name with a cue — you must know when to contract and when to release
 * without looking at the screen.
 */
function CycleTimer({ exercise }: { exercise: Exercise }) {
  const cycles = exercise.dosage.cycles!;
  const phases = cycles.phases;
  const [cycleIndex, setCycleIndex] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [remaining, setRemaining] = useState(phases[0].seconds);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  const reset = () => {
    setCycleIndex(0);
    setPhaseIndex(0);
    setRemaining(phases[0].seconds);
    setRunning(false);
    setFinished(false);
  };
  useEffect(reset, [exercise.id]);

  useEffect(() => {
    if (!running || finished) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r > 1) return r - 1;
        // Phase elapsed: advance to the next phase, or the next cycle.
        const nextPhase = phaseIndex + 1;
        if (nextPhase < phases.length) {
          setPhaseIndex(nextPhase);
          cue();
          return phases[nextPhase].seconds;
        }
        const nextCycle = cycleIndex + 1;
        if (nextCycle < cycles.count) {
          setCycleIndex(nextCycle);
          setPhaseIndex(0);
          cue();
          return phases[0].seconds;
        }
        cue(true);
        setRunning(false);
        setFinished(true);
        return 0;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, finished, phaseIndex, cycleIndex, phases, cycles.count]);

  const phase = phases[phaseIndex];
  const pct = phase.seconds > 0 ? ((phase.seconds - remaining) / phase.seconds) * 100 : 0;

  return (
    <Box sx={TIMER_BOX}>
      <Typography variant="caption" color="text.secondary">
        {finished ? 'Série terminée' : `Cycle ${cycleIndex + 1}/${cycles.count}`}
      </Typography>
      <Typography variant="h3" sx={{ mt: 0.5, minHeight: 48, color: 'primary.dark' }}>
        {finished ? 'Repose-toi, puis enchaîne la série suivante' : t(phase.label)}
      </Typography>
      <Typography variant="h1" sx={{ fontSize: '3rem', fontVariantNumeric: 'tabular-nums' }}>
        {remaining}s
      </Typography>
      <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 999, my: 1.5 }} />

      <Stack direction="row" spacing={0.5} justifyContent="center" sx={{ mb: 1.5 }}>
        {phases.map((p, i) => (
          <Chip
            key={i}
            size="small"
            label={`${p.seconds}s`}
            color={i === phaseIndex && !finished ? 'primary' : 'default'}
            variant={i === phaseIndex && !finished ? 'filled' : 'outlined'}
          />
        ))}
      </Stack>

      <Stack direction="row" spacing={1} justifyContent="center">
        <Button
          variant="contained"
          startIcon={running ? <PauseIcon /> : <PlayArrowIcon />}
          onClick={() => {
            if (finished) reset();
            else setRunning((r) => !r);
          }}
        >
          {finished ? 'Refaire une série' : running ? 'Pause' : 'Démarrer les cycles'}
        </Button>
        <IconButton onClick={reset} aria-label="Réinitialiser">
          <ReplayIcon />
        </IconButton>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {formatDosage(exercise.dosage)}
      </Typography>
    </Box>
  );
}
