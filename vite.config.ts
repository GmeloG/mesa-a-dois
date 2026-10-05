import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
  // Relative paths work both at username.github.io/ and /repository/.
  base: './',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  server: { host: '0.0.0.0', allowedHosts: ['terminal.local'], port: 5173 },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
});
