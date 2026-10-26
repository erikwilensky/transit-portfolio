import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// base './' keeps asset paths relative so dist/ works from any folder or URL path.
export default defineConfig({ base: './', plugins: [react()] });
