/* اختبار طرفي: عرض الفروع داخل المخطط الشجري.
   - لكل إدارة أو فرع طريقة لعرض ما يتبعه: حسب العرض العام، أو عكسه (ينعكس معه إذا تغيّر)، أو قائمة أو شبكة مضغوطة دائماً
   - تُحفظ على الخادم فيراها الجميع، ويمكن تطبيقها على كل الفروع من النوع نفسه في الإدارة
   - «ضغط الكثير» يضغط ما يتجاوز 12 فرعاً ما لم يُحدَّد له «حسب العرض العام»
   - زر خانة الإضافة الداخلية يسمي ما يضيفه («قسم تابع»، «شعبة تابعة»…) بدل «تحته»
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/orglayout.test.js */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php';
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return r.json().catch(() => ({})); };
const pull = async (tok) => { let since = 0; const out = []; for (;;) { const r = await fetch(`${B}?a=pull&since=${since}&limit=3000`, { headers: { 'X-Token': tok } }).then((x) => x.json()); out.push(...r.docs); since = r.rev; if (!r.more) return out; } };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
(async () => {
  const T = String(Date.now() % 100000), sup0 = (await api('login', { username: 'sup', password: 'Passw0rd!' })).token;
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const open = async (dir) => {
    const c = await b.newContext({ viewport: { width: 1440, height: 1100 } }); await c.addInitScript((dir) => { try { localStorage.setItem('sq_motion', 'off'); localStorage.setItem('sq_org_mode', 'chart'); localStorage.setItem('sq_org_dir', dir); localStorage.setItem('sq_org_compact', '0'); } catch (_) {} }, dir);
    const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); p.setDefaultTimeout(25000);
    await p.goto(BASE); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', 'sup'); await p.fill('[name="password"]', 'Passw0rd!'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.App && App.Auth.user); await p.waitForTimeout(1200); return p;
  };
  const S = await open('down');
  const go = async (p = S) => { await p.evaluate(() => { location.hash = '#/dashboard'; }); await p.waitForTimeout(250); await p.evaluate(() => { location.hash = '#/org'; }); await p.waitForSelector('[data-act="full"]'); await p.waitForTimeout(700); };
  /* إدارة فيها قسمان كل منهما 20 فصلاً، وقسم ثالث 15 فصلاً */
  const cls = (n) => Array.from({ length: n }, (_, i) => `    فصل ${i + 1}`).join('\n');
  const ids = await S.evaluate(async ({ T, text }) => {
    await App.Data.org.buildOutline(App.Data.org.planOutline(text));
    const d = App.Data.list('departments').find((x) => x.name === `الكلية ${T}`), u = await App.DB.getAll('deptUnits'), f = (n) => u.find((x) => x.departmentId === d.id && x.name === n).id;
    return { d: d.id, a: f('قسم السنة الأولى'), b: f('قسم السنة الثانية'), c: f('قسم الدورات') };
  }, { T, text: `الكلية ${T}\n  قسم السنة الأولى\n${cls(20)}\n  قسم السنة الثانية\n${cls(20)}\n  قسم الدورات\n${cls(15)}` });
  await S.evaluate(() => App.Sync.flush()); await go(); await S.fill('#oq', `الكلية ${T}`); await S.waitForTimeout(900);
  const width = () => S.evaluate(() => document.querySelector('.oc').scrollWidth);
  const w0 = await width();
  ok('a branch with several branches under it has a «how to show them» button', !!(await S.$(`[data-kv="u:${ids.a}"]`)) && !!(await S.$(`[data-kv="d:${ids.d}"]`)));
  /* 1) عكس العرض العام لقسم السنة الأولى */
  const choose = async (key, val, all = false) => { await S.click(`[data-kv="${key}"]`); await S.waitForSelector('dialog .kv-opts'); await S.check(`dialog input[name="kv"][value="${val}"]`, { force: true }); if (all) await S.locator('dialog [name="kvall"]').evaluate((i) => { i.checked = true; }); await S.click('dialog .btn-primary'); await S.waitForTimeout(1200); };
  await S.click(`[data-kv="u:${ids.a}"]`); await S.waitForSelector('dialog .kv-opts');
  ok('the dialog names what is shown and offers four ways', /عرض/.test(await S.textContent('dialog h2')) && (await S.$$('dialog input[name="kv"]')).length === 4);
  await S.keyboard.press('Escape'); await S.waitForTimeout(300);
  await choose(`u:${ids.a}`, 'flip');
  ok('in the vertical chart, «opposite» shows the 20 classes as a compact list', (await S.$$(`[data-frame="${ids.a}"].list .ocf-row`)).length === 20);
  const w1 = await width();
  ok('the chart becomes much narrower', w1 < w0 * 0.8, `${w0} → ${w1}`);
  const srv = (await pull(sup0)).filter((x) => x.store === 'deptUnits' && x.id === ids.a).pop();
  ok('the choice is saved on the server for everyone', srv && srv.data.kidsView === 'flip');
  /* 2) تغيير العرض العام يعكس المعكوس */
  await S.check('input[name="odir"][value="side"]', { force: true }); await S.waitForTimeout(1200);
  ok('switching the whole chart to horizontal turns that list into a grid (it stays the opposite)', (await S.$$(`[data-frame="${ids.a}"].grid .ocf-cell`)).length === 20 && !(await S.$(`[data-frame="${ids.b}"]`)));
  await S.check('input[name="odir"][value="down"]', { force: true }); await S.waitForTimeout(1200);
  /* 3) شبكة دائماً لكل الأقسام في الإدارة */
  await choose(`u:${ids.b}`, 'grid', true);
  const after = (await pull(sup0)).filter((x) => x.store === 'deptUnits' && [ids.a, ids.b, ids.c].includes(x.id)).reduce((m, x) => ({ ...m, [x.id]: x.data.kidsView }), {});
  ok('«apply to every section in this department» sets all three', after[ids.a] === 'grid' && after[ids.b] === 'grid' && after[ids.c] === 'grid', JSON.stringify(after));
  ok('a fixed grid stays a grid in the vertical chart', (await S.$$(`[data-frame="${ids.b}"].grid .ocf-cell`)).length === 20);
  /* 4) حسب العرض العام، و«ضغط الكثير» */
  await choose(`u:${ids.a}`, 'auto'); await choose(`u:${ids.b}`, 'auto'); await choose(`u:${ids.c}`, 'auto');
  ok('«as the whole chart» brings the normal tree back', !(await S.$(`[data-frame="${ids.a}"]`)) && (await S.$$('.oc-box')).length > 50);
  await S.evaluate(async (ids) => { for (const id of [ids.a, ids.c]) { const u = await App.DB.get('deptUnits', id); await App.DB.put('deptUnits', { ...u, kidsView: '' }); } await App.Sync.flush(); }, ids); await go(); await S.fill('#oq', `الكلية ${T}`); await S.waitForTimeout(700);
  await S.click('[data-act="compact"]'); await S.waitForTimeout(1200);
  ok('«compact the many» compacts branches with more than 12 under them, and says why', !!(await S.$(`[data-frame="${ids.a}"].list`)) && !!(await S.$(`[data-frame="${ids.c}"].list`)) && /لكثرتها/.test(await S.textContent(`[data-frame="${ids.a}"]`)));
  ok('…but not one set explicitly to «as the whole chart»', !(await S.$(`[data-frame="${ids.b}"]`)));
  await S.click('[data-act="compact"]'); await S.waitForTimeout(600);
  /* 5) جهاز آخر يرى العرض نفسه */
  await choose(`u:${ids.a}`, 'list');
  const S2 = await open('side'); await S2.evaluate(() => App.Sync.pull()); await go(S2); await S2.fill('#oq', `الكلية ${T}`); await S2.waitForTimeout(900);
  ok('another device sees the same list, even in a horizontal chart', (await S2.$$(`[data-frame="${ids.a}"].list .ocf-row`)).length === 20);
  /* 6) السحب داخل القائمة يرتّب */
  const rows = S.locator(`[data-frame="${ids.a}"] .ocf-row`);
  const third = (await rows.nth(2).textContent()).includes('فصل 3');
  /* الهدف في وسط الشاشة والمخطط: قرب الحافة يتحرك العرض أثناء السحب فيتغير موضع الإفلات */
  await rows.nth(0).evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' })); await S.waitForTimeout(400);
  const box = await rows.nth(0).boundingBox();
  await rows.nth(2).dragTo(rows.nth(0), { targetPosition: { x: box.width / 2, y: 3 } }); await S.waitForTimeout(1500);
  const first = await S.locator(`[data-frame="${ids.a}"] .ocf-row`).nth(0).textContent();
  ok('dragging a row to the top edge of another places it before it', third && first.includes('فصل 3'), first.slice(0, 40));
  /* 7) «تحته» */
  await S.evaluate(() => { location.hash = '#/org'; }); await S.waitForTimeout(400);
  await S.click('[data-act="adddep"]'); await S.waitForSelector('dialog .orow');
  const l1 = await S.textContent('dialog .orow .orow-lbl');
  await S.fill('dialog .orow [data-name]', 'إدارة تجربة'); await S.click('dialog .orow [data-sub]'); await S.waitForTimeout(300);
  const l2 = await S.locator('dialog .orow').nth(1).locator('.orow-lbl').textContent();
  await S.locator('dialog .orow').nth(1).locator('[data-name]').fill('شعبة المختبرات'); await S.waitForTimeout(300);
  const l3 = await S.locator('dialog .orow').nth(1).locator('.orow-lbl').textContent();
  ok('the inner-row button names what it adds instead of «تحته»', l1.trim() === 'قسم تابع' && l2.trim() === 'شعبة تابعة' && l3.trim() === 'وحدة تابعة' && !(await S.textContent('dialog')).includes('تحته'), `${l1} | ${l2} | ${l3}`);
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
