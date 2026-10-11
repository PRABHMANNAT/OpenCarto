import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { privateAtlasPlugin } from './server/private-atlas-plugin.mjs';

export default defineConfig({
  plugins: [react(), privateAtlasPlugin()],
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  server: {
    fs: {
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem}',
        '**/.git/**',
        '**/private/**',
        '**/server/private-atlas.enc',
      ],
    },
  },
  build: { outDir: 'dist-vercel', emptyOutDir: true },
});
