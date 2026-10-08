/* اختبار طرفي (Playwright) على خادم تجريبي فيه الحسابات sup و dep و tech بكلمة المرور Passw0rd!
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/<name>.test.js */
const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php', U = BASE;
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
const mkUser = async (sup, id, username, pw, extra = {}) => { const salt = crypto.randomBytes(16), hash = crypto.pbkdf2Sync(pw, salt, 1000, 32, 'sha256').toString('hex'); await api('push', { ops: [{ store: 'users', id, rev: -1, data: { id, username, name: 'حساب اختبار ' + username, role: 'department', departmentId: 'dep_1', active: 1, mustChangePassword: 0, pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash }, createdAt: Date.now(), updatedAt: Date.now(), ...extra } }] }, sup); };
(async () => {
  const sup = (await api('login', { username: 'sup', password: 'Passw0rd!' })).j.token;
  const OLD = 'OldPassw0rd!', NEW = 'NewPassw0rd!9', T = Date.now() % 100000;
  await mkUser(sup, 'u_pwtest', 'pwtest', OLD);
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const newCtx = async () => { const c = await b.newContext({ viewport: { width: 1300, height: 860 } }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} }); return c; };
  const login = async (p, u, pw) => { await p.goto(U); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', u); await p.fill('[name="password"]', pw); await p.keyboard.press('Enter'); await p.waitForFunction(() => window.App && App.Auth.user, null, { timeout: 15000 }); await p.waitForTimeout(1200); };
  const state = (p) => p.evaluate(() => ({ user: !!(window.App && App.Auth.user), login: !!document.querySelector('[name="username"]'), token: !!localStorage.getItem('sq_token') }));
  /* 1) تغيير كلمة المرور من الملف الشخصي */
  const other = (await api('login', { username: 'pwtest', password: OLD })).j.token;   /* جلسة على جهاز آخر */
  const c1 = await newCtx(), p = await c1.newPage(); p.setDefaultTimeout(20000);
  await login(p, 'pwtest', OLD);
  await p.evaluate(() => { location.hash = '#/profile'; }); await p.waitForSelector('#pwForm');
  await p.fill('#pwForm [name="current"]', 'wrongPass1'); await p.fill('#pwForm [name="next"]', NEW); await p.fill('#pwForm [name="confirm"]', NEW); await p.click('#pwForm [type="submit"]'); await p.waitForTimeout(1200);
  const wrong = await p.$$eval('.toast', (x) => x.map((t) => t.textContent.trim()).pop());
  ok('wrong current password is rejected by the server', /الحالية غير صحيحة/.test(wrong || ''), wrong);
  await p.fill('#pwForm [name="current"]', OLD); await p.fill('#pwForm [name="next"]', NEW); await p.fill('#pwForm [name="confirm"]', NEW); await p.click('#pwForm [type="submit"]'); await p.waitForTimeout(1500);
  const t1 = await p.$$eval('.toast', (x) => x.map((t) => t.textContent.trim()).pop());
  ok('profile change succeeds', /تم تحديث كلمة المرور/.test(t1 || ''), t1);
  const n1 = (await api('login', { username: 'pwtest', password: NEW })).status, o1 = (await api('login', { username: 'pwtest', password: OLD })).status;
  ok('server: new works and old fails immediately', n1 === 200 && o1 === 401, `new ${n1}, old ${o1}`);
  ok('other device session ended by the change', (await api('me', {}, other)).status === 401);
  ok('this device stays signed in', (await state(p)).user);
  /* 2) نسخة قديمة من سجل المستخدم لا تعيد كلمة المرور السابقة */
  const salt = crypto.randomBytes(16), oldHash = crypto.pbkdf2Sync(OLD, salt, 1000, 32, 'sha256').toString('hex');
  await api('push', { ops: [{ store: 'users', id: 'u_pwtest', rev: -1, data: { id: 'u_pwtest', username: 'pwtest', name: 'حساب اختبار pwtest (تعديل المشرف)', role: 'department', departmentId: 'dep_1', active: 1, pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash: oldHash } } }] }, sup);
  const o2 = (await api('login', { username: 'pwtest', password: OLD })).status, n2 = (await api('login', { username: 'pwtest', password: NEW })).status;
  ok('stale password copy in a later edit is ignored', o2 === 401 && n2 === 200, `old ${o2}, new ${n2}`);
  /* 3) الخروج مع خادم بطيء ثم تحديث الصفحة فوراً: يجب أن تظهر شاشة الدخول */
  await p.route(/a=(push|logout|pull|beat)/, async (r) => { await new Promise((x) => setTimeout(x, 6000)); try { await r.continue(); } catch (_) {} });
  await p.evaluate(() => { document.querySelector('[data-act="logout"]').click(); });
  await p.waitForTimeout(300);
  const s3 = await state(p);
  ok('token removed immediately on logout (slow server)', !s3.token, JSON.stringify(s3));
  await p.unroute(/a=(push|logout|pull|beat)/);
  await p.reload(); await p.waitForTimeout(2500);
  const s4 = await state(p);
  ok('reload right after logout shows the login screen', s4.login && !s4.user, JSON.stringify(s4));
  /* 4) الخروج في تبويب يُخرج التبويب الآخر */
  await login(p, 'pwtest', NEW);
  const p2 = await c1.newPage(); await p2.goto(U); await p2.waitForFunction(() => window.App && App.Auth.user, null, { timeout: 15000 }); await p2.waitForTimeout(1000);
  ok('second tab opens signed in (same browser session)', (await state(p2)).user);
  await p.evaluate(() => { document.querySelector('[data-act="logout"]').click(); }); await p2.waitForTimeout(1500);
  const s5 = await state(p2);
  ok('logout in one tab signs the other tab out', !s5.user && s5.login, JSON.stringify(s5));
  /* 5) المشرف يعيّن كلمة مرور: يسري فوراً وتنتهي جلسة المستخدم المفتوحة */
  await login(p, 'pwtest', NEW);
  const c2 = await newCtx(), q = await c2.newPage(); q.setDefaultTimeout(20000); await login(q, 'sup', 'Passw0rd!');
  const r5 = await q.evaluate(async () => { try { await App.Data.users.setPassword('u_pwtest', 'Temp1234', 1); return 'ok'; } catch (e) { return e.message; } });
  const t5 = (await api('login', { username: 'pwtest', password: 'Temp1234' })).status, n5 = (await api('login', { username: 'pwtest', password: NEW })).status;
  ok('supervisor reset applies immediately', r5 === 'ok' && t5 === 200 && n5 === 401, `${r5}, temp ${t5}, previous ${n5}`);
  await p.evaluate(() => App.Sync.call('me').catch(() => null)); await p.waitForTimeout(800);
  const s6 = await state(p);
  ok("user's open session ends after the reset", !s6.user && s6.login, JSON.stringify(s6));
  /* 6) أول دخول بكلمة مؤقتة: صفحة الترحيب تغيّرها دون طلب الحالية */
  await login(p, 'pwtest', 'Temp1234');
  const onWelcome = await p.evaluate(() => location.hash);
  ok('forced change opens the welcome page', /welcome/.test(onWelcome), onWelcome);
  if (/welcome/.test(onWelcome)) {
    await p.fill('#wForm [name="next"]', 'Final2Passw0rd'); await p.fill('#wForm [name="confirm"]', 'Final2Passw0rd');
    await p.click('#wForm [type="submit"]'); await p.waitForTimeout(2000);
    const f = (await api('login', { username: 'pwtest', password: 'Final2Passw0rd' })).status, t = (await api('login', { username: 'pwtest', password: 'Temp1234' })).status;
    ok('welcome change applies immediately', f === 200 && t === 401, `final ${f}, temp ${t}`);
  }
  /* 7) تعديل مستخدم موجود من شاشة المستخدمين دون كلمة مرور لم يعد يرفض */
  const r7 = await q.evaluate(async () => { try { const u = await App.DB.get('users', 'u_pwtest'); await App.Data.users.save({ ...u, name: 'حساب اختبار معدّل', active: 1 }, ''); return 'ok'; } catch (e) { return e.message; } });
  ok('editing an existing user without a password works', r7 === 'ok', r7);
  console.log(res.join('\n'));
  await b.close();
  await api('push', { ops: [{ store: 'users', id: 'u_pwtest', rev: -1, deleted: 1 }] }, sup);
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.message); process.exit(1); });
