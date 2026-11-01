/* اختبار طرفي: عرض الهيكل وتحريكه والنسخ بالسحب.
   - ملء الشاشة يبقى بعد أي إضافة أو تعديل، ويُنهى بالزر
   - التكبير لا يعيد رسم الصفحة ويُبقي الموضع، وسحب خلفية المخطط يحرّكه
   - «السحب ينسخ» (أو Ctrl): نسخ فرع بما تحته داخل فرع أو قبله، وإدارة كاملة كإدارة جديدة، دون الحسابات
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/orgview.test.js */
const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php';
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return r.json().catch(() => ({})); };
const mkUser = (id, extra = {}) => { const salt = crypto.randomBytes(16), hash = crypto.pbkdf2Sync('Passw0rd!', salt, 1000, 32, 'sha256').toString('hex'); return { store: 'users', id, rev: -1, data: { id, username: id, name: 'حساب ' + id, role: 'department', active: 1, mustChangePassword: 0, extraPerms: [], deniedPerms: [], pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash }, createdAt: Date.now(), updatedAt: Date.now(), ...extra } }; };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
(async () => {
  const T = String(Date.now() % 100000), sup0 = (await api('login', { username: 'sup', password: 'Passw0rd!' })).token;
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const c = await b.newContext({ viewport: { width: 1440, height: 1400 } }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); localStorage.setItem('sq_org_mode', 'cards'); localStorage.setItem('sq_org_dragmode', 'move'); } catch (_) {} });
  const S = await c.newPage(); S.setDefaultTimeout(25000); S.on('pageerror', (e) => errs.push(e.message));
  await S.goto(BASE); await S.waitForSelector('[name="username"]'); await S.fill('[name="username"]', 'sup'); await S.fill('[name="password"]', 'Passw0rd!'); await S.keyboard.press('Enter');
  await S.waitForFunction(() => window.App && App.Auth.user); await S.waitForTimeout(1500);
  const go = async () => { await S.evaluate(() => { location.hash = '#/dashboard'; }); await S.waitForTimeout(300); await S.evaluate(() => { location.hash = '#/org'; }); await S.waitForSelector('[data-act="full"]'); await S.waitForTimeout(700); };
  const settle = async () => { await S.evaluate(() => App.Sync.flush()); await S.waitForTimeout(1500); };
  const ids = await S.evaluate(async (T) => {
    await App.Data.org.buildOutline(App.Data.org.planOutline(`مصدر النسخ ${T}\n  الإداريون\n    مكتب 1\n    مكتب 2\n  الفصول\nوجهة النسخ ${T}\n  القاعات\n  المكتبة`));
    const d = App.Data.list('departments'), a = d.find((x) => x.name === `مصدر النسخ ${T}`), z = d.find((x) => x.name === `وجهة النسخ ${T}`), u = await App.DB.getAll('deptUnits'), f = (n, dep) => u.find((x) => x.departmentId === dep && x.name === n).id;
    return { a: a.id, z: z.id, adm: f('الإداريون', a.id), cls: f('الفصول', a.id), hall: f('القاعات', z.id), lib: f('المكتبة', z.id) };
  }, T);
  await api('push', { ops: [mkUser(`ov${T}`, { departmentId: ids.a, unitId: ids.adm })] }, sup0); await settle();
  await go();

  /* 1) ملء الشاشة */
  await S.click('[data-act="full"]'); await S.waitForTimeout(800);
  const fs1 = await S.evaluate(() => ({ cls: document.querySelector('#view').classList.contains('org-full'), api: document.fullscreenElement === document.querySelector('#view') }));
  ok('full screen covers the structure page', fs1.cls, JSON.stringify(fs1));
  await S.evaluate(async (dep) => { await App.Data.org.saveUnit({ departmentId: dep, parentId: '', type: 'section', name: 'قسم أثناء ملء الشاشة', order: '' }); }, ids.z); await S.waitForTimeout(1500);
  ok('full screen stays after the page redraws', await S.evaluate(() => document.querySelector('#view').classList.contains('org-full') && !!document.querySelector('[data-act="full"][aria-pressed="true"]')));
  await S.click('[data-act="full"]'); await S.waitForTimeout(800);
  ok('the button ends full screen', await S.evaluate(() => !document.querySelector('#view').classList.contains('org-full') && !document.fullscreenElement));

  /* 2) المخطط: التكبير دون إعادة رسم، وسحب الخلفية */
  await S.check('input[name="omode"][value="chart"]', { force: true }); await S.waitForSelector('.oc-wrap'); await S.waitForTimeout(800);
  await S.evaluate(() => { document.querySelector('.oc-wrap').dataset.mark = '1'; });
  const z0 = await S.textContent('.org-zoom .small'); await S.click('[data-zoom="1"]'); await S.waitForTimeout(300);
  ok('zooming does not redraw the page', (await S.evaluate(() => document.querySelector('.oc-wrap').dataset.mark)) === '1' && (await S.textContent('.org-zoom .small')) !== z0, `${z0} → ${await S.textContent('.org-zoom .small')}`);
  await S.evaluate(() => { const o = document.querySelector('.oc'); o.style.zoom = 1.6; });
  /* نقطة على خلفية المخطط داخل النافذة (لا على فرع) */
  await S.evaluate(() => document.querySelector('.oc-wrap').scrollIntoView({ block: 'start' })); await S.waitForTimeout(200);
  const pt = await S.evaluate(() => { const w = document.querySelector('.oc-wrap'), r = w.getBoundingClientRect(); for (let y = r.top + 4; y < Math.min(r.bottom, innerHeight) - 4; y += 12) for (let x = r.left + 4; x < r.right - 4; x += 12) { const el = document.elementFromPoint(x, y); if (el && w.contains(el) && !el.closest('.oc-box,button,input,label,a')) return { x, y }; } return null; });
  const before = await S.evaluate(() => [document.querySelector('.oc-wrap').scrollLeft, document.querySelector('.oc-wrap').scrollTop]);
  await S.mouse.move(pt.x, pt.y); await S.mouse.down(); await S.mouse.move(pt.x + 160, pt.y + 120, { steps: 8 }); await S.mouse.up();
  const after = await S.evaluate(() => [document.querySelector('.oc-wrap').scrollLeft, document.querySelector('.oc-wrap').scrollTop]);
  ok('dragging the chart background pans it', after[0] !== before[0] || after[1] !== before[1], `${before} → ${after}`);
  await S.check('input[name="omode"][value="cards"]', { force: true }); await S.waitForTimeout(800);

  /* 3) «السحب ينسخ». البحث يُبقي إدارتي الاختبار وحدهما في أعلى الصفحة، بعيداً عن حافة الشاشة التي يتحرك عندها العرض أثناء السحب */
  const goF = async () => { await go(); await S.fill('#oq', `النسخ ${T}`); await S.waitForTimeout(1200); };
  await goF(); await S.check('input[name="odrag"][value="copy"]', { force: true }); await S.waitForTimeout(300);
  const nodeBox = async (id) => (await S.$(`[data-drag="unit:${id}"]`)).boundingBox();
  let tb = await nodeBox(ids.hall);
  await S.dragAndDrop(`[data-drag="unit:${ids.adm}"]`, `[data-drag="unit:${ids.hall}"]`, { targetPosition: { x: tb.width / 2, y: tb.height / 2 } }); await S.waitForTimeout(1500); await settle();
  let st = await S.evaluate(async (ids) => { const u = await App.DB.getAll('deptUnits'), cp = u.find((x) => x.parentId === ids.hall && x.name === 'الإداريون'); return { orig: u.find((x) => x.id === ids.adm).departmentId === ids.a, cp: !!cp, kids: cp ? u.filter((x) => x.parentId === cp.id).length : 0, accounts: (await App.DB.getAll('users')).filter((x) => cp && x.unitId === cp.id).length }; }, ids);
  ok('in copy mode, dropping a branch in the middle of another copies it inside with what is under it', st.orig && st.cp && st.kids === 2, JSON.stringify(st));
  ok('the copy has no accounts; the original keeps its account', st.accounts === 0 && (await S.evaluate(async (id) => (await App.DB.get('users', id)).unitId, `ov${T}`)) === ids.adm);
  await goF(); tb = await nodeBox(ids.lib);
  await S.dragAndDrop(`[data-drag="unit:${ids.cls}"]`, `[data-drag="unit:${ids.lib}"]`, { targetPosition: { x: tb.width / 2, y: 3 } });
  const topOf = (z) => S.evaluate(async (z) => (await App.DB.getAll('deptUnits')).filter((x) => x.departmentId === z && !x.parentId).sort((a, b) => (a.order || 0) - (b.order || 0)).map((x) => x.name), z);
  const waitTop = async (fn) => { let v = []; for (let i = 0; i < 20; i++) { v = await topOf(ids.z); if (fn(v)) break; await S.waitForTimeout(400); } return v; };
  await waitTop((o) => o.indexOf('الفصول') >= 0 && o.indexOf('الفصول') === o.indexOf('المكتبة') - 1);
  const ord = await S.evaluate(async (z) => (await App.DB.getAll('deptUnits')).filter((x) => x.departmentId === z && !x.parentId).sort((a, b) => (a.order || 0) - (b.order || 0)).map((x) => x.name), ids.z);
  ok('dropping a copy on the top edge places it right before that branch', ord.indexOf('الفصول') === ord.indexOf('المكتبة') - 1, ord.join('،'));
  await goF(); tb = await nodeBox(ids.lib);
  await S.dragAndDrop(`[data-drag="unit:${ids.cls}"]`, `[data-drag="unit:${ids.lib}"]`, { targetPosition: { x: tb.width / 2, y: tb.height - 3 } }); await S.waitForTimeout(1500); await settle();
  await waitTop((o) => o.includes('الفصول (نسخة)'));
  const names = await S.evaluate(async (z) => (await App.DB.getAll('deptUnits')).filter((x) => x.departmentId === z && !x.parentId).map((x) => x.name), ids.z);
  ok('a second copy into the same place gets «(copy)» instead of being skipped', names.includes('الفصول (نسخة)'), names.join('،'));
  /* إدارة كاملة على الشعار: إدارة جديدة بالهيكل نفسه */
  await goF();
  await S.dragAndDrop(`[data-drag="dept:${ids.a}"]`, '.org-root'); await S.waitForTimeout(1500); await settle();
  const clone = await S.evaluate(async (T) => { const d = App.Data.list('departments').find((x) => x.name === `مصدر النسخ ${T} (نسخة)`); if (!d) return null; const u = await App.DB.getAll('deptUnits'); return { n: u.filter((x) => x.departmentId === d.id).length, acc: (await App.DB.getAll('users')).filter((x) => x.departmentId === d.id).length }; }, T);
  ok('dropping a department on the logo in copy mode makes a new department with its structure, no accounts', !!clone && clone.n === 4 && clone.acc === 0, JSON.stringify(clone));
  await S.check('input[name="odrag"][value="move"]', { force: true });

  /* تنظيف */
  await S.evaluate(async (T) => { for (const d of App.Data.list('departments').filter((x) => x.name.includes(`النسخ ${T}`))) await App.Data.org.removeDept(d.id, {}).catch(() => null); }, T);
  await settle();
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
