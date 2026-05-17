import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://forex.abhishekm.in',
  build: {
    format: 'directory',
  },
});
