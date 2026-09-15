import React from 'react';
import ReactDOM from 'react-dom/client';
import { configureMsal } from './services/msalAuth';
import './styles.css';

async function startApp() {
  try {
    const response = await fetch('/api/config');
    if (response.ok) configureMsal(await response.json());
  } catch {
    // Static hosting may not provide /api/config; build-time env remains valid.
  }

  const { default: App } = await import('./App');
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void startApp();
