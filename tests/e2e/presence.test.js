/* اختبار طرفي: «المتواجدون الآن».
   - فتح القائمة يجلبها من الخادم فوراً، فيظهر من دخل بعدك دون انتظار التحديث الدوري
   - الفني ومن يدير الحسابات يرون كل المتواجدين (لا الموظفين وحدهم)، والموظف لا يرى الزر
   - تعذّر الاتصال بالخادم يظهر في القائمة مع «إعادة المحاولة»
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/presence.test.js */
const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php';
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return r.json().catch(() => ({})); };
const mkUser = (id, extra = {}) => { const salt = crypto.randomBytes(16), hash = crypto.pbkdf2Sync('Passw0rd!', salt, 1000, 32, 'sha256').toString('hex'); return { store: 'users', id, rev: -1, data: { id, username: id, name: 'حساب ' + id, role: 'department', active: 1, mustChangePassword: 0, extraPerms: [], deniedPerms: [], pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash }, createdAt: Date.now(), updatedAt: Date.now(), ...extra } }; };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
(async () => {
  const T = String(Date.now() % 100000), sup0 = (await api('login', { username: 'sup', password: 'Passw0rd!' })).token, A = `adm${T}`, E = `emp${T}`;
  await api('push', { ops: [mkUser(A, { extraPerms: ['users.manage'] }), mkUser(E)] }, sup0);
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const login = async (u) => {
    const c = await b.newContext({ viewport: { width: 1400, height: 900 } }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} });
    const p = await c.newPage(); p.on('pageerror', (e) => errs.push(`${u}: ${e.message}`)); p.setDefaultTimeout(20000);
    await p.goto(BASE); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', u); await p.fill('[name="password"]', 'Passw0rd!'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.App && App.Auth.user); await p.waitForTimeout(800); return p;
  };
  const listOf = async (p) => { if (await p.$eval('#presPop', (x) => !x.hidden)) await p.click('#presBtn'); await p.click('#presBtn'); await p.waitForFunction(() => { const x = document.querySelector('#presPop'); return x && !x.hidden && !/يُحدَّث/.test(x.textContent); }); return p.$$eval('#presPop .pres-row b', (x) => x.map((e) => e.textContent)); };
  /* المشرف يدخل أولاً، ثم الآخرون، ويفتح القائمة بعدهم بثوانٍ */
  const sup = await login('sup'); await sup.waitForTimeout(1500);
  const tech = await login('tech'), adm = await login(A), emp = await login(E); await sup.waitForTimeout(2500);
  const names = ['حساب tech', 'حساب sup', `حساب ${A}`, `حساب ${E}`];
  let l = await listOf(sup);
  ok('opening the list fetches it at once: those who signed in after you appear', names.every((n) => l.includes(n)), l.join('، '));
  l = await listOf(tech);
  ok('a technician sees everyone online, colleagues included', names.every((n) => l.includes(n)) && /متواجد الآن/.test(await tech.getAttribute('#presBtn', 'title')), l.join('، '));
  l = await listOf(adm);
  ok('an account manager sees the button and everyone online', names.every((n) => l.includes(n)), l.join('، '));
  ok('an employee does not see the button', !(await emp.$('#presBtn')));
  ok('role filter chips are shown to staff', (await tech.$$eval('#presPop [data-presf]', (x) => x.length)) >= 4);
  /* الخادم لا يرد: رسالة وإعادة محاولة */
  await sup.route('**/api.php?a=beat**', (r) => r.fulfill({ status: 503, body: '{}' }));
  await listOf(sup);
  ok('a failed fetch is shown with a retry button, keeping the last list', /تعذّر جلب المتواجدين/.test(await sup.textContent('#presPop')) && !!(await sup.$('#presPop [data-presretry]')) && (await sup.$$eval('#presPop .pres-row', (x) => x.length)) >= 4);
  await sup.unroute('**/api.php?a=beat**'); await sup.click('#presPop [data-presretry]'); await sup.waitForTimeout(1500);
  ok('retry clears the message once the server answers', !(await sup.$('#presPop .pres-err')));
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
