import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { applyStoredTheme } from './app/theme';
import { startSync } from './sync/sync';
import './index.css';

applyStoredTheme();
// Synchronisation Supabase (sans effet si .env.local n'est pas configuré).
startSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
