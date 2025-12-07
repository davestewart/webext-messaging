import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/lib/index.ts',
    'src/vite/index.ts',
    'src/wxt/index.ts',
  ],
  outDir: 'dist',
  format: ['esm'],
  external: ['vite', 'wxt', 'ts-morph', 'glob', 'webext-message-router'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  minify: false,
})
