import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// base './' keeps asset paths relative so dist/ works from any folder or URL path.
// In dev, /api goes to the pilot server (npm run server, port 8787). `vite preview` stays a plain
// static host with no /api, so it shows the no-server fallback (the record saved in the browser).
export default defineConfig({ base: './', plugins: [react()], server: { proxy: { '/api': 'http://localhost:8787' } }, preview: { proxy: {} } });
