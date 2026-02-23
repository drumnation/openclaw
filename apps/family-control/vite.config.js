import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 18802,
    host: true,
    allowedHosts: true,
  },
  preview: {
    port: 18802,
    host: true,
    allowedHosts: true,
  },
});
