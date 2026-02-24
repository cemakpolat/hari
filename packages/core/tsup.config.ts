import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // Code-splitting for ESM so schema-only consumers don't pull in transport code.
  splitting: true,
  // Minify for smaller bundle size.
  minify: true,
  // External dependencies — consumers bring their own React and Zod
  external: ['react', 'react-dom', 'zod', 'zustand', 'immer'],
  outDir: 'dist',
});
