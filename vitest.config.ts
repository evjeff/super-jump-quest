import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Only the pure game-rules layer is held to a coverage bar. Phaser scene
      // glue is covered by the Playwright smoke test instead, because mocking a
      // renderer to hit a coverage number teaches nobody anything.
      include: ['src/game/**/*.ts'],
      exclude: ['src/game/**/*.test.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
})
