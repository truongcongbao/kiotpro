import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safely ignore non-fatal state transition errors from third-party camera scanners
window.addEventListener('unhandledrejection', (event) => {
  const reason = String(event.reason || '');
  if (
    reason.includes('Cannot transition to a new state') ||
    reason.includes('Cannot stop, scanner is not running')
  ) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
