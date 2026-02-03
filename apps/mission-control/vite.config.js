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
    allowedHosts: ['gordon.singularity-labs.org', 'localhost', '127.0.0.1'],
  },
  preview: {
    port: 18800,
    host: true,
    allowedHosts: ['gordon.singularity-labs.org', 'localhost', '127.0.0.1'],
  },
});
