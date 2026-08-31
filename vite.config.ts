import { defineConfig } from 'vite';

// Static, client-only bundle (NFR1, R4.1) — no server runtime.
export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: { outDir: 'dist', target: 'es2020' },
  test: {
    globals: true,
    // All unit-tested modules are pure (rules, features, classify, round) — node env is enough.
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
