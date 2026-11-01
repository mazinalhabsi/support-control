/* اختبار طرفي: تنظيم الهيكل.
   - خانات الإضافة: خانة لكل إدارة أو فرع، و«تحته»، وEnter، وعدد من الخانات مرة واحدة، والتحويل إلى «لصق قائمة» وعكسه
   - «اسم آخر» في النافذة الكاملة
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/orgedit.test.js */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php', U = BASE;
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return r.json().catch(() => ({})); };
const pull = async (tok) => { let since = 0; const out = []; for (;;) { const r = await fetch(`${B}?a=pull&since=${since}&limit=3000`, { headers: { 'X-Token': tok } }).then((x) => x.json()); out.push(...r.docs); since = r.rev; if (!r.more) return out; } };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
(async () => {
  const T = String(Date.now() % 100000), sup = (await api('login', { username: 'sup', password: 'Passw0rd!' })).token;
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); localStorage.setItem('sq_org_mode', 'cards'); localStorage.removeItem('sq_org_addmode'); } catch (_) {} });
  const S = await c.newPage(); S.setDefaultTimeout(25000); S.on('pageerror', (e) => errs.push(e.message));
  await S.goto(U); await S.waitForSelector('[name="username"]'); await S.fill('[name="username"]', 'sup'); await S.fill('[name="password"]', 'Passw0rd!'); await S.keyboard.press('Enter');
  await S.waitForFunction(() => window.App && App.Auth.user); await S.waitForTimeout(1500);
  const go = async () => { await S.evaluate(() => { location.hash = '#/dashboard'; }); await S.waitForTimeout(300); await S.evaluate(() => { location.hash = '#/org'; }); await S.waitForSelector('.page-head [data-act="adddep"]'); await S.waitForTimeout(600); };
  const settle = async () => { await S.evaluate(() => App.Sync.flush()); await S.waitForTimeout(2500); };
  const struct = async () => { const docs = await pull(sup), deps = docs.filter((d) => d.store === 'departments' && !d.deleted).map((d) => d.data), units = docs.filter((d) => d.store === 'deptUnits' && !d.deleted).map((d) => d.data), users = docs.filter((d) => d.store === 'users' && !d.deleted).map((d) => d.data); return { deps, units, users, dep: (n) => deps.find((d) => d.name === n), kids: (depId, pid = '') => units.filter((u) => u.departmentId === depId && (u.parentId || '') === pid) }; };
  const logCount = () => S.evaluate(async () => (await App.DB.getAll('orgLog')).length);
  const D = (k) => `${k} ${T}`, rowsOf = () => S.$$eval('dialog .orow', (r) => r.map((x) => ({ d: Number(x.style.getPropertyValue('--d')), n: x.querySelector('[data-name]').value })));
  const deps0 = [];

  /* 1) إدارات بخانات: «تحته» للأقسام والمكاتب، وEnter للخانة التالية، و«خانة إدارة»، وعدد خانات مرة واحدة */
  await go(); await S.click('.page-head [data-act="adddep"]'); await S.waitForSelector('dialog [data-rowsbox] [data-name]'); await S.waitForTimeout(300);
  ok('fields are the default way to add', await S.isVisible('dialog [data-rowsbox] [data-name]') && !(await S.isVisible('dialog [name="outline"]')));
  await S.keyboard.type(D('الكلية')); await S.click('dialog .orow:last-child [data-sub]'); await S.keyboard.type('الإداريون');
  await S.click('dialog .orow:last-child [data-sub]'); await S.keyboard.type('مكتب 1'); await S.keyboard.press('Enter'); await S.keyboard.type('مكتب 2'); await S.keyboard.press('Enter'); await S.keyboard.type('مكتب 3');
  await S.click('dialog .orow:nth-child(2) [data-sub]'); await S.keyboard.press('Backspace');
  ok('Backspace in an empty field removes it', (await rowsOf()).length === 5, JSON.stringify(await rowsOf()));
  await S.click('dialog [data-addrow]'); await S.keyboard.type(D('المكتبة'));
  await S.fill('dialog [data-n]', '3'); await S.click('dialog [data-addn]');
  const rows1 = await rowsOf();
  ok('«add N fields» adds that many fields at once, focused on the first', rows1.length === 9 && rows1.slice(6).every((r) => r.d === 0 && !r.n) && (await S.evaluate(() => document.activeElement.closest('.orow') === document.querySelectorAll('dialog .orow')[6])), JSON.stringify(rows1));
  await S.keyboard.type(D('القاعات')); await S.waitForTimeout(500);
  ok('each field shows whether it is new, and the summary counts them', (await S.$$eval('dialog .orow [data-st]', (x) => x.filter((e) => /جديد/.test(e.textContent)).length)) === 7 && /7 جديد/.test(await S.textContent('dialog [data-prev]')));
  /* إلى «لصق قائمة» ثم إلى الخانات: لا يضيع شيء */
  await S.click('dialog .org-addmode label:nth-child(2)'); await S.waitForTimeout(300);
  const txt = await S.inputValue('dialog [name="outline"]');
  await S.click('dialog .org-addmode label:nth-child(1)'); await S.waitForTimeout(300);
  ok('switching to the pasted list and back keeps every line and level', txt === `${D('الكلية')}\n  الإداريون\n    مكتب 1\n    مكتب 2\n    مكتب 3\n${D('المكتبة')}\n${D('القاعات')}` && (await rowsOf()).map((r) => r.d).join('') === '0122200', JSON.stringify(txt));
  const logs0 = await logCount();
  await S.click('dialog .btn-primary'); await S.waitForTimeout(1500); await settle();
  let st = await struct(); const col = st.dep(D('الكلية')), adm = col && st.kids(col.id)[0];
  deps0.push(col, st.dep(D('المكتبة')), st.dep(D('القاعات')));
  ok('departments, a section and its three offices are added from fields in one history entry', !!(col && adm && adm.name === 'الإداريون' && st.dep(D('المكتبة')) && st.dep(D('القاعات'))) && st.kids(col.id, adm.id).map((u) => `${u.name}:${u.type}`).sort().join(',') === 'مكتب 1:office,مكتب 2:office,مكتب 3:office' && (await logCount()) === logs0 + 1);

  /* 2) فروع بخانات داخل إدارة: أربع خانات، ونوع يُغيَّر يدوياً، وخانة فارغة فوق خانة مكتوبة */
  await go(); await S.click(`[data-addunit="${col.id}"][data-parent=""]`); await S.waitForSelector('dialog [data-rowsbox] [data-name]'); await S.waitForTimeout(300);
  await S.fill('dialog [data-n]', '3'); await S.click('dialog [data-addn]');
  const inputs = await S.$$('dialog .orow [data-name]'); const names = ['الفصول', 'المحاضرون', 'الإداريون', 'المختبرات'];
  for (let i = 0; i < 4; i++) await inputs[i].fill(names[i]);
  await S.selectOption('dialog .orow:nth-child(4) [data-type]', 'unit'); await S.waitForTimeout(500);
  ok('an existing name is marked as existing before saving', /موجود/.test(await S.textContent('dialog .orow:nth-child(3) [data-st]')) && /3 جديد، 1 موجود/.test(await S.textContent('dialog [data-prev]')));
  await S.click('dialog [data-addrow]'); await S.click('dialog .orow:last-child [data-sub]'); await S.keyboard.type('بلا أصل'); await S.waitForTimeout(500);
  ok('a field under an empty field is flagged and left out', /فارغة/.test(await S.textContent('dialog .orow:last-child [data-st]')));
  await S.click('dialog .btn-primary'); await S.waitForTimeout(1500); await settle();
  st = await struct(); const top = st.kids(col.id);
  ok('four sections from fields, with the type chosen by hand, and nothing duplicated', top.length === 4 && top.find((u) => u.name === 'المختبرات').type === 'unit' && top.filter((u) => u.name === 'الإداريون').length === 1 && !st.units.some((u) => u.name === 'بلا أصل'), top.map((u) => `${u.name}:${u.type}`).join(','));

  /* 3) النافذة الكاملة: «اسم آخر» بالإعدادات نفسها، في قيد واحد، والرمز لا يُكرر على عدة أسماء */
  await S.click(`[data-addunit="${col.id}"][data-parent=""]`); await S.waitForSelector('dialog [data-rowsbox]'); await S.click('dialog .btn:has-text("فرع واحد بكل تفاصيله")'); await S.waitForSelector('dialog [data-morename]');
  await S.fill('dialog [name="name"]', 'قاعة 1'); await S.click('dialog [data-morename]'); await S.keyboard.type('قاعة 2'); await S.keyboard.press('Enter'); await S.keyboard.type('قاعة 3');
  await S.click('dialog .choice-pick label:has-text("مكتب")'); await S.fill('dialog [name="code"]', 'X-1'); await S.click('dialog .btn-primary'); await S.waitForTimeout(800);
  ok('a code with several names is refused with a clear message', !!(await S.$('dialog [data-morename]')) && /الرمز ورئيس الفرع لفرع واحد/.test(await S.textContent('body')));
  await S.fill('dialog [name="code"]', ''); const logs1 = await logCount();
  await S.click('dialog .btn-primary'); await S.waitForTimeout(1500); await settle();
  st = await struct(); const halls = st.kids(col.id).filter((u) => /^قاعة \d$/.test(u.name));
  ok('«another name» adds every name with the same settings in one history entry', halls.length === 3 && halls.every((u) => u.type === 'office') && (await logCount()) === logs1 + 1, halls.map((u) => `${u.name}:${u.type}`).join(','));

  /* تنظيف */
  await S.evaluate(async (ids) => { for (const id of ids) await App.Data.org.removeDept(id, {}).catch(() => null); }, deps0.filter(Boolean).map((d) => d.id));
  await settle();
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
