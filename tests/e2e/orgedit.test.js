/* اختبار طرفي: تنظيم الهيكل.
   - خانات الإضافة: خانة لكل إدارة أو فرع، و«تحته»، وEnter، وعدد من الخانات مرة واحدة، والتحويل إلى «لصق قائمة» وعكسه
   - «اسم آخر» في النافذة الكاملة
   - النسخ: إدارة إلى إدارات جديدة بهيكلها، وفرع إلى فرع في إدارة أخرى أو بجانبه باسم آخر، دون الحسابات
   - التحديد المتعدد: نقل عدة فروع مع حساباتها، والنوع والرئيس، والحذف (الحسابات ترتفع مستوى)، وكل إجراء قيد واحد
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/orgedit.test.js */
const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php', U = BASE;
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return r.json().catch(() => ({})); };
const pull = async (tok) => { let since = 0; const out = []; for (;;) { const r = await fetch(`${B}?a=pull&since=${since}&limit=3000`, { headers: { 'X-Token': tok } }).then((x) => x.json()); out.push(...r.docs); since = r.rev; if (!r.more) return out; } };
const mkUser = (id, username, extra = {}) => { const salt = crypto.randomBytes(16), hash = crypto.pbkdf2Sync('Passw0rd!', salt, 1000, 32, 'sha256').toString('hex'); return { store: 'users', id, rev: -1, data: { id, username, name: 'حساب ' + username, role: 'department', active: 1, mustChangePassword: 0, extraPerms: [], deniedPerms: [], pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash }, createdAt: Date.now(), updatedAt: Date.now(), ...extra } }; };
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

  /* 4) نسخ إدارة إلى إدارتين جديدتين بهيكلها كاملاً، دون حساباتها */
  const P = `oe${T}`; await api('push', { ops: [mkUser(P, P, { departmentId: col.id, unitId: adm.id })] }, sup); await settle();
  await go(); await S.click(`[data-copy="${col.id}|"]`); await S.waitForSelector('dialog [data-newname]');
  await S.fill('dialog [data-newname]', D('نسخة الكلية')); await S.click('dialog [data-morename]'); await S.keyboard.type(D('نسخة ثانية'));
  const logs2 = await logCount(); await S.click('dialog .btn-primary'); await S.waitForTimeout(1500); await settle();
  st = await struct(); const c1 = st.dep(D('نسخة الكلية')), c2 = st.dep(D('نسخة ثانية')); deps0.push(c1, c2);
  const shape = (d) => { const walk = (pid) => st.kids(d.id, pid).map((u) => `${u.name}:${u.type}[${walk(u.id)}]`).sort().join(','); return walk(''); };
  ok('a department is copied as new departments with its whole structure, in one history entry', !!(c1 && c2) && shape(c1) === shape(col) && shape(c2) === shape(col) && (await logCount()) === logs2 + 1, shape(c1 || { id: '' }).slice(0, 120));
  ok('accounts are not copied: the account stays in the original only', !st.users.some((u) => [c1, c2].some((d) => d && u.departmentId === d.id)) && st.users.find((u) => u.id === P).unitId === adm.id);
  /* 5) نسخ فرع بما تحته إلى فرع في إدارة أخرى باسم جديد، وما تحته لا يظهر وجهةً */
  await go(); await S.click(`[data-copy="${col.id}|${adm.id}"]`); await S.waitForSelector('dialog [data-place]');
  const own = await S.$$eval(`dialog [data-place^="${col.id}|"]`, (x) => x.map((e) => e.dataset.place));
  ok('a branch cannot be copied into itself or what is under it', !own.some((v) => st.kids(col.id, adm.id).some((u) => v.endsWith(`|${u.id}`)) || v === `${col.id}|${adm.id}`), own.length + ' own places');
  const cls = st.kids(c1.id).find((u) => u.name === 'الفصول');
  await S.fill('dialog [data-cpq]', 'الفصول'); await S.waitForTimeout(300); await S.check(`dialog [data-place="${c1.id}|${cls.id}"]`);
  await S.fill('dialog [data-rename]', 'إداريو الفصول'); await S.click('dialog .btn-primary'); await S.waitForTimeout(1500); await settle();
  st = await struct(); const cp = st.kids(c1.id, cls.id).find((u) => u.name === 'إداريو الفصول');
  ok('a branch with its offices is copied under a branch of another department, renamed', !!cp && st.kids(c1.id, cp.id).length === 3 && !st.users.some((u) => u.unitId === (cp || {}).id));
  /* 6) نسخ فرع بجانبه في الموضع نفسه باسم آخر */
  await S.click(`[data-copy="${col.id}|${adm.id}"]`); await S.waitForSelector('dialog [data-place]'); await S.check(`dialog [data-place="${col.id}|"]`); await S.fill('dialog [data-rename]', 'الإداريون 2');
  await S.click('dialog .btn-primary'); await S.waitForTimeout(1500); await settle();
  st = await struct(); const twin = st.kids(col.id).find((u) => u.name === 'الإداريون 2');
  ok('a branch is copied next to itself under another name', !!twin && st.kids(col.id, twin.id).length === 3 && st.kids(col.id).filter((u) => u.name === 'الإداريون').length === 1);

  /* 7) التحديد المتعدد: الضغط على الفرع يحدده، و«أقسامها» يحدد أقسام الإدارة كلها */
  await go(); await S.click('[data-act="select"]'); await S.waitForSelector('.org-selbar');
  const sec = (n) => st.kids(c2.id).find((u) => u.name === n);
  await S.click(`[data-seldep="${c2.id}"]`);
  ok('«its sections» selects every top-level branch of the department', (await S.$$eval(`.is-sel`, (x) => x.length)) === st.kids(c2.id).length && /المحدد: \d+ فرع/.test(await S.textContent('.org-selbar')));
  await S.click('[data-selact="clear"]'); await S.click(`[data-drag="unit:${sec('الإداريون').id}"] b`); await S.click(`[data-drag="unit:${sec('الفصول').id}"] b`);
  ok('clicking a branch selects it', (await S.$$eval('.is-sel', (x) => x.length)) === 2);
  /* نقل الفرعين إلى «المحاضرون» في إدارة أخرى: ما تحتهما وحساباتهما معهما */
  await api('push', { ops: [mkUser(P + 'b', P + 'b', { departmentId: c2.id, unitId: sec('الإداريون').id })] }, sup); await settle();
  const lec = st.kids(col.id).find((u) => u.name === 'المحاضرون'), logs3 = await logCount();
  await S.click('[data-selact="move"]'); await S.waitForSelector('dialog [data-place]'); await S.check(`dialog [data-place="${col.id}|${lec.id}"]`); await S.click('dialog .btn-primary'); await S.waitForTimeout(1500); await settle();
  st = await struct(); const mv = st.kids(col.id, lec.id);
  ok('moving selected branches takes what is under them and their accounts, in one history entry', mv.length === 2 && st.kids(col.id, mv.find((u) => u.name === 'الإداريون').id).length === 3 && st.users.find((u) => u.id === P + 'b').departmentId === col.id && (await logCount()) === logs3 + 1, mv.map((u) => u.name).join('،'));
  /* النوع والرئيس للفرعين معاً */
  await S.check(`[data-sel="${mv[0].id}"]`); await S.check(`[data-sel="${mv[1].id}"]`); await S.click('[data-selact="type"]'); await S.click('dialog .choice-pick label:has-text("وحدة")'); await S.click('dialog .btn-primary'); await S.waitForTimeout(1200);
  await S.check(`[data-sel="${mv[0].id}"]`); await S.check(`[data-sel="${mv[1].id}"]`); await S.click('[data-selact="head"]'); await S.waitForSelector('dialog [name="headId"]'); await S.selectOption('dialog [name="headId"]', 'u_tech'); await S.click('dialog .btn-primary'); await S.waitForTimeout(1200); await settle();
  st = await struct(); const both = st.units.filter((u) => mv.some((m) => m.id === u.id));
  ok('one type and one head are set on all selected branches', both.length === 2 && both.every((u) => u.type === 'unit' && u.headId === 'u_tech'), both.map((u) => `${u.type}/${u.headId}`).join(','));
  /* حذف الفرعين: الحسابات ترتفع إلى «المحاضرون»، والتراجع يعيدهما */
  const logs4 = await logCount();
  await S.check(`[data-sel="${mv[0].id}"]`); await S.check(`[data-sel="${mv[1].id}"]`); await S.click('[data-selact="del"]'); await S.waitForSelector('dialog [data-i="1"]'); await S.click('dialog [data-i="1"]'); await S.waitForTimeout(1500); await settle();
  st = await struct();
  ok('deleting selected branches removes all below them and moves their accounts up one level, in one history entry', !st.units.some((u) => mv.some((m) => m.id === u.id || m.id === u.parentId)) && st.users.find((u) => u.id === P + 'b').unitId === lec.id && (await logCount()) === logs4 + 1);
  const undo = await S.evaluate(async () => { const e = (await App.DB.getAll('orgLog')).sort((a, b) => b.at - a.at)[0]; return App.OrgLog.undo(e); }); await settle();
  st = await struct();
  ok('undoing the bulk delete brings the branches and the account back', st.kids(col.id, lec.id).length === 2 && st.users.find((u) => u.id === P + 'b').unitId === mv.find((u) => u.name === 'الإداريون').id, JSON.stringify(undo));
  await S.click('[data-act="select"]');

  /* تنظيف */
  await S.evaluate(async (ids) => { for (const id of ids) await App.Data.org.removeDept(id, {}).catch(() => null); }, deps0.filter(Boolean).map((d) => d.id));
  await settle();
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
