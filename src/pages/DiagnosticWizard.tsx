import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Radio,
  RadioGroup,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { useNavigate, useParams } from 'react-router-dom';
import MediaBlock from '../components/MediaBlock';
import FactorGauges from '../components/FactorGauges';
import FlagNotes from '../components/FlagNotes';
import { useContent } from '../ContentContext';
import { db, type Assessment, type FollowUpAnswer } from '../db';
import { t, tList } from '../i18n';
import { firstImageUrl, videoSearchUrl } from '../format';
import { scoreTest } from '../logic/scoring';
import { computeFactorScores, computeFlags, computeGoalReadiness } from '../logic/profile';
import { daysSince, RETEST_INTERVAL_DAYS } from '../logic/schedule';
import type { DiagnosticTest, FactorId, Score, Side } from '../types';

interface Step {
  test: DiagnosticTest;
  side: Side;
}

interface Draft {
  testId: string;
  side: Side;
  rawValue: number;
  score: Score;
  /** Chosen follow-up option id, when the test has a follow-up question. */
  followUpOptionId?: string;
}

const SIDE_LABEL: Record<Side, string> = { left: 'Côté gauche', right: 'Côté droit', both: '' };

export default function DiagnosticWizard() {
  const content = useContent();
  const navigate = useNavigate();
  const { goalId } = useParams();
  const goal = goalId ? content.goalById.get(goalId) : undefined;

  // Results are stored per test, not per goal. A test shared by several goals
  // (toe-touch-standing, standing-pelvic-tilt-control) is therefore only asked
  // once: an answer that is still fresh feeds every goal that references it.
  const [existing, setExisting] = useState<Assessment[] | null>(null);
  const [redoAll, setRedoAll] = useState(false);
  useEffect(() => {
    db.assessments.toArray().then(setExisting);
  }, []);

  const freshTestIds = useMemo(() => {
    if (!existing || redoAll) return new Set<string>();
    const fresh = new Set<string>();
    for (const a of existing) {
      if (daysSince(a.date) < RETEST_INTERVAL_DAYS) fresh.add(a.testId);
    }
    return fresh;
  }, [existing, redoAll]);

  const steps = useMemo<Step[]>(() => {
    if (!goal || existing === null) return [];
    const list: Step[] = [];
    for (const testId of goal.tests) {
      const test = content.testById.get(testId);
      if (!test || freshTestIds.has(testId)) continue;
      if (test.perSide) {
        list.push({ test, side: 'left' }, { test, side: 'right' });
      } else {
        list.push({ test, side: 'both' });
      }
    }
    return list;
  }, [goal, content, freshTestIds, existing]);

  const reusedCount = useMemo(
    () => (goal ? goal.tests.filter((id) => freshTestIds.has(id)).length : 0),
    [goal, freshTestIds],
  );

  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [done, setDone] = useState(false);

  if (!goal) {
    return (
      <Box sx={{ py: 4 }}>
        <Typography>Objectif introuvable.</Typography>
        <Button onClick={() => navigate('/diagnostic')}>Retour</Button>
      </Box>
    );
  }

  if (done) return <Results goalId={goal.id} />;

  if (existing === null) return <LinearProgress sx={{ mt: 4 }} />;

  // Every test of this goal was already answered recently for another goal.
  if (steps.length === 0) {
    return (
      <Box sx={{ py: 3 }}>
        <Typography variant="h1" sx={{ mb: 1 }}>
          {t(goal.name)}
        </Typography>
        <Alert severity="success" sx={{ mb: 2 }}>
          Les {goal.tests.length} tests de cet objectif ont déjà été faits récemment — tes réponses
          sont réutilisées, pas besoin de tout refaire.
        </Alert>
        <Stack spacing={1}>
          <Button variant="contained" onClick={() => setDone(true)}>
            Voir mon résultat
          </Button>
          <Button onClick={() => setRedoAll(true)}>Refaire les tests quand même</Button>
        </Stack>
      </Box>
    );
  }

  const total = steps.length;
  const step = steps[index];
  const key = `${step.test.id}::${step.side}`;
  const draft = drafts[key];

  const setValue = (rawValue: number) => {
    const score = scoreTest(step.test, rawValue);
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...prev[key], testId: step.test.id, side: step.side, rawValue, score },
    }));
  };

  const setFollowUp = (optionId: string) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], followUpOptionId: optionId } }));
  };

  // Both the measurement and the follow-up (when present) are required: the
  // follow-up is the only source of score for some factors, so skipping it
  // would leave a gauge unevaluated.
  const canNext = draft !== undefined && (!step.test.followUp || !!draft.followUpOptionId);

  const next = async () => {
    if (index < total - 1) {
      setIndex((i) => i + 1);
      return;
    }
    // Persist all drafts with a shared timestamp.
    const date = new Date().toISOString();
    const values = Object.values(drafts);
    const rows: Assessment[] = values.map((d) => ({
      testId: d.testId,
      side: d.side,
      rawValue: d.rawValue,
      score: d.score,
      date,
    }));
    const followUpRows: FollowUpAnswer[] = values
      .filter((d) => d.followUpOptionId)
      .map((d) => ({
        testId: d.testId,
        side: d.side,
        optionId: d.followUpOptionId!,
        date,
      }));
    await db.assessments.bulkAdd(rows);
    if (followUpRows.length > 0) await db.followUps.bulkAdd(followUpRows);
    setDone(true);
  };

  return (
    <Box sx={{ py: 1 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <IconButton
          onClick={() => (index === 0 ? navigate('/diagnostic') : setIndex((i) => i - 1))}
          aria-label="Précédent"
        >
          {index === 0 ? <CloseIcon /> : <ArrowBackIcon />}
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {t(goal.name)} · Test {index + 1}/{total}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={((index) / total) * 100}
            sx={{ height: 6, borderRadius: 999, mt: 0.5 }}
          />
        </Box>
      </Stack>

      {reusedCount > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {reusedCount} test{reusedCount > 1 ? 's' : ''} déjà fait
          {reusedCount > 1 ? 's' : ''} récemment pour un autre objectif — on réutilise
          {reusedCount > 1 ? ' ces réponses' : ' cette réponse'}.
        </Alert>
      )}

      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
            <Chip
              size="small"
              variant="outlined"
              label={t(content.factorById.get(step.test.factor)?.name)}
            />
            {step.side !== 'both' && <Chip size="small" color="secondary" label={SIDE_LABEL[step.side]} />}
          </Stack>

          <Typography variant="h2" sx={{ mb: 1 }}>
            {t(step.test.name)}
          </Typography>

          <MediaBlock
            imageUrl={firstImageUrl(step.test)}
            videoUrl={videoSearchUrl(step.test)}
            alt={t(step.test.name)}
            height={160}
          />

          {t(step.test.equipment) && t(step.test.equipment).toLowerCase() !== 'aucun' && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              <strong>Matériel :</strong> {t(step.test.equipment)}
            </Typography>
          )}

          <List dense sx={{ mt: 1 }}>
            {tList(step.test.instructions).map((ins, i) => (
              <ListItem key={i} alignItems="flex-start" sx={{ px: 0 }}>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <Typography sx={{ fontWeight: 700, color: 'primary.main' }}>{i + 1}.</Typography>
                </ListItemIcon>
                <ListItemText primary={ins} />
              </ListItem>
            ))}
          </List>

          <Box sx={{ mt: 2 }}>
            <MeasureInput test={step.test} draft={draft} onChange={setValue} />
          </Box>

          {step.test.followUp && (
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(32,48,42,0.1)' }}>
              <Typography variant="h3" sx={{ mb: 1 }}>
                {t(step.test.followUp.prompt)}
              </Typography>
              <RadioGroup
                value={draft?.followUpOptionId ?? ''}
                onChange={(e) => setFollowUp(e.target.value)}
              >
                {step.test.followUp.options.map((opt) => (
                  <FormControlLabel
                    key={opt.id}
                    value={opt.id}
                    control={<Radio />}
                    label={t(opt.label)}
                    sx={{
                      alignItems: 'flex-start',
                      mb: 0.5,
                      '& .MuiFormControlLabel-label': { mt: 0.75 },
                    }}
                  />
                ))}
              </RadioGroup>
            </Box>
          )}
        </CardContent>
      </Card>

      <Button
        fullWidth
        variant="contained"
        size="large"
        disabled={!canNext}
        onClick={next}
        sx={{ mt: 2 }}
      >
        {index < total - 1 ? 'Test suivant' : 'Voir mon résultat'}
      </Button>
    </Box>
  );
}

function MeasureInput({
  test,
  draft,
  onChange,
}: {
  test: DiagnosticTest;
  draft: Draft | undefined;
  onChange: (rawValue: number) => void;
}) {
  if (test.measure.kind === 'level') {
    return (
      <RadioGroup
        value={draft?.rawValue ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {test.measure.levels.map((lvl) => (
          <FormControlLabel
            key={lvl.score}
            value={lvl.score}
            control={<Radio />}
            label={t(lvl.label)}
            sx={{
              alignItems: 'flex-start',
              mb: 0.5,
              '& .MuiRadioGroup-root': {},
              '& .MuiFormControlLabel-label': { mt: 0.75 },
            }}
          />
        ))}
      </RadioGroup>
    );
  }

  const unit = test.measure.kind === 'cm' ? 'cm' : 'secondes';
  return (
    <TextField
      type="number"
      fullWidth
      label={t(test.measure.prompt)}
      value={draft?.rawValue ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        if (v === '') return;
        onChange(Number(v));
      }}
      InputProps={{ endAdornment: <Typography color="text.secondary">{unit}</Typography> }}
      inputProps={{ min: 0, inputMode: 'numeric' }}
    />
  );
}

function Results({ goalId }: { goalId: string }) {
  const content = useContent();
  const navigate = useNavigate();
  const goal = content.goalById.get(goalId)!;
  const [data, setData] = useState<{ assessments: Assessment[]; followUps: FollowUpAnswer[] } | null>(
    null,
  );

  // Read back everything so the profile reflects prior tests for other goals too.
  useEffect(() => {
    Promise.all([db.assessments.toArray(), db.followUps.toArray()]).then(
      ([assessments, followUps]) => setData({ assessments, followUps }),
    );
  }, []);

  if (!data) return <LinearProgress sx={{ mt: 4 }} />;

  const factorScores = computeFactorScores(data.assessments, content, data.followUps);
  const flags = computeFlags(data.followUps, content);
  const readiness = computeGoalReadiness(goal, factorScores, content);
  // Only show factors relevant to this goal — in the goal's own weighting order,
  // so unmeasured ones still appear as "non évalué" rather than vanishing.
  const goalFactorIds = Object.keys(goal.factors) as FactorId[];

  return (
    <Box sx={{ py: 2 }}>
      <Chip color="success" label="Diagnostic terminé" sx={{ mb: 2 }} />
      <Typography variant="h1" sx={{ mb: 1 }}>
        {t(goal.name)}
      </Typography>

      <Alert severity="info" icon={false} sx={{ mb: 2, bgcolor: 'rgba(63,125,99,0.08)' }}>
        <Typography sx={{ fontWeight: 600 }}>{readiness.synthesis}</Typography>
      </Alert>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h3" sx={{ mb: 1.5 }}>
            Tes facteurs pour cet objectif
          </Typography>
          <FactorGauges scores={factorScores} factorIds={goalFactorIds} />
        </CardContent>
      </Card>

      <FlagNotes flags={flags} />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <EmojiEventsIcon color="primary" />
            <Typography variant="h3">Tes prochains jalons</Typography>
          </Stack>
          <List dense disablePadding>
            {tList(goal.milestones).map((m, i) => (
              <ListItem key={i} sx={{ px: 0 }}>
                <ListItemIcon sx={{ minWidth: 30 }}>
                  <Chip size="small" label={i + 1} />
                </ListItemIcon>
                <ListItemText primary={m} />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      <Stack spacing={1}>
        <Button variant="contained" size="large" onClick={() => navigate('/')}>
          Voir ma séance du jour
        </Button>
        <Button onClick={() => navigate('/diagnostic')}>Retour au diagnostic</Button>
      </Stack>
    </Box>
  );
}
