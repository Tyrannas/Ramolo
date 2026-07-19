import { createTheme } from '@mui/material/styles';

// Calm, warm, non-clinical palette. Green = movement/nature, sand background.
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#3f7d63', light: '#6ba585', dark: '#2c5a47', contrastText: '#ffffff' },
    secondary: { main: '#c9743d', contrastText: '#ffffff' },
    background: { default: '#faf9f6', paper: '#ffffff' },
    text: { primary: '#20302a', secondary: '#5a6b63' },
    success: { main: '#3f7d63' },
    warning: { main: '#e0a341' },
    error: { main: '#d8624b' },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    h1: { fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.01em' },
    h3: { fontSize: '1.1rem', fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: '1px solid rgba(32,48,42,0.08)' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 999, paddingInline: 18 } },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
  },
});
