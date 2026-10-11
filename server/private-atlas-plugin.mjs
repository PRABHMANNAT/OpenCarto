import { existsSync } from 'node:fs';
import { privateAtlasHandler } from './private-atlas.mjs';
export function privateAtlasPlugin() {
  if (existsSync('.env.local')) process.loadEnvFile('.env.local');
  const install = (server) => {
    server.middlewares.use((req, res, next) => {
      let path;
      try {
        path = decodeURIComponent(
          new URL(req.url, 'http://localhost').pathname,
        ).replace(/\\/g, '/');
      } catch {
        res.statusCode = 400;
        res.end();
        return;
      }
      if (
        /(^|\/)private\//i.test(path) ||
        /private-atlas\.enc$/i.test(path) ||
        /(^|\/)\.env(?:\.|$)/i.test(path)
      ) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      next();
    });
    server.middlewares.use('/api/private-atlas', (req, res) => {
      void privateAtlasHandler(req, res);
    });
  };
  return {
    name: 'private-atlas-api',
    configureServer: install,
    configurePreviewServer: install,
  };
}
