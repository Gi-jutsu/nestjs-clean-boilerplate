import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths(), swc.vite(), swc.rollup()],
  test: {
    coverage: {
      enabled: true,
      include: ['src/**/*.ts'],
      provider: 'v8',
    },
    exclude: ['build', 'node_modules'],
    fileParallelism: false,
    globalSetup: 'specs/integration.setup.ts',
    include: ['src/**/*.integration.spec.ts'],
  },
});
