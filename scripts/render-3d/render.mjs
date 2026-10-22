// Renders every icon in icons.js to src/assets/3d/<name>.webp.
// Usage: node scripts/render-3d/render.mjs [name ...] [--sheet out.png]
// Needs Playwright with Chromium (WebGL2 runs on SwiftShader headless).
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const outDir = join(root, 'src/assets/3d');
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(join(process.env.PLAYWRIGHT_GLOBAL ?? '/opt/node22/lib/node_modules', 'playwright')));
}

const args = process.argv.slice(2);
const sheetAt = args.indexOf('--sheet');
const sheet = sheetAt >= 0 ? args.splice(sheetAt, 2)[1] : null;
const only = args;

const types = { '.js': 'text/javascript', '.html': 'text/html', '.hdr': 'application/octet-stream', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  try {
    const path = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!path.startsWith(root)) throw new Error('outside');
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', (m) => m.type() === 'error' && console.error('page:', m.text()));
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`http://localhost:${port}/scripts/render-3d/index.html`);
const names = await page.evaluate(() => window.studio.ready);
await mkdir(outDir, { recursive: true });
const done = [];
for (const name of names) {
  if (only.length && !only.includes(name)) continue;
  const t = Date.now();
  const url = await page.evaluate((n) => window.studio.render(n), name);
  await writeFile(join(outDir, `${name}.webp`), Buffer.from(url.split(',')[1], 'base64'));
  done.push(name);
  console.log(`${name}  ${Date.now() - t}ms`);
}
if (sheet) {
  // contact sheet on light and dark grounds, for review
  const cells = done.map((n) => `<figure><img src="/src/assets/3d/${n}.webp"><figcaption>${n}</figcaption></figure>`).join('');
  await page.setContent(`<style>body{margin:0;display:grid;grid-template-columns:1fr 1fr;font:12px monospace}
    section{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:12px}
    section:first-child{background:#eef1f0;color:#123}section:last-child{background:#0a1322;color:#ccd}
    figure{margin:0;text-align:center}img{width:100%}</style>
    <base href="http://localhost:${port}/"><section>${cells}</section><section>${cells}</section>`);
  await page.setViewportSize({ width: 1600, height: 400 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: sheet, fullPage: true });
}
await browser.close();
server.close();
