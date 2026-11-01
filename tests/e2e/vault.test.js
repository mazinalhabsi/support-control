/* اختبار طرفي: الوصول إلى الملاحظات.
   - الفنيون يصلون إليها افتراضياً (اطلاع وكتابة)، والمشرف يمنح الاطلاع لحساب آخر من «الصلاحيات» كبقية الصلاحيات،
     وزر «من يصل إليها» في صفحة الملاحظات يفتح المكان نفسه
   - الملاحظة «للجميع» يراها كل من يصل إليها ويعدّل محتواها من له الكتابة، والخاصة لكاتبها وحده، والاطلاع وحده لا يعدّل (يفرضه الخادم)
   - سحب الوصول يمسح نسخة الملاحظات من جهاز الحساب
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/vault.test.js */
const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php';
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return r.json().catch(() => ({})); };
const pull = async (tok) => { let since = 0; const out = []; for (;;) { const r = await fetch(`${B}?a=pull&since=${since}&limit=3000`, { headers: { 'X-Token': tok } }).then((x) => x.json()); out.push(...r.docs); since = r.rev; if (!r.more) return out; } };
const mkUser = (id, extra = {}) => { const salt = crypto.randomBytes(16), hash = crypto.pbkdf2Sync('Passw0rd!', salt, 1000, 32, 'sha256').toString('hex'); return { store: 'users', id, rev: -1, data: { id, username: id, name: 'حساب ' + id, role: 'department', active: 1, mustChangePassword: 0, extraPerms: [], deniedPerms: [], pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash }, createdAt: Date.now(), updatedAt: Date.now(), ...extra } }; };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
(async () => {
  const T = String(Date.now() % 100000), sup0 = (await api('login', { username: 'sup', password: 'Passw0rd!' })).token, TA = `vta${T}`, TB = `vtb${T}`, AD = `vad${T}`;
  await api('push', { ops: [mkUser(TA, { role: 'technician' }), mkUser(TB, { role: 'technician' }), mkUser(AD)] }, sup0);
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const login = async (u) => {
    const c = await b.newContext({ viewport: { width: 1400, height: 900 } }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} });
    const p = await c.newPage(); p.on('pageerror', (e) => errs.push(`${u}: ${e.message}`)); p.setDefaultTimeout(20000);
    await p.goto(BASE); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', u); await p.fill('[name="password"]', 'Passw0rd!'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.App && App.Auth.user); await p.waitForTimeout(1200); return p;
  };
  const sync = (p) => p.evaluate(async () => { await App.Sync.flush(); await App.Sync.pull(); });
  const until = async (p, fn, arg) => { for (let i = 0; i < 30; i++) { await sync(p); if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(500); } return false; };
  const user = async (id) => (await pull(sup0)).filter((d) => d.store === 'users' && d.id === id).pop().data;

  /* 1) الفنيون يصلون افتراضياً، والمشرف يمنح الاطلاع لحساب آخر من «الصلاحيات» */
  const S = await login('sup'); await until(S, (ids) => ids.every((id) => App.Data.c.users.has(id)), [TA, TB, AD]);
  ok('technicians reach notes by default (view and write)', await S.evaluate((ids) => ids.every((id) => App.VAULT.level(App.Data.c.users.get(id)) === 'manage'), [TA, TB]));
  await S.evaluate(() => { location.hash = '#/vault'; }); await S.waitForSelector('a[href="#/settings?s=perms&p=vault.read"]');
  await S.click('a[href="#/settings?s=perms&p=vault.read"]'); await S.waitForSelector('[data-pk="vault.read"].on');
  ok('«who has access» on the notes page opens the permissions center at that permission', /الاطلاع على الملاحظات/.test(await S.textContent('#view')) && !/الملاحظات الإدارية/.test(await S.textContent('#view')));
  await S.fill('[data-puq]', `${T}`); await S.waitForTimeout(700);
  await S.check(`[data-ppick="${AD}"]`); await S.click('[data-pgrant]'); await S.waitForTimeout(2500);
  await sync(S);
  ok('the permission lists show who has it, technicians by their role', (await S.$$eval('[data-prevoke]', (x) => x.map((e) => e.dataset.prevoke))).filter((id) => [TA, TB, AD].includes(id)).length === 3);
  const ud = await user(AD);
  ok('the supervisor grants view only to another account', ud.extraPerms.includes('vault.read') && !ud.extraPerms.includes('vault.manage'));
  await S.evaluate(() => { location.hash = '#/vault'; }); await S.waitForTimeout(800);
  ok('the page is called «Notes»', /^\s*الملاحظات/.test(await S.textContent('.page-head h1, .page-head h2, .page-head')) && (await S.textContent('.nav-link[data-path="/vault"]')).includes('الملاحظات') && !(await S.textContent('.nav-link[data-path="/vault"]')).includes('الإدارية'));

  /* 2) الفني يضيف ملاحظة مشتركة وأخرى خاصة */
  const A = await login(TA);
  await A.evaluate(() => { location.hash = '#/vault'; }); await A.waitForTimeout(1000);
  ok('the technician opens the notes page and may add notes', /الملاحظات/.test(await A.textContent('.page-head')) && !!(await A.$('[data-act="new"]')));
  const ids = await A.evaluate(async (T) => { const s = await App.VAULT.save({ type: 'wifi', title: `شبكة الضيوف ${T}`, f: { ssid: 'Guest', password: 'g-123' }, visibility: 'all' }); const p = await App.VAULT.save({ type: 'general', title: `ملاحظتي ${T}`, body: 'خاص', visibility: 'private' }); await App.Sync.flush(); return { s: s.id, p: p.id }; }, T);

  /* 3) الإداري (اطلاع): يرى المشتركة لا الخاصة، ولا يعدّل */
  const D = await login(AD);
  await until(D, (id) => App.DB.get('vault', id).then(Boolean), ids.s);
  const dv = await D.evaluate(async (ids) => ({ shared: !!(await App.DB.get('vault', ids.s)), priv: !!(await App.DB.get('vault', ids.p)), manage: App.VAULT.canManage() }), ids);
  ok('an account with view sees the note for everyone but not the private one', dv.shared && !dv.priv, dv.shared ? '' : await D.evaluate(async () => JSON.stringify({ scope: App.Sync.scope, rev: App.Sync.rev, n: (await App.DB.getAll('vault')).length, read: App.Auth.can('vault.read'), extra: App.Auth.user.extraPerms, on: App.Sync.on })));
  await D.evaluate(() => { location.hash = '#/vault'; }); await D.waitForTimeout(1000);
  ok('view only: no add or edit buttons', !dv.manage && !(await D.$('[data-act="new"]')) && !(await D.$('[data-vedit]')));
  const adTok = (await api('login', { username: AD, password: 'Passw0rd!' })).token, sharedDoc = (await pull(sup0)).filter((d) => d.store === 'vault' && d.id === ids.s).pop();
  const rej = await api('push', { ops: [{ store: 'vault', id: ids.s, rev: sharedDoc.rev, data: { ...sharedDoc.data, title: 'تعديل غير مسموح' } }] }, adTok);
  ok('the server refuses an edit from an account with view only', (rej.conflicts || []).length === 1 && !(rej.applied || []).length, JSON.stringify(rej).slice(0, 120));

  /* نسخة خاصة لغيره وصلت جهازه قبل الإصلاح تُمسح من جهازه محلياً، ولا تُمس على الخادم */
  const stray = await D.evaluate(async (ids) => { const n = { id: `vn_stray_${Date.now()}`, type: 'general', title: 'خاصة لغيري', visibility: 'private', createdBy: 'u_sup', f: {}, tags: [], updatedAt: Date.now() }; await App.Sync.raw.put('vault', n); const before = !!(await App.DB.get('vault', n.id)); const removed = await App.VAULT.cleanLocal(); return { before, removed, after: !!(await App.DB.get('vault', n.id)), shared: !!(await App.DB.get('vault', ids.s)) }; }, ids);
  ok('another person\'s private note already on a device is removed locally, shared notes stay', stray.before && stray.removed >= 1 && !stray.after && stray.shared, JSON.stringify(stray));
  /* 4) فني آخر له التعديل: يعدّل المشتركة، ولا يرى الخاصة */
  const Bp = await login(TB);
  await until(Bp, (id) => App.DB.get('vault', id).then(Boolean), ids.s);
  const edited = await Bp.evaluate(async (ids) => { const n = await App.DB.get('vault', ids.s); await App.VAULT.save({ ...n, body: 'عدّلها زميل' }); await App.Sync.flush(); return { priv: !!(await App.DB.get('vault', ids.p)) }; }, ids);
  await until(A, (id) => App.DB.get('vault', id).then((n) => n && n.body === 'عدّلها زميل'), ids.s);
  ok('a colleague with write access changes the note for everyone and its writer sees the change', !edited.priv && (await A.evaluate(async (id) => (await App.DB.get('vault', id)).body, ids.s)) === 'عدّلها زميل');
  ok('the private note stays with its writer only', await A.evaluate(async (id) => !!(await App.DB.get('vault', id)), ids.p));

  /* 5) سحب الوصول من «الصلاحيات»: تُمسح النسخة من جهازه وتُغلق الصفحة */
  await S.evaluate(() => { location.hash = '#/settings?s=perms&p=vault.read'; }); await S.waitForSelector(`[data-prevoke="${TB}"]`);
  await S.click(`[data-prevoke="${TB}"]`); await S.waitForSelector('dialog [data-i="1"]'); await S.click('dialog [data-i="1"]'); await S.waitForTimeout(2500); await sync(S);
  const gone = await until(Bp, () => App.DB.getAll('vault').then((x) => !x.length && !App.Auth.can('vault.read')));
  ok('revoking access removes the notes from that device', gone, gone ? '' : JSON.stringify([await Bp.evaluate(async () => ({ n: (await App.DB.getAll('vault')).length, read: App.Auth.can('vault.read'), extra: App.Auth.user.extraPerms, db: ((await App.DB.get('users', App.Auth.user.id)) || {}).extraPerms })), (await user(TB)).extraPerms]));
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
