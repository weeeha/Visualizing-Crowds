import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Two pages: the original pile and the ranking. Paths resolve against the project root.
    rollupOptions: { input: { main: 'index.html', ranking: 'ranking.html' } },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
