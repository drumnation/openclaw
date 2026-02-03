import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 18800,
    host: true,
  },
  preview: {
    port: 18800,
    host: true,
  },
});
