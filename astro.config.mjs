import { defineConfig } from 'astro/config';
export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  vite: { build: {
    // The page CSP allows executable scripts only from this origin.
    assetsInlineLimit: (filePath) => /\.js$/i.test(filePath) ? false : undefined,
  } },
});
