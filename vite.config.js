import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// base './' keeps asset paths relative so dist/ works from any folder or URL path.
// In dev, /api goes to the pilot server (npm run server, port 8787).
export default defineConfig({ base: './', plugins: [react()], server: { proxy: { '/api': 'http://localhost:8787' } } });
