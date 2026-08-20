import swc from "unplugin-swc";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), swc.vite(), swc.rollup()],
  test: {
    coverage: {
      exclude: ["src/**/*.spec.ts", "src/**/*.integration.spec.ts"],
      include: ["src/**/*.ts"],
      provider: "v8",
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          exclude: ["build", "node_modules", "src/**/*.integration.spec.ts"],
          include: ["src/**/*.spec.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          exclude: ["build", "node_modules"],
          fileParallelism: false,
          globalSetup: "specs/integration.setup.ts",
          include: ["src/**/*.integration.spec.ts"],
        },
      },
    ],
  },
});
