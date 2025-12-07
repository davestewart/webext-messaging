import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/lib/index.ts',
  ],
  outDir: 'dist',
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  minify: false,
})
