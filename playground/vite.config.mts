import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: dirname(fileURLToPath(import.meta.url)),
  // Relative asset paths, so the build works under any GitHub Pages sub-path.
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
});
