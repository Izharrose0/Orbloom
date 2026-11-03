var _a;
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Base path for GitHub Pages: served from /<repo-name>/
// Override with VITE_BASE=/ when deploying to a custom domain or root host.
var base = (_a = process.env.VITE_BASE) !== null && _a !== void 0 ? _a : '/orbloom/';
export default defineConfig({
    base: base,
    plugins: [react()],
    server: {
        host: true,
        port: 5173,
    },
});
