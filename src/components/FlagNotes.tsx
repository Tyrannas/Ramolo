import { Alert, Stack } from '@mui/material';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import { FLAG_NOTES } from '../logic/profile';
import type { TestFlag } from '../types';

/** Flags that warrant a stronger, medical-leaning treatment. */
const SEVERITY: Partial<Record<TestFlag, 'warning' | 'error' | 'info'>> = {
  'seek-professional-advice': 'error',
  'anterior-hip-impingement': 'warning',
  'knee-pain-in-rotation': 'warning',
};

/** Most-serious first, so a red banner never hides below an informational one. */
const ORDER: TestFlag[] = [
  'seek-professional-advice',
  'knee-pain-in-rotation',
  'anterior-hip-impingement',
  'patellofemoral-pain',
  'lateral-knee-pain',
  'habitual-lumbar-extension',
  'limited-hip-internal-rotation',
  'responds-to-active-work',
];

export default function FlagNotes({ flags }: { flags: Set<TestFlag> }) {
  const active = ORDER.filter((f) => flags.has(f));
  if (active.length === 0) return null;

  return (
    <Stack spacing={1} sx={{ mb: 2 }}>
      {active.map((flag) => (
        <Alert
          key={flag}
          severity={SEVERITY[flag] ?? 'info'}
          icon={flag === 'seek-professional-advice' ? <MedicalServicesIcon /> : undefined}
          variant={flag === 'seek-professional-advice' ? 'filled' : 'standard'}
        >
          {FLAG_NOTES[flag]}
        </Alert>
      ))}
    </Stack>
  );
}
