import { defineConfig } from 'vitest/config'

// Unit tests cover the plan maths (pure functions), so they run in Node without the app's Vite plugins
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
