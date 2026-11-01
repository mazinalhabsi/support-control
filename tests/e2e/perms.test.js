/* اختبار طرفي: «الصلاحيات» في إدارة الحسابات — كل المنح والسحب من مكان واحد.
   - منح صلاحية لكل نتائج بحث أو دور مرة واحدة، وسحب صلاحية من دور حساب واحد وإعادتها
   - مصفوفة الأدوار، والوصول إليها من صفحة المستخدمين
   - من يدير الحسابات دون أن يكون مشرفاً يرى ولا يغيّر (والخادم يرفض)
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/perms.test.js */
const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php';
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return r.json().catch(() => ({})); };
const pull = async (tok) => { let since = 0; const out = []; for (;;) { const r = await fetch(`${B}?a=pull&since=${since}&limit=3000`, { headers: { 'X-Token': tok } }).then((x) => x.json()); out.push(...r.docs); since = r.rev; if (!r.more) return out; } };
const mkUser = (id, extra = {}) => { const salt = crypto.randomBytes(16), hash = crypto.pbkdf2Sync('Passw0rd!', salt, 1000, 32, 'sha256').toString('hex'); return { store: 'users', id, rev: -1, data: { id, username: id, name: 'حساب ' + id, role: 'department', active: 1, mustChangePassword: 0, extraPerms: [], deniedPerms: [], pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash }, createdAt: Date.now(), updatedAt: Date.now(), ...extra } }; };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
(async () => {
  const T = String(Date.now() % 100000), sup0 = (await api('login', { username: 'sup', password: 'Passw0rd!' })).token;
  const techs = [1, 2, 3].map((i) => `pt${i}_${T}`), MG = `pm_${T}`;
  await api('push', { ops: [...techs.map((id) => mkUser(id, { role: 'technician' })), mkUser(MG, { extraPerms: ['users.manage'] })] }, sup0);
  const user = async (id) => (await pull(sup0)).filter((d) => d.store === 'users' && d.id === id).pop().data;
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const login = async (u) => {
    const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} });
    const p = await c.newPage(); p.on('pageerror', (e) => errs.push(`${u}: ${e.message}`)); p.setDefaultTimeout(20000);
    await p.goto(BASE); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', u); await p.fill('[name="password"]', 'Passw0rd!'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.App && App.Auth.user); await p.waitForTimeout(1200); return p;
  };
  const S = await login('sup');
  for (let i = 0; i < 30 && !(await S.evaluate((ids) => ids.every((id) => App.Data.c.users.has(id)), [...techs, MG])); i++) { await S.evaluate(() => App.Sync.pull()); await S.waitForTimeout(400); }

  /* 1) الوصول من صفحة المستخدمين */
  await S.evaluate(() => { location.hash = '#/settings?s=users'; }); await S.waitForSelector('a[href="#/settings?s=perms"]'); await S.click('a[href="#/settings?s=perms"]');
  await S.waitForSelector('[data-pk].on');
  ok('the users page links to the permissions center', /الصلاحيات/.test(await S.textContent('.page-head')));
  /* 2) منح «كتابة مقالات الحلول» لكل الفنيين في نتائج البحث مرة واحدة */
  await S.click('[data-pk="kb.write"]'); await S.waitForSelector('[data-pk="kb.write"].on');
  await S.selectOption('[data-prole]', 'technician'); await S.waitForTimeout(300); await S.fill('[data-puq]', `_${T}`); await S.waitForTimeout(700);
  await S.click('[data-pall]'); await S.waitForTimeout(300);
  ok('«select all results» picks every matching account', (await S.$$eval('[data-ppick]:checked', (x) => x.length)) === 3);
  await S.click('[data-pgrant]'); await S.waitForTimeout(3000);
  const g = await Promise.all(techs.map(user));
  ok('one click grants the permission to all of them, on the server', g.every((u) => (u.extraPerms || []).includes('kb.write')));
  ok('they move to «who has it» marked as extra', (await S.$$eval('[data-prevoke]', (x) => x.map((e) => e.dataset.prevoke))).filter((id) => techs.includes(id)).length === 3);
  /* 3) سحب صلاحية من دور حساب واحد، ثم إعادتها */
  await S.click('[data-pk="tickets.work"]'); await S.waitForSelector(`[data-prevoke="${techs[0]}"]`);
  await S.click(`[data-prevoke="${techs[0]}"]`); await S.waitForSelector('dialog [data-i="1"]');
  ok('revoking a role permission explains it is for this account only', /تُسحب منه وحده/.test(await S.textContent('dialog')));
  await S.click('dialog [data-i="1"]'); await S.waitForTimeout(3000);
  let u0 = await user(techs[0]);
  ok('the role permission is withdrawn from that account only', (u0.deniedPerms || []).includes('tickets.work') && !((await user(techs[1])).deniedPerms || []).includes('tickets.work'));
  ok('it is listed under «withdrawn from their role» with a restore button', !!(await S.$(`[data-prestore="${techs[0]}"]`)));
  await S.click(`[data-prestore="${techs[0]}"]`); await S.waitForTimeout(3000); u0 = await user(techs[0]);
  ok('restore gives it back', !(u0.deniedPerms || []).includes('tickets.work'));
  /* 4) مصفوفة الأدوار */
  await S.check('input[name="pmview"][value="matrix"]', { force: true }); await S.waitForSelector('.pm-matrix');
  ok('the role matrix shows each permission per role and extra grants', (await S.$$eval('.pm-mrow', (x) => x.length)) > 20 && /حسابات إضافية/.test(await S.textContent('.pm-matrix')));
  await S.click('.pm-mrow[data-pk="kb.write"]'); await S.waitForSelector('[data-pk="kb.write"].on');
  ok('clicking a matrix row opens that permission', !!(await S.$(`[data-prevoke="${techs[2]}"]`)));
  /* 5) من يدير الحسابات وليس مشرفاً: يرى ولا يغيّر */
  const M = await login(MG);
  await M.evaluate(() => { location.hash = '#/settings?s=perms&p=kb.write'; }); await M.waitForSelector('[data-pk="kb.write"].on');
  ok('an account manager who is not the supervisor sees holders but no grant or revoke controls', !(await M.$('[data-pgrant]')) && !(await M.$('[data-prevoke]')) && (await M.$$eval('.list-row', (x) => x.length)) >= 3);
  const mTok = (await api('login', { username: MG, password: 'Passw0rd!' })).token, t2 = await user(techs[1]);
  const r = await api('push', { ops: [{ store: 'users', id: techs[1], rev: -1, data: { ...t2, extraPerms: [...(t2.extraPerms || []), 'settings'], updatedAt: Date.now() } }] }, mTok);
  ok('the server keeps permissions unchanged when a non-supervisor writes them', !((await user(techs[1])).extraPerms || []).includes('settings'), JSON.stringify(r).slice(0, 80));
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
