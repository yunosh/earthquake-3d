import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  test: {
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.spec.ts'],
    environment: 'happy-dom',
  },
});
