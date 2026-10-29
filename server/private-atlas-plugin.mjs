import { existsSync } from 'node:fs';
import {alternateWorldHandler} from './alternate-world.mjs';
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
        /(?:alternate-world-(?:overrides|tibet)|india-punjab-world-overrides)\.geojson$/i.test(path) ||
        /(^|\/)atlas-runtime(?:\/|$)/i.test(path) ||
        /(^|\/)\.env(?:\.|$)/i.test(path)
      ) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      next();
    });
    server.middlewares.use('/api/alternate-world', (req,res)=>{void alternateWorldHandler(req,res);});
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
