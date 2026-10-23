import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function syncHotspotsPlugin(): Plugin {
  return {
    name: 'sync-hotspots-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/sync-hotspots') {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk;
            });
            req.on('end', async () => {
              try {
                const {hotspots} = JSON.parse(body);
                if (Array.isArray(hotspots)) {
                  const indexPath = path.resolve(import.meta.dirname, 'index.html');
                  let html = await fs.promises.readFile(indexPath, 'utf-8');

                  hotspots.forEach((h: {id: string; x: number; y: number}) => {
                    if (!h || !h.id || typeof h.x !== 'number' || typeof h.y !== 'number') return;
                    const itemRegex = new RegExp(
                      `(\\{\\s*id:\\s*"${h.id}"[\\s\\S]*?x:\\s*)[0-9.]+(\\s*,\\s*y:\\s*)[0-9.]+`
                    );
                    html = html.replace(itemRegex, `$1${h.x}$2${h.y}`);
                  });

                  await fs.promises.writeFile(indexPath, html, 'utf-8');
                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = 200;
                  res.end(JSON.stringify({success: true, message: 'Hotspots written to index.html', hotspots}));
                  return;
                }
              } catch (err) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 500;
                res.end(JSON.stringify({success: false, error: String(err)}));
                return;
              }
            });
            return;
          } else if (req.method === 'GET') {
            try {
              const indexPath = path.resolve(import.meta.dirname, 'index.html');
              const html = await fs.promises.readFile(indexPath, 'utf-8');
              const match = html.match(/hotspots:\s*(\[[\s\S]*?\]),\s*storageKey:/);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({success: true, raw: match ? match[1] : null}));
              return;
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({error: String(err)}));
              return;
            }
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), syncHotspotsPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

