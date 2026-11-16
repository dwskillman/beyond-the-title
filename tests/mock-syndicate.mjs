// Dev-machine test helper: a stand-in for Syndicate with uploads switched on, used by tests/share-e2e.mjs.
// Serves a folder of static files (with byte ranges) and accepts the share page's uploads:
//   PUT  /submissions/<id>/<file>          (WebDAV-style, the default)
//   POST /submissions/  multipart fields: submissionId, path, part, parts, file
// Uploaded files go to a temporary folder. Reading /submissions/ back is refused (403), like a correctly
// configured server, unless config.readable is set. config.fail simulates server problems.
// Only Node built-ins. Never used by the website or the builder.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.vtt': 'text/vtt', '.mp4': 'video/mp4', '.webm': 'video/webm', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const SAFE = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;

function parseMultipart(body, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType || ''); if (!m) return null;
  const boundary = Buffer.from('--' + (m[1] || m[2])), fields = {}, files = {};
  let pos = body.indexOf(boundary);
  while (pos >= 0) {
    const next = body.indexOf(boundary, pos + boundary.length);
    if (next < 0) break;
    const part = body.subarray(pos + boundary.length + 2, next - 2); // skip CRLF after boundary, and before the next one
    const sep = part.indexOf('\r\n\r\n');
    if (sep > 0) {
      const head = part.subarray(0, sep).toString('utf8'), data = part.subarray(sep + 4);
      const name = /name="([^"]*)"/.exec(head)?.[1], filename = /filename="([^"]*)"/.exec(head)?.[1];
      if (name !== undefined) { if (filename !== undefined) files[name] = { filename, data }; else fields[name] = data.toString('utf8'); }
    }
    pos = next;
  }
  return { fields, files };
}

export function startMock({ root, uploadDir, port = 0, maxBody = 64 * 1024 * 1024 } = {}) {
  const config = { readable: false, fail: null, maxBody, overrides: {} };
  const log = [];
  const store = (id, name, data) => {
    if (!SAFE.test(id) || !SAFE.test(name)) return 400;
    mkdirSync(join(uploadDir, id), { recursive: true });
    writeFileSync(join(uploadDir, id, name), data);
    return 201;
  };
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const path = decodeURIComponent(url.pathname);
    const entry = { method: req.method, path, at: Date.now() };
    log.push(entry);
    const send = (status, body = '', headers = {}) => { entry.status = status; res.writeHead(status, Object.assign({ 'Cache-Control': 'no-store' }, headers)); res.end(body); };
    const chunks = []; let size = 0, tooBig = false;
    req.on('data', (c) => { size += c.length; if (size > config.maxBody) tooBig = true; else chunks.push(c); });
    req.on('end', () => {
      if (path.startsWith('/submissions/')) {
        const f = config.fail;
        if (f && req.method !== 'GET' && (!f.match || f.match.test(path + ' ' + req.method))) { if (f.once) config.fail = null; return send(f.status, 'simulated'); }
        if (tooBig) return send(413, 'too large');
        const body = Buffer.concat(chunks);
        if (req.method === 'PUT') {
          const parts = path.slice('/submissions/'.length).split('/');
          if (parts.length !== 2) return send(400, 'bad path');
          entry.file = parts.join('/'); entry.size = body.length;
          return send(store(parts[0], parts[1], body));
        }
        if (req.method === 'POST') {
          const mp = parseMultipart(body, req.headers['content-type']);
          if (!mp || !mp.files.file) return send(400, 'no file');
          const id = mp.fields.submissionId, name = mp.fields.path;
          entry.file = id + '/' + name; entry.size = mp.files.file.data.length; entry.fields = mp.fields;
          return send(store(id, name, mp.files.file.data));
        }
        if (req.method === 'GET' || req.method === 'HEAD') {
          if (!config.readable) return send(403, 'forbidden');
          const p = join(uploadDir, normalize(path.slice('/submissions/'.length)).replace(/^(\.\.[/\\])+/, ''));
          return existsSync(p) && statSync(p).isFile() ? send(200, readFileSync(p), { 'Content-Type': 'text/plain' }) : send(404);
        }
        return send(405, 'method not allowed');
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'method not allowed');
      if (config.overrides[path]) return send(200, config.overrides[path].body, { 'Content-Type': config.overrides[path].type });
      const file = join(root, normalize(path === '/' ? '/index.html' : path).replace(/^(\.\.[/\\])+/, ''));
      if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return send(404, 'not found');
      const data = readFileSync(file), type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (range) {
        const start = range[1] ? +range[1] : data.length - +range[2], end = range[1] && range[2] ? Math.min(+range[2], data.length - 1) : data.length - 1;
        if (start >= data.length || start > end) return send(416, '', { 'Content-Range': `bytes */${data.length}` });
        return send(206, data.subarray(start, end + 1), { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': end - start + 1 });
      }
      send(200, req.method === 'HEAD' ? '' : data, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': data.length });
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => {
    const p = server.address().port;
    resolve({ port: p, url: `http://127.0.0.1:${p}`, config, log, close: () => new Promise((r) => server.close(r)) });
  }));
}
