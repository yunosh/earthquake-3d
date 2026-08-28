import { defineConfig, type Plugin } from 'vite';

/**
 * Removes the `crossorigin` attribute from generated <script>/<link> tags.
 * Vite adds crossorigin to module scripts and stylesheet links, which breaks
 * asset loading when the build is opened via file:// (CORS check fails because
 * file:// has no real origin). Over HTTP the attribute is unnecessary since
 * assets are same-origin. Removing it makes the static build work in both cases.
 */
function stripCrossOrigin(): Plugin {
  return {
    name: 'strip-crossorigin',
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin/g, '');
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [stripCrossOrigin()],
  test: {
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.spec.ts'],
    environment: 'happy-dom',
  },
});
