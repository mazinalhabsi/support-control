/* اختبار طرفي (Playwright) على خادم تجريبي فيه الحسابات sup و dep و tech بكلمة المرور Passw0rd!
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/<name>.test.js */
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php', U = BASE;
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
const sql = (q) => execSync(`mysql -uroot ${process.env.DBNAME || 'sqtest6'} -N -e "${q.replace(/"/g, '\\"')}"`).toString().trim();
const res = []; const ok = (name, cond, info = '') => res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);
(async () => {
  const T = Date.now() % 1000000, MIL = '7' + T, MIL2 = '8' + T;
  const sup = (await api('login', { username: 'sup', password: 'Passw0rd!' })).j.token;
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const page = async () => { const c = await b.newContext({ viewport: { width: 1300, height: 860 } }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} }); const p = await c.newPage(); p.setDefaultTimeout(20000); return p; };
  const login = async (p, u, pw) => { await p.goto(U); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', u); await p.fill('[name="password"]', pw); await p.keyboard.press('Enter'); await p.waitForFunction(() => window.App && App.Auth.user, null, { timeout: 20000 }); await p.waitForTimeout(1500); };
  /* 1) الاستيراد بخيار الرقم العسكري */
  const S = await page(); await login(S, 'sup', 'Passw0rd!');
  const imp = await S.evaluate(async (mil) => { const r = await App.Pages.runImport({ rows: [{ status: 'new', name: 'مستورد تجريبي', militaryNo: mil, role: 'department', department: '', location: '', rank: '', office: '', phone: '' }], newDeps: [], newLocs: [], fileName: 't.xlsx' }, { mode: 'military' }); await App.Sync.waitIdle(8000); return r.creds[0]; }, MIL);
  const uname = imp[2];
  const row = sql(`SELECT JSON_UNQUOTE(JSON_EXTRACT(data,'$.pass.algo')), JSON_EXTRACT(data,'$.pass.iter'), JSON_EXTRACT(data,'$.mustChangePassword') FROM docs WHERE store='users' AND JSON_UNQUOTE(JSON_EXTRACT(data,'$.username'))='${uname}'`);
  ok('military-number import stores a hash and forces a change', /^pbkdf2-sha256\s+1000\s+1$/.test(row), row);
  /* 2) الدخول بالرقم العسكري: صفحة تغيير كلمة المرور، وترقية التجزئة */
  const P = await page(); await login(P, uname, MIL);
  ok('first login with the military number opens the change-password page', /welcome/.test(await P.evaluate(() => location.hash)));
  const it2 = sql(`SELECT JSON_EXTRACT(data,'$.pass.iter') FROM docs WHERE store='users' AND JSON_UNQUOTE(JSON_EXTRACT(data,'$.username'))='${uname}'`);
  ok('login upgrades the stored hash to 100k iterations', it2 === '100000', it2);
  /* 3) كلمة مرور قديمة محفوظة نصاً: تُجزّأ تلقائياً، ويُلزم صاحبها بتغييرها */
  const lid = 'u_legacy_' + T;
  await api('push', { ops: [{ store: 'users', id: lid, rev: 0, data: { id: lid, username: 'leg' + T, name: 'حساب قديم', role: 'department', active: 1, militaryNo: MIL2, mustChangePassword: 0, pass: { algo: 'legacy', kind: 'plain', value: MIL2 } } }] }, sup);
  execSync('rm -f /tmp/sqapa_setup_*'); await api('ping');
  const lg = sql(`SELECT JSON_UNQUOTE(JSON_EXTRACT(data,'$.pass.algo')), JSON_EXTRACT(data,'$.pass.iter'), JSON_EXTRACT(data,'$.mustChangePassword'), LOCATE('${MIL2}', JSON_EXTRACT(data,'$.pass')) FROM docs WHERE store='users' AND doc_id='${lid}'`);
  ok('plain-text stored password is hashed by the server', /^pbkdf2-sha256\s+10000\s+1\s+0$/.test(lg), lg);
  ok('legacy account still logs in with its password', (await api('login', { username: 'leg' + T, password: MIL2 })).status === 200);
  /* 4) ما يصل جهاز الموظف عن الآخرين */
  const dep = (await api('login', { username: 'dep', password: 'Passw0rd!' })).j.token;
  let since = 0, users = []; for (;;) { const r = await fetch(`${B}?a=pull&since=${since}&limit=3000`, { headers: { 'X-Token': dep } }).then((x) => x.json()); users.push(...r.docs.filter((d) => d.store === 'users' && !d.deleted && d.data)); since = r.rev; if (!r.more) break; }
  const meU = users.find((u) => u.data.username === 'dep'), others = users.filter((u) => u !== meU), tech = others.find((u) => u.data.role === 'technician' && (u.data.categories || []).length);
  ok("employee no longer receives others' military numbers or usernames", others.length > 0 && others.every((u) => u.data.militaryNo === undefined && u.data.username === undefined), `${others.length} others`);
  ok('employee keeps their own full record', !!meU && meU.data.username === 'dep');
  ok('technician categories stay visible (auto-assignment)', !!tech, tech ? JSON.stringify(tech.data.categories) : 'none');
  const supTok = sup; const full = await fetch(`${B}?a=pull&since=0&limit=3000`, { headers: { 'X-Token': supTok } }).then((x) => x.json());
  ok('staff still receive full user records', full.docs.some((d) => d.store === 'users' && d.data && d.data.militaryNo));
  console.log(res.join('\n'));
  await api('push', { ops: [{ store: 'users', id: lid, rev: -1, deleted: 1 }] }, sup);
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
