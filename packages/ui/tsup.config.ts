import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // Code-splitting for ESM: dynamic imports are split into separate chunks so
  // consumers only download the renderers they actually use.
  splitting: true,
  // Minify output to reduce bundle size.
  minify: true,
  // JSX handled by tsup's built-in esbuild transform
  esbuildOptions(options) {
    options.jsx = 'automatic';
    // Inline NODE_ENV so bundlers can eliminate dev-only code paths.
    options.define = {
      ...options.define,
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    };
  },
  external: ['react', 'react-dom', '@hari/core'],
  outDir: 'dist',
});
