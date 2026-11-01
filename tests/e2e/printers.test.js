/* اختبار طرفي: كتالوج الطابعات — إضافة الماركات وتعديلها وحذفها.
   - زر حذف ظاهر لكل ماركة، وحذف من نافذة التعديل (كان الحذف بنقر مزدوج خفي فقط)
   - الماركة المحذوفة تختفي من نموذج البلاغ على كل الأجهزة، ولا تُحذف آخر ماركة
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/printers.test.js */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/';
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const login = async (u) => {
    const c = await b.newContext({ viewport: { width: 1400, height: 900 } }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} });
    const p = await c.newPage(); p.on('pageerror', (e) => errs.push(`${u}: ${e.message}`)); p.setDefaultTimeout(20000);
    await p.goto(BASE); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', u); await p.fill('[name="password"]', 'Passw0rd!'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.App && App.Auth.user); await p.waitForTimeout(1200); return p;
  };
  const sync = (p) => p.evaluate(async () => { await App.Sync.flush(); await App.Sync.pull(); await App.Data.refresh('printers'); });
  const brands = (p) => p.evaluate(() => App.Data.list('printers').map((x) => x.name));
  const formBrands = (p) => p.evaluate(() => (App.Forms.def('printer').find((f) => f.k === 'brand') || {}).o || []);
  const S = await login('sup');
  const go = async () => { await S.evaluate(() => { location.hash = '#/dashboard'; }); await S.waitForTimeout(300); await S.evaluate(() => { location.hash = '#/printers'; }); await S.waitForSelector('[data-pcb]'); await S.waitForTimeout(500); };
  await go(); await sync(S); await go();
  const start = await brands(S);
  ok('the catalog lists brands, each with a visible delete button', start.length >= 3 && (await S.$$eval('[data-pcdel="brand"]', (x) => x.length)) === start.length, start.join('، '));
  /* 1) الحذف من زر الماركة */
  const victim = start.find((n) => /Kyocera/i.test(n)) || start[start.length - 1];
  const vid = await S.evaluate((n) => App.Data.list('printers').find((x) => x.name === n).id, victim);
  await S.click(`[data-pcdel="brand"][data-id="${vid}"]`); await S.waitForSelector('dialog [data-i="1"]');
  ok('deleting asks first and explains that old tickets are not affected', /البلاغات السابقة لا تتأثر/.test(await S.textContent('dialog')));
  await S.click('dialog [data-i="1"]'); await S.waitForTimeout(800); await sync(S);
  ok('the brand is removed from the catalog', !(await brands(S)).includes(victim));
  ok('and from the printer ticket form', !(await formBrands(S)).includes(victim), (await formBrands(S)).join('، '));
  /* 2) إضافة ماركة، وإعادة تسميتها، ثم حذفها من نافذة التعديل */
  await S.click('[data-pcadd="brand"]'); await S.waitForSelector('dialog [name="name"]'); await S.fill('dialog [name="name"]', 'Pantum'); await S.click('dialog .btn-primary'); await S.waitForTimeout(800);
  ok('a new brand is added and offered in the ticket form', (await brands(S)).includes('Pantum') && (await formBrands(S)).includes('Pantum'));
  let bro = await S.evaluate(() => App.Data.list('printers').find((x) => x.name === 'Pantum').id);
  await S.click(`[data-pcedit="brand"][data-id="${bro}"]`); await S.waitForSelector('dialog [name="name"]'); await S.fill('dialog [name="name"]', 'Pantum Global'); await S.click('dialog .btn-primary'); await S.waitForTimeout(800);
  ok('a brand is renamed', (await brands(S)).includes('Pantum Global') && !(await brands(S)).includes('Pantum'));
  await S.click(`[data-pcedit="brand"][data-id="${bro}"]`); await S.waitForSelector('dialog .btn-danger'); await S.click('dialog .btn-danger'); await S.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 2); await S.locator('dialog[open]').last().locator('[data-i="1"]').click(); await S.waitForTimeout(800);
  ok('a brand is deleted from its edit dialog', !(await brands(S)).includes('Pantum Global'));
  /* 3) الحذف يصل الأجهزة الأخرى */
  const T = await login('tech'); await sync(T);
  ok('another device no longer offers the deleted brand', !(await formBrands(T)).includes(victim) && !(await brands(T)).includes(victim));
  /* 4) لا تُحذف آخر ماركة */
  const rest = await S.evaluate(() => App.Data.list('printers').map((x) => x.id));
  const msg = await S.evaluate(async (ids) => { for (const id of ids.slice(1)) await App.PrintCat.remove(id); try { await App.PrintCat.remove(ids[0]); return 'deleted'; } catch (e) { return e.message; } }, rest);
  ok('the last brand cannot be deleted, with a hint to hide instead', /ماركة واحدة على الأقل/.test(msg), msg);
  /* إعادة الماركات المحذوفة حتى لا تتأثر الاختبارات الأخرى */
  await S.evaluate(async () => { const keep = App.Data.list('printers')[0]; await App.DB.put('meta', { key: 'seed:printcat', value: 0 }); await App.PrintCat.seed(); await App.Sync.flush(); return keep; });
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
