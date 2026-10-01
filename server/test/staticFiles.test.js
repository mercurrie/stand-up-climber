import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createStaticHandler } from '../src/staticFiles.js';

let dir;
let server;
let base;

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'suc-static-'));
  const root = path.join(dir, 'dist');
  await mkdir(path.join(root, 'assets'), { recursive: true });
  await writeFile(path.join(root, 'index.html'), '<h1>game</h1>');
  await writeFile(path.join(root, 'assets', 'app-abc123.js'), 'console.log(1)');
  await writeFile(path.join(dir, 'secret.txt'), 'nope');

  const serve = createStaticHandler(root);
  server = http.createServer(async (req, res) => {
    if (!(await serve(req, res))) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.close();
  await rm(dir, { recursive: true, force: true });
});

/** Raw request, so paths like /../ aren't normalised away by fetch(). */
function get(rawPath) {
  return new Promise((resolve, reject) => {
    http.get(`${base}${rawPath}`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

test('serves index.html at / with no-cache', async () => {
  const res = await get('/?room=K7F2');
  assert.equal(res.status, 200);
  assert.equal(res.body, '<h1>game</h1>');
  assert.match(res.headers['content-type'], /text\/html/);
  assert.equal(res.headers['cache-control'], 'no-cache');
});

test('serves hashed assets with long-lived caching', async () => {
  const res = await get('/assets/app-abc123.js');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /javascript/);
  assert.match(res.headers['cache-control'], /immutable/);
});

test('refuses paths outside the root', async () => {
  for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/assets/../../secret.txt']) {
    const res = await get(p);
    assert.equal(res.status, 404, p);
    assert.notEqual(res.body, 'nope', p);
  }
});

test('missing files fall through', async () => {
  assert.equal((await get('/nope.js')).status, 404);
});
