/* اختبار طرفي: التعديل الجماعي للحسابات في القوائم الطويلة.
   320 حساباً في إدارة واحدة: أكثر مما تعرضه صفحة المستخدمين (60) وصفحة كلمات المرور (300) في المرة الأولى.
   «تحديد الكل» يشمل كل نتائج التصفية لا الظاهر فقط، والإجراءات الجماعية تصل الخادم لكل الحسابات.
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/bulk.test.js */
const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php', U = BASE;
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
const pull = async (tok) => { let since = 0; const out = []; for (;;) { const r = await fetch(`${B}?a=pull&since=${since}&limit=3000`, { headers: { 'X-Token': tok } }).then((x) => x.json()); out.push(...r.docs); since = r.rev; if (!r.more) return out; } };
/* اختيار موضع من شجرة المواضع كما يفعل المستخدم: فتح الإدارة ثم فروعها حتى يظهر الموضع */
const pickPlace = async (p, scope, v) => { await p.click(`${scope} [data-ppopen]`); await p.waitForSelector('.pp-pop'); const d = v.split('|')[0]; if (!(await p.$(`.pp-pop [data-ppv="${v}"]`))) await p.click(`.pp-pop .pp-x[data-ppx="d:${d}"]`); for (let i = 0; i < 8 && !(await p.$(`.pp-pop [data-ppv="${v}"]`)); i++) { const x = await p.$('.pp-pop .pp-x[data-ppx^="u:"]:not(.open)'); if (!x) break; await x.click(); } await p.click(`.pp-pop [data-ppv="${v}"]`); await p.waitForTimeout(200); };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
const N = 320;
(async () => {
  const T = String(Date.now() % 100000), sup = (await api('login', { username: 'sup', password: 'Passw0rd!' })).j.token;
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const page = async (user, pw = 'Passw0rd!') => {
    const c = await b.newContext({ viewport: { width: 1500, height: 900 }, acceptDownloads: true }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); localStorage.setItem('sq_uview', 'table'); } catch (_) {} });
    const p = await c.newPage(); p.setDefaultTimeout(30000); p.on('pageerror', (e) => errs.push(`${user}: ${e.message}`));
    await p.goto(U); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', user); await p.fill('[name="password"]', pw); await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.App && App.Auth.user, null, { timeout: 30000 }); await p.waitForTimeout(1500); return p;
  };
  const S = await page('sup');
  /* إدارتان للاختبار، وفي الثانية قسم */
  const org = await S.evaluate(async (T) => { const a = await App.Data.org.saveDept({ name: `إدارة الجماعي ${T}` }), z = await App.Data.org.saveDept({ name: `إدارة الوجهة ${T}` }), u = await App.Data.org.saveUnit({ departmentId: z.id, type: 'section', name: `قسم الوجهة ${T}` }); return { a: a.id, z: z.id, unit: u.id, rank: App.Data.list('ranks')[0].id }; }, T);
  await S.evaluate(() => App.Sync.flush()); await S.waitForTimeout(2000);
  const ids = Array.from({ length: N }, (_, i) => `u_blk_${T}_${i}`);
  const salt = crypto.randomBytes(16), hash = crypto.pbkdf2Sync('Passw0rd!', salt, 1000, 32, 'sha256').toString('hex');
  for (let i = 0; i < N; i += 100) await api('push', { ops: ids.slice(i, i + 100).map((id, k) => ({ store: 'users', id, rev: -1, data: { id, username: `blk${T}_${i + k}`, name: `موظف جماعي ${i + k}`, role: 'department', active: 1, mustChangePassword: 0, departmentId: org.a, unitId: '', pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash }, createdAt: Date.now(), updatedAt: Date.now() } })) }, sup);
  await S.evaluate(() => App.Sync.pull()); await S.waitForTimeout(1500);
  const server = async () => (await pull(sup)).filter((d) => d.store === 'users' && ids.includes(d.id) && !d.deleted).map((d) => d.data);
  const filterDep = async (p) => { await p.evaluate(() => { location.hash = '#/users'; }); await p.waitForSelector('#udep'); await p.selectOption('#udep', org.a); await p.waitForTimeout(800); };
  const selectAll = async (p) => { await p.check('[data-selall]'); await p.waitForTimeout(600); return p.evaluate(() => (document.querySelector('#bulkBar b') || {}).textContent || ''); };
  const apply = async (p, act, fill) => { await p.click(`[data-bulk="${act}"]`); await p.waitForSelector('dialog [name="v"]', { state: 'attached' }); if (fill) await fill(p); await p.click('dialog .btn-primary'); await p.waitForSelector('dialog', { state: 'detached', timeout: 60000 }); await p.evaluate(() => App.Sync.flush()); await p.waitForTimeout(3500); };

  /* 1) «تحديد الكل» يشمل كل النتائج */
  await filterDep(S);
  const shown = await S.$$eval('#ubody tbody tr', (x) => x.length), bar = await selectAll(S);
  ok(`users page shows ${shown} rows but select-all picks all ${N} results`, shown < N && bar.includes(String(N)), bar);
  /* 2) الموضع في الهيكل: الإدارة والقسم معاً */
  await apply(S, 'place', (p) => pickPlace(p, 'dialog', `${org.z}|${org.unit}`));
  let srv = await server();
  ok('placement applied to every selected account, department and section together', srv.length === N && srv.every((u) => u.departmentId === org.z && u.unitId === org.unit), String(srv.filter((u) => u.unitId === org.unit).length));
  /* 3) الرتبة، والإلزام بتغيير كلمة المرور، والتخصصات (لا تنطبق على الموظفين) */
  await S.selectOption('#udep', org.z); await S.waitForTimeout(800); await selectAll(S);
  await apply(S, 'rank', (p) => p.selectOption('dialog [name="v"]', org.rank));
  await selectAll(S); await apply(S, 'must', (p) => p.selectOption('dialog [name="v"]', '1'));
  srv = await server();
  ok('rank and «change password at sign-in» applied to all', srv.every((u) => u.rankId === org.rank && u.mustChangePassword === 1), `${srv.filter((u) => u.rankId === org.rank).length}/${srv.filter((u) => u.mustChangePassword === 1).length}`);
  await selectAll(S); await S.click('[data-bulk="spec"]'); await S.waitForSelector('dialog [name="v"]'); await S.click('dialog .btn-primary'); await S.waitForTimeout(1500);
  const specToast = await S.evaluate(() => [...document.querySelectorAll('#toasts .toast span')].map((x) => x.textContent).pop() || '');
  ok('specializations skip employees and say so', /وتُرك 320/.test(specToast) || /وتُرك ٣٢٠/.test(specToast), specToast);
  /* 4) الصلاحيات (للمشرف): منح ثم سحب صلاحية للدور ثم إعادة */
  const perms = async (op, v) => { await selectAll(S); await apply(S, 'perms', async (p) => { await p.selectOption('dialog [name="op"]', op); if (v) await p.selectOption('dialog [name="v"]', v); }); };
  await perms('grant', 'kb.write'); await perms('revoke', 'tickets.create');
  srv = await server();
  ok('grant and revoke a permission for all selected', srv.every((u) => (u.extraPerms || []).includes('kb.write') && (u.deniedPerms || []).includes('tickets.create')));
  await perms('reset');
  srv = await server();
  ok('reset to role permissions for all selected', srv.every((u) => !(u.extraPerms || []).length && !(u.deniedPerms || []).length));
  /* 5) كلمة المرور جماعياً من صفحة المستخدمين */
  await selectAll(S); await S.click('[data-bulk="password"]'); await S.waitForSelector('dialog [name="pw"]'); await S.fill('dialog [name="pw"]', `Bulk${T}x`); await S.click('dialog .btn-primary');
  await S.waitForFunction(() => /تم تعيين كلمة المرور/.test(document.body.innerText), null, { timeout: 120000 });
  const okText = await S.evaluate(() => (document.querySelector('dialog .imp-summary') || {}).textContent || '');
  const logins = await Promise.all([0, 159, N - 1].map(async (i) => !!(await api('login', { username: `blk${T}_${i}`, password: `Bulk${T}x` })).j.token));
  ok('bulk password from the users page for all selected', /320|٣٢٠/.test(okText) && logins.every(Boolean), okText);
  await S.click('dialog .btn-primary'); await S.waitForTimeout(500);
  /* 6) تصدير المحدد */
  await selectAll(S);
  const [dl] = await Promise.all([S.waitForEvent('download', { timeout: 15000 }), S.click('[data-bulk="export"]')]);
  /* اسم الملف عربي، ومتصفح الاختبار يسميه «download»؛ يُفحص محتواه: جدول Excel بصف لكل حساب محدد */
  const xlsx = await dl.path(), sheet = require('child_process').execSync(`unzip -p "${xlsx}" xl/worksheets/sheet1.xml`).toString();
  ok('export selected: a spreadsheet with a row per selected account', (sheet.match(/<row /g) || []).length === N + 1, String((sheet.match(/<row /g) || []).length));
  /* 7) تصفية بفئات أخرى: الرتبة، وآخر دخول، والقسم */
  const cnt = async (sel, v) => { await S.selectOption(sel, v); await S.waitForTimeout(700); const n = await S.evaluate(() => { const h = document.querySelector('[data-selall]'); return h ? Number((h.title.match(/\d[\d,]*/) || ['0'])[0].replace(/,/g, '')) : 0; }); await S.selectOption(sel, ''); await S.waitForTimeout(400); return n; };
  await S.selectOption('#udep', org.z); await S.waitForTimeout(800);
  const byUnit = await cnt('#uunit', org.unit), byRank = await cnt('#urank', org.rank), never = await cnt('#ulogin', 'never');
  ok('filters by section, rank and «never signed in» count the whole result', byUnit === N && byRank === N && never >= N - 3, `${byUnit}/${byRank}/${never}`);
  /* 8) صفحة كلمات المرور: أكثر من 300 حساب */
  await S.evaluate(() => { location.hash = '#/passwords'; }); await S.waitForSelector('#pdep'); await S.selectOption('#pdep', org.z); await S.waitForTimeout(800);
  const pwShown = await S.$$eval('tbody tr', (x) => x.length); await S.check('[data-pselall]'); await S.waitForTimeout(600);
  const pwBar = await S.evaluate(() => (document.querySelector('#pwBulk b') || {}).textContent || '');
  ok(`passwords page shows ${pwShown} rows but select-all picks all ${N}`, pwShown < N && /320|٣٢٠/.test(pwBar), pwBar);
  /* 9) مدير مستخدمين غير المشرف: لا يمنح الصلاحيات، ولا زر لها */
  const MGR = `u_blkmgr_${T}`;
  await api('push', { ops: [{ store: 'users', id: MGR, rev: -1, data: { id: MGR, username: `blkmgr${T}`, name: 'مدير مستخدمين', role: 'technician', active: 1, mustChangePassword: 0, extraPerms: ['users.manage'], pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash } } }] }, sup);
  const mtok = (await api('login', { username: `blkmgr${T}`, password: 'Passw0rd!' })).j.token;
  const mine = (await pull(mtok)).filter((d) => d.store === 'users' && d.id === MGR).pop().data;
  await api('push', { ops: [{ store: 'users', id: MGR, rev: -1, data: { ...mine, extraPerms: ['users.manage', 'settings'], updatedAt: Date.now() } }, { store: 'users', id: ids[0], rev: -1, data: { ...srv[0], extraPerms: ['settings'], updatedAt: Date.now() } }] }, mtok);
  const after = (await pull(sup)).filter((d) => d.store === 'users' && [MGR, ids[0]].includes(d.id)).map((d) => d.data);
  ok('a users manager cannot grant permissions (not even to himself)', after.every((u) => !(u.extraPerms || []).includes('settings')), JSON.stringify(after.map((u) => u.extraPerms)));
  const M = await page(`blkmgr${T}`); await filterDep(M).catch(() => null); await M.selectOption('#udep', org.z); await M.waitForTimeout(800); await selectAll(M);
  ok('no permissions button for a non-supervisor', !(await M.$('[data-bulk="perms"]')));

  /* تنظيف */
  for (let i = 0; i < N; i += 100) await api('push', { ops: ids.slice(i, i + 100).map((id) => ({ store: 'users', id, rev: -1, deleted: 1 })) }, sup);
  await api('push', { ops: [{ store: 'users', id: MGR, rev: -1, deleted: 1 }] }, sup);
  await S.evaluate(async ([a, z]) => { for (const d of [a, z]) await App.Data.org.removeDept(d, {}).catch(() => null); }, [org.a, org.z]);
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
