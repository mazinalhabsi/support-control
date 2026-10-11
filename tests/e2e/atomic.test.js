/* اختبار طرفي (Playwright) على خادم تجريبي فيه الحسابات sup و dep و tech بكلمة المرور Passw0rd!
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/<name>.test.js */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php', U = BASE;
const api = async (a, body, tok, q = '') => { const r = await fetch(`${B}?a=${a}${q}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return r.json().catch(() => ({})); };
const res = []; const ok = (name, cond, info = '') => res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);
(async () => {
  const sup = (await api('login', { username: 'sup', password: 'Passw0rd!' })).token, T = Date.now();
  /* 1) على مستوى الخادم: مجموعة فيها تعارض لا يُحفظ منها شيء */
  const sid = `wh_at|it_at_${T}`;
  const R0 = (await api('push', { ops: [{ store: 'stock', id: sid, rev: 0, data: { warehouseId: 'wh_at', itemId: `it_at_${T}`, qty: 10 } }] }, sup)).applied[0].rev;
  const a = await api('push', { ops: [{ store: 'stock', id: sid, rev: R0, g: 'gA', data: { warehouseId: 'wh_at', itemId: `it_at_${T}`, qty: 9 } }, { store: 'movements', id: `mv_a_${T}`, rev: 0, g: 'gA', data: { id: `mv_a_${T}`, delta: -1 } }] }, sup);
  const b = await api('push', { ops: [{ store: 'stock', id: sid, rev: R0, g: 'gB', data: { warehouseId: 'wh_at', itemId: `it_at_${T}`, qty: 9 } }, { store: 'movements', id: `mv_b_${T}`, rev: 0, g: 'gB', data: { id: `mv_b_${T}`, delta: -1 } }] }, sup);
  ok('first device: balance and movement saved together', a.applied.length === 2 && !a.conflicts.length);
  ok('second device: nothing saved (no orphan movement)', b.applied.length === 0 && b.conflicts.length === 2, JSON.stringify(b.conflicts.map((c) => [c.store, c.reason, c.deleted])));
  ok('the new movement is returned as deleted so the device removes it', (b.conflicts.find((c) => c.store === 'movements') || {}).deleted === 1);
  await api('push', { ops: [{ store: 'stock', id: sid, rev: -1, deleted: 1 }, { store: 'movements', id: `mv_a_${T}`, rev: -1, deleted: 1 }] }, sup);
  /* 2) في المتصفح: جهازان يصرفان من الرصيد نفسه في اللحظة نفسها */
  const br = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const page = async () => { const c = await br.newContext({ viewport: { width: 1300, height: 860 } }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} }); const p = await c.newPage(); p.setDefaultTimeout(30000);
    await p.goto(U); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', 'sup'); await p.fill('[name="password"]', 'Passw0rd!'); await p.keyboard.press('Enter'); await p.waitForFunction(() => window.App && App.Auth.user); await p.waitForTimeout(1500); return p; };
  const A = await page();
  const setup = await A.evaluate(async (T) => { const D = App.Data, wh = D.list('warehouses')[0]; const it = await D.inv.saveItem({ name: 'صنف التزامن ' + T, categoryId: D.list('itemCategories')[0].id, unit: 'قطعة' }); await D.inv.move({ type: 'receive', itemId: it.id, warehouseId: wh.id, qty: 10, note: 'افتتاحي' }); await App.Sync.waitIdle(8000); return { itemId: it.id, wh: wh.id }; }, T);
  const Bp = await page();
  await Bp.waitForFunction((id) => App.DB.get('items', id).then((x) => !!x), setup.itemId, { timeout: 20000 });
  /* الجهاز الثاني منقطع لحظياً: لا يسحب ولا يرفع حتى يصرف بنسخته القديمة */
  let release; const gate = new Promise((r) => { release = r; });
  await Bp.route(/a=(pull|push)/, async (r) => { await gate; try { await r.continue(); } catch (_) {} });
  await A.evaluate(async (s) => { await App.Data.inv.move({ type: 'issue', itemId: s.itemId, warehouseId: s.wh, qty: 1, note: 'صرف الجهاز الأول' }); await App.Sync.waitIdle(8000); }, setup);
  await Bp.evaluate((s) => { window.__conf = []; const r0 = App.Sync.resolve.bind(App.Sync); App.Sync.resolve = async (c) => { window.__conf.push(...c.map((x) => `${x.store}:${x.reason}`)); return r0(c); }; return App.Data.inv.move({ type: 'issue', itemId: s.itemId, warehouseId: s.wh, qty: 1, note: 'صرف الجهاز الثاني' }); }, setup);
  release(); await Bp.unroute(/a=(pull|push)/);
  await Bp.evaluate(async () => { App.Sync.flush(); await App.Sync.waitIdle(10000); await new Promise((r) => setTimeout(r, 1500)); });
  const conf = await Bp.evaluate(() => window.__conf);
  const server = await A.evaluate(async (s) => { await App.Sync.pull(); const st = await App.DB.get('stock', [s.wh, s.itemId]); const mv = (await App.DB.getAll('movements')).filter((m) => m.itemId === s.itemId && m.type === 'issue'); return { qty: st.qty, issues: mv.length }; }, setup);
  ok('server after concurrent issue: balance matches recorded movements', server.qty === 9 && server.issues === 1, JSON.stringify(server));
  ok('second device was told and rolled back', conf.length > 0, JSON.stringify(conf));
  const local = await Bp.evaluate(async (s) => { const st = await App.DB.get('stock', [s.wh, s.itemId]); const mv = (await App.DB.getAll('movements')).filter((m) => m.itemId === s.itemId && m.type === 'issue'); return { qty: st.qty, issues: mv.length }; }, setup);
  ok('second device now shows the true balance and no ghost movement', local.qty === 9 && local.issues === 1, JSON.stringify(local));
  /* إعادة المحاولة على البيانات الصحيحة تنجح */
  await Bp.evaluate(async (s) => { await App.Data.inv.move({ type: 'issue', itemId: s.itemId, warehouseId: s.wh, qty: 1, note: 'إعادة المحاولة' }); await App.Sync.waitIdle(8000); }, setup);
  const after = await A.evaluate(async (s) => { await App.Sync.pull(); const st = await App.DB.get('stock', [s.wh, s.itemId]); const mv = (await App.DB.getAll('movements')).filter((m) => m.itemId === s.itemId && m.type === 'issue'); return { qty: st.qty, issues: mv.length }; }, setup);
  ok('retry on fresh data succeeds', after.qty === 8 && after.issues === 2, JSON.stringify(after));
  console.log(res.join('\n'));
  await br.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
