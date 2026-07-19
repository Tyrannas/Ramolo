import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Content, loadContent } from './data/content';

const Ctx = createContext<Content | null>(null);

export function ContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<Content | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadContent()
      .then((bundle) => setContent(new Content(bundle)))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="error">Erreur de chargement des données : {error}</Typography>
      </Box>
    );
  }

  if (!content) {
    return (
      <Box
        sx={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return <Ctx.Provider value={content}>{children}</Ctx.Provider>;
}

export function useContent(): Content {
  const c = useContext(Ctx);
  if (!c) throw new Error('useContent must be used within ContentProvider');
  return c;
}
