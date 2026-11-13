import { defineConfig } from 'vite';

// relative base so the build works on GitHub Pages (https://<user>.github.io/<repo>/)
export default defineConfig({
  base: './',
  server: { host: true },
  preview: { host: true },
  build: { target: 'es2020', assetsInlineLimit: 0 },
});
