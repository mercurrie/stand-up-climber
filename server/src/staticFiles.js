import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
};

/**
 * Serves the built client (client/dist) so the whole game can run from one
 * URL on one host. Deliberately tiny: GET/HEAD only, no directory listings,
 * and anything outside `root` is refused.
 *
 * Vite puts content-hashed files under /assets/, so those can be cached
 * forever; index.html is never cached so new deploys show up immediately.
 *
 * Returns a request handler that resolves true if it served the request.
 */
export function createStaticHandler(root) {
  const rootDir = path.resolve(root);

  return async function serveStatic(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      return false;
    }
    if (pathname.endsWith('/')) pathname += 'index.html';

    const filePath = path.resolve(rootDir, `.${pathname}`);
    if (filePath !== rootDir && !filePath.startsWith(rootDir + path.sep)) return false;

    const info = await stat(filePath).catch(() => null);
    if (!info?.isFile()) return false;

    const isHashedAsset = pathname.startsWith('/assets/');
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(filePath).pipe(res);
    return true;
  };
}
