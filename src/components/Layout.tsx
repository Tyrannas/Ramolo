import { BottomNavigation, BottomNavigationAction, Box, Paper } from '@mui/material';
import TodayIcon from '@mui/icons-material/WbSunny';
import AssessmentIcon from '@mui/icons-material/Insights';
import TimelineIcon from '@mui/icons-material/ShowChart';
import LibraryIcon from '@mui/icons-material/FitnessCenter';
import SettingsIcon from '@mui/icons-material/Settings';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const NAV = [
  { label: 'Aujourd’hui', value: '/', icon: <TodayIcon /> },
  { label: 'Diagnostic', value: '/diagnostic', icon: <AssessmentIcon /> },
  { label: 'Progrès', value: '/progress', icon: <TimelineIcon /> },
  { label: 'Exercices', value: '/library', icon: <LibraryIcon /> },
  { label: 'Réglages', value: '/settings', icon: <SettingsIcon /> },
];

function currentTab(pathname: string): string {
  const match = NAV.slice(1).find((n) => pathname.startsWith(n.value));
  return match ? match.value : '/';
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const value = currentTab(location.pathname);

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', pb: '72px' }}>
      <Box
        component="main"
        sx={{
          flex: 1,
          width: '100%',
          maxWidth: 640,
          mx: 'auto',
          px: { xs: 2.5, sm: 4 },
          pt: 'max(24px, env(safe-area-inset-top))',
          pb: 2,
        }}
      >
        <Outlet />
      </Box>

      <Paper
        elevation={3}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          borderTop: '1px solid rgba(32,48,42,0.08)',
          pb: 'env(safe-area-inset-bottom)',
          zIndex: 10,
        }}
      >
        <BottomNavigation
          showLabels
          value={value}
          onChange={(_, v) => navigate(v)}
          sx={{ maxWidth: 640, mx: 'auto', bgcolor: 'transparent' }}
        >
          {NAV.map((n) => (
            <BottomNavigationAction
              key={n.value}
              label={n.label}
              value={n.value}
              icon={n.icon}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
