import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, relative } from 'node:path';
const root = resolve('.'), types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost'), path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (relative(root, path).startsWith('..') || relative(root, path).split(/[\\/]/).some(p => p.startsWith('.'))) throw new Error('invalid path');
    const content = await readFile(path); res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(content);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
