import { Box, Stack, Tooltip, Typography } from '@mui/material';
import type { SessionLog } from '../db';
import { localDay } from '../logic/schedule';

/** A GitHub-style heatmap of the last ~12 weeks of training days. */
export default function ConsistencyCalendar({ sessions }: { sessions: SessionLog[] }) {
  const WEEKS = 12;
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    const d = localDay(s.date);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }

  // Build columns of 7 days ending today, oldest first.
  const today = new Date();
  const days: { key: string; count: number; date: Date }[] = [];
  for (let i = WEEKS * 7 - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = localDay(d);
    days.push({ key, count: byDay.get(key) ?? 0, date: d });
  }

  const columns: (typeof days)[] = [];
  for (let i = 0; i < days.length; i += 7) columns.push(days.slice(i, i + 7));

  const color = (count: number) => {
    if (count === 0) return 'rgba(32,48,42,0.07)';
    if (count === 1) return 'rgba(63,125,99,0.45)';
    return 'rgba(63,125,99,0.9)';
  };

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Stack direction="row" spacing={0.5} sx={{ minWidth: 'min-content', pb: 1 }}>
        {columns.map((col, ci) => (
          <Stack key={ci} spacing={0.5}>
            {col.map((d) => (
              <Tooltip
                key={d.key}
                title={`${d.date.toLocaleDateString('fr-FR')} — ${d.count} séance${d.count > 1 ? 's' : ''}`}
                arrow
              >
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: 0.5,
                    bgcolor: color(d.count),
                    flexShrink: 0,
                  }}
                />
              </Tooltip>
            ))}
          </Stack>
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        12 dernières semaines
      </Typography>
    </Box>
  );
}
