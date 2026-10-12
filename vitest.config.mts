import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const sharedExclude = ["**/node_modules/**", "**/.next/**", "**/dist/**"];

export default defineConfig({
  plugins: [react()],
  resolve: {
    // honours the "@/*" -> "./src/*" alias from tsconfig.json
    tsconfigPaths: true,
  },
  test: {
    // Deterministic date assertions regardless of the machine's timezone.
    env: { TZ: "UTC" },
    // Three projects so each suite runs in the right environment:
    // - unit:        pure logic in src (node, fast)
    // - ui:          component tests with Testing Library (jsdom)
    // - integration: API route handlers against mocked Prisma/fetch (node)
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["**/*.int.test.ts", ...sharedExclude],
          setupFiles: ["./src/test/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./src/test/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.int.test.ts"],
          setupFiles: ["./src/test/setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/*.int.test.ts",
        "src/test/**",
        "src/**/*.d.ts",
      ],
    },
  },
});
