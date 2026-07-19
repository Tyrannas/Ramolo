import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import App from './App';
import { theme } from './theme';
import { ContentProvider } from './ContentContext';
import { routerBasename } from './basename';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ContentProvider>
        <BrowserRouter basename={routerBasename}>
          <App />
        </BrowserRouter>
      </ContentProvider>
    </ThemeProvider>
  </StrictMode>,
);
