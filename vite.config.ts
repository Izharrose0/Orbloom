import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path for GitHub Pages: served from /<repo-name>/
// Override with VITE_BASE=/ when deploying to a custom domain or root host.
const base = process.env.VITE_BASE ?? '/orbloom/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});
