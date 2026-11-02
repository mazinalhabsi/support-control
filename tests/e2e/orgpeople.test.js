/* اختبار طرفي: توزيع الحسابات في الهيكل، والتركيز على فرع، و«عرض الباقي»، والطباعة.
   - لوحة التوزيع: من لم يُوزَّع في الإدارة، والنقل إلى قسم بالنقر وبالسحب، والدخول إلى قسم ثم مكاتبه، والتراجع،
     والتوزيع بالتساوي وبإكمال الأقل أولاً مع السعة، والنقل إلى إدارة أخرى
   - رئيس قسم يبدأ عند قسمه ويوزّع داخله فقط، والخادم يرفض نقله إلى خارج رئاسته
   - المخطط: التركيز على فرع برابط، وأول 12 ثم «عرض الباقي»، والطباعة على A3 بالمخطط
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/orgpeople.test.js */
const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php';
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return r.json().catch(() => ({})); };
const pull = async (tok) => { let since = 0; const out = []; for (;;) { const r = await fetch(`${B}?a=pull&since=${since}&limit=3000`, { headers: { 'X-Token': tok } }).then((x) => x.json()); out.push(...r.docs); since = r.rev; if (!r.more) return out; } };
const mkUser = (id, name, extra = {}) => { const salt = crypto.randomBytes(16), hash = crypto.pbkdf2Sync('Passw0rd!', salt, 1000, 32, 'sha256').toString('hex'); return { store: 'users', id, rev: -1, data: { id, username: id, name, role: 'department', active: 1, mustChangePassword: 0, extraPerms: [], deniedPerms: [], pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash }, createdAt: Date.now(), updatedAt: Date.now(), ...extra } }; };
/* اختيار موضع من شجرة المواضع كما يفعل المستخدم: فتح الإدارة ثم فروعها حتى يظهر الموضع */
const pickPlace = async (p, scope, v) => { await p.click(`${scope} [data-ppopen]`); await p.waitForSelector('.pp-pop'); const d = v.split('|')[0]; if (!(await p.$(`.pp-pop [data-ppv="${v}"]`))) await p.click(`.pp-pop .pp-x[data-ppx="d:${d}"]`); for (let i = 0; i < 8 && !(await p.$(`.pp-pop [data-ppv="${v}"]`)); i++) { const x = await p.$('.pp-pop .pp-x[data-ppx^="u:"]:not(.open)'); if (!x) break; await x.click(); } await p.click(`.pp-pop [data-ppv="${v}"]`); await p.waitForTimeout(200); };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
(async () => {
  const T = String(Date.now() % 100000), sup = (await api('login', { username: 'sup', password: 'Passw0rd!' })).token;
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const login = async (u, pre = {}) => {
    const c = await b.newContext({ viewport: { width: 1440, height: 1000 } }); await c.addInitScript((pre) => { try { localStorage.setItem('sq_motion', 'off'); Object.entries(pre).forEach(([k, v]) => localStorage.setItem(k, v)); } catch (_) {} window.print = () => { window.__printed = (document.getElementById('print-root') || {}).innerHTML || ''; }; }, pre);
    const p = await c.newPage(); p.on('pageerror', (e) => errs.push(`${u}: ${e.message}`)); p.setDefaultTimeout(25000);
    await p.goto(BASE); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', u); await p.fill('[name="password"]', 'Passw0rd!'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.App && App.Auth.user); await p.waitForTimeout(1500); return p;
  };
  const S = await login('sup', { sq_org_mode: 'chart', sq_org_dir: 'down', sq_org_compact: '0' });
  const ids = await S.evaluate(async (T) => {
    await App.Data.org.buildOutline(App.Data.org.planOutline(`إدارة التدريب ${T}\n  قسم الميدان\n    مكتب الرماية\n    مكتب اللياقة\n  قسم المناهج\n  قسم الاختبارات\nإدارة الشؤون ${T}\n  قسم الأفراد`));
    await App.Sync.flush();
    const deps = App.Data.list('departments'), d = deps.find((x) => x.name === `إدارة التدريب ${T}`), o = deps.find((x) => x.name === `إدارة الشؤون ${T}`), u = await App.DB.getAll('deptUnits'), f = (dep, n) => u.find((x) => x.departmentId === dep && x.name === n).id;
    return { d: d.id, o: o.id, f: f(d.id, 'قسم الميدان'), m: f(d.id, 'قسم المناهج'), x: f(d.id, 'قسم الاختبارات'), r: f(d.id, 'مكتب الرماية'), l: f(d.id, 'مكتب اللياقة'), p: f(o.id, 'قسم الأفراد') };
  }, T);
  const names = ['أحمد', 'بدر', 'خالد', 'سالم', 'محمد', 'يوسف', 'ناصر', 'سعيد', 'علي', 'حمد'], uid = (i) => `op${T}_${i}`;
  await api('push', { ops: Array.from({ length: 50 }, (_, i) => mkUser(uid(i), `${names[i % 10]} ${T}-${String(i + 1).padStart(2, '0')}`, { departmentId: ids.d, unitId: '', militaryNo: `${T}${i}` })) }, sup);
  const H = `oph${T}`; await api('push', { ops: [mkUser(H, `رئيس الميدان ${T}`, { role: 'technician', departmentId: ids.d, unitId: ids.f })] }, sup);
  for (let i = 0; i < 20 && !(await S.evaluate((h) => App.Data.c.users.has(h), H)); i++) { await S.evaluate(() => App.Sync.pull()); await S.waitForTimeout(500); }
  await S.evaluate(async ({ f, H }) => { const u = await App.DB.get('deptUnits', f); await App.Data.org.saveUnit({ ...u, headId: H, head: 'رئيس الميدان' }); await App.Sync.flush(); }, { f: ids.f, H });
  for (let i = 0; i < 20 && !(await S.evaluate((id) => App.Data.c.users.has(id), uid(49))); i++) { await S.evaluate(() => App.Sync.pull()); await S.waitForTimeout(500); }
  const where = async () => { const m = new Map((await pull(sup)).filter((x) => x.store === 'users' && x.data).map((x) => [x.id, x.data])); return (i) => m.get(uid(i)) || {}; };
  const board = async (d, u = '') => { await S.evaluate(() => { location.hash = '#/dashboard'; }); await S.waitForTimeout(250); await S.evaluate(({ d, u }) => { location.hash = `#/org/people?d=${d}${u ? `&u=${u}` : ''}`; }, { d, u }); await S.waitForSelector('.dp-stats'); await S.waitForTimeout(600); };

  /* 1) اللوحة: الخمسون غير موزعين، ونقل المحددين بالنقر، والتراجع */
  await S.evaluate(() => { location.hash = '#/org'; }); await S.waitForSelector('a[href="#/org/people"]');
  ok('the structure page links to «distribute accounts»', !!(await S.$('a[href="#/org/people"]')));
  await board(ids.d);
  ok('the board lists the 50 accounts not yet in any section, and the three sections', /غير موزعين على فروعه: 50/.test((await S.textContent('.dp-stats')).replace(/\s+/g, ' ')) && (await S.$$('.dp-card')).length === 3);
  await S.fill('[data-dpq]', `${T}-0`); await S.waitForTimeout(600); await S.click('[data-dpall]'); await S.waitForTimeout(300);
  await S.click(`[data-dpmove="${ids.d}|${ids.f}"]`); await S.waitForTimeout(1500);
  let w = await where();
  ok('search, select visible and «move» send 9 accounts to the section', [0, 1, 2, 3, 4, 5, 6, 7, 8].every((i) => w(i).unitId === ids.f) && w(9).unitId === '');
  await S.click('[data-dpundo]'); await S.waitForTimeout(1500); w = await where();
  ok('«undo» returns them in one step', [0, 1, 2, 3, 4, 5, 6, 7, 8].every((i) => w(i).unitId === ''));
  /* 2) بالتساوي على الأقسام الثلاثة */
  await S.fill('[data-dpq]', ''); await S.waitForTimeout(500); await S.click('[data-dpall]'); await S.click('[data-dptall]'); await S.waitForTimeout(300);
  await S.click('[data-dpeven="even"]'); await S.waitForSelector('dialog .dp-plan');
  ok('even distribution previews each section first', (await S.$$('dialog .dp-pl')).length === 3);
  await S.click('dialog .btn-primary'); await S.waitForTimeout(3000); w = await where();
  const counts = [ids.f, ids.m, ids.x].map((u) => Array.from({ length: 50 }, (_, i) => i).filter((i) => w(i).unitId === u).length);
  ok('50 accounts become 17 / 17 / 16', counts.slice().sort().join(',') === '16,17,17', counts.join(','));
  const log = (await pull(sup)).filter((x) => x.store === 'orgLog' && x.data && /توزيع 50 حساب/.test(x.data.summary || '') && (x.data.nodes || []).includes(ids.d));
  ok('the whole distribution is one change-log entry', log.length === 1);
  /* 3) الدخول إلى قسم الميدان، والسعة، والسحب إلى مكتب، و«الأقل أولاً» */
  await S.click(`[data-dpgo="${ids.f}"]`); await S.waitForTimeout(900);
  ok('«enter» opens the section with its offices and a breadcrumb', (await S.$$('.dp-card')).length === 2 && /قسم الميدان/.test(await S.textContent('.dp-crumb')) && !!(await S.$('.dp-up')));
  await S.click(`[data-dpcap="${ids.r}"]`); await S.waitForSelector('dialog [name="cap"]'); await S.fill('dialog [name="cap"]', '3'); await S.click('dialog .btn-primary'); await S.waitForTimeout(900);
  ok('a capacity shows as a bar on the office', /0 \/ 3/.test(await S.textContent(`[data-dpto="${ids.d}|${ids.r}"]`)));
  const first = await S.$eval('.dp-row', (e) => e.dataset.dpuser);
  await S.locator('.dp-row').first().dragTo(S.locator(`[data-dpto="${ids.d}|${ids.r}"]`)); await S.waitForTimeout(1500);
  ok('dragging an account onto an office moves it there', (await S.evaluate((id) => App.Data.c.users.get(id).unitId, first)) === ids.r);
  await S.click('[data-dpall]'); await S.click('[data-dptall]'); await S.waitForTimeout(300);
  await S.click('[data-dpeven="fill"]'); await S.waitForSelector('dialog .dp-plan');
  const plan = await S.$$eval('dialog .dp-pl small', (x) => x.map((e) => e.textContent));
  await S.click('dialog .btn-primary'); await S.waitForTimeout(2500);
  const inR = await S.evaluate((r) => App.Data.list('users').filter((u) => u.unitId === r).length, ids.r), inL = await S.evaluate((l) => App.Data.list('users').filter((u) => u.unitId === l).length, ids.l);
  ok('«emptiest first» stops at the capacity while another office has room', inR === 3 && inL >= 13, `${inR} / ${inL} — ${plan.join(' | ')}`);
  ok('a full office shows it on its bar', /3 \/ 3/.test(await S.textContent(`[data-dpto="${ids.d}|${ids.r}"]`)) && !/تجاوز السعة/.test(await S.textContent(`[data-dpto="${ids.d}|${ids.r}"]`)));
  /* 4) إلى إدارة أخرى */
  await board(ids.d, ids.m);
  await S.click('.dp-row input[type="checkbox"]'); await S.waitForTimeout(200);
  const moved = await S.$eval('.dp-row', (e) => e.dataset.dpuser);
  await S.click('.dp-other summary'); await pickPlace(S, '.dp-other', `${ids.o}|${ids.p}`); await S.click('[data-dpplacego]'); await S.waitForTimeout(1500);
  ok('«another place» moves to a section in another department', (await S.evaluate((id) => { const u = App.Data.c.users.get(id); return `${u.departmentId}|${u.unitId}`; }, moved)) === `${ids.o}|${ids.p}`);
  /* 5) رئيس القسم */
  const Hp = await login(H);
  await Hp.evaluate(() => { location.hash = '#/org/people'; }); await Hp.waitForSelector('.dp-stats'); await Hp.waitForTimeout(700);
  ok('a section head opens the board at their section', /قسم الميدان/.test(await Hp.textContent('.dp-crumb [aria-current]')) && !!(await Hp.$(`[data-dpmove="${ids.d}|${ids.r}"]`)));
  const hTok = (await api('login', { username: H, password: 'Passw0rd!' })).token, victim = await S.evaluate((r) => App.Data.list('users').find((u) => u.unitId === r).id, ids.r);
  const vd = (await pull(sup)).filter((x) => x.store === 'users' && x.id === victim).pop();
  const r = await api('push', { ops: [{ store: 'users', id: victim, rev: vd.rev, data: { ...vd.data, departmentId: ids.o, unitId: ids.p, updatedAt: Date.now() } }] }, hTok);
  ok('the server refuses a head moving someone outside what they head', !(r.applied || []).length);
  /* 6) المخطط: التركيز، وأول 12، والطباعة */
  await S.evaluate(async (m) => { const cls = Array.from({ length: 20 }, (_, i) => `فصل ${i + 1}`); for (const n of cls) await App.Data.org.saveUnit({ departmentId: (await App.DB.get('deptUnits', m)).departmentId, parentId: m, type: 'office', name: n }); const u = await App.DB.get('deptUnits', m); await App.DB.put('deptUnits', { ...u, kidsView: 'list' }); await App.Sync.flush(); }, ids.m);
  await S.evaluate(() => { location.hash = '#/dashboard'; }); await S.waitForTimeout(250); await S.evaluate((f) => { location.hash = `#/org?focus=${encodeURIComponent(f)}`; }, `${ids.d}|${ids.m}`); await S.waitForSelector('.oc-focus'); await S.waitForTimeout(800);
  ok('a focus link shows that section alone with a breadcrumb', (await S.$$('.oc .oc-box')).length === 1 && /قسم المناهج/.test(await S.textContent('.oc-focus')));
  ok('the compact list shows 12 then «show the rest»', (await S.$$('.ocf-row')).length === 12 && /عرض الباقي \(8\)/.test(await S.textContent('.ocf-more')));
  await S.click('.ocf-more'); await S.waitForTimeout(600);
  ok('«show the rest» shows all 20', (await S.$$('.ocf-row')).length === 20);
  await S.click('[data-act="print"]'); await S.waitForSelector('dialog [name="fmt"]'); await S.click('dialog .btn-primary'); await S.waitForTimeout(800);
  const pr = await S.evaluate(() => window.__printed || '');
  ok('print uses A3 landscape and the chart of the focused section', /size:A3 landscape/.test(pr) && /class="oc /.test(pr) && /قسم المناهج/.test(pr) && (pr.match(/ocf-row/g) || []).length >= 20);
  await S.evaluate(() => document.body.classList.remove('printing'));
  await S.click('.oc-focus .btn'); await S.waitForTimeout(900);
  ok('«whole structure» leaves the focus', !!(await S.$('.oc-rootbox')) && (await S.evaluate(() => location.hash)) === '#/org');
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
