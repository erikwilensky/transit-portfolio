import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { isPublicRoute, startSync } from './sync.js';
import './styles.css';
// With the pilot server, take its record before the first paint; without one, start from this browser's copy.
// Public share and verify pages never load the whole record (they read /api/public/*).
const render = () => createRoot(document.getElementById('root')).render(<App />);
if (isPublicRoute()) {
  render();
  const f = () => { if (!isPublicRoute()) { removeEventListener('hashchange', f); startSync(); } };
  addEventListener('hashchange', f);
} else startSync().finally(render);
