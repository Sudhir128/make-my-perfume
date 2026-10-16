import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    // Vitest blanks CSS by default, even with ?raw. The contrast test reads the
    // real token file, so let it through.
    css: { include: [/tokens\.css/] },
  },
});
