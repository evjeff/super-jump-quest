import { defineConfig } from 'vite'

/**
 * When GitHub Actions deploys to GitHub Pages the site lives under
 * /<repo-name>/, so the deploy workflow sets VITE_BASE. Locally it is just "/".
 */
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  build: {
    target: 'es2022',
    // Phaser is ~500KB on its own; don't nag about it every build.
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 5173,
  },
})
