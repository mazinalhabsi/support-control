/* اختبار طرفي: الهيكل التنظيمي أساس الحسابات — البناء من قائمة، ونقل الحسابات، والحذف مع مصير الحسابات،
   والحسابات بلا إدارة، وصلاحية «توزيع الحسابات على الهيكل»، والتحديث المباشر بين جهازين.
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/org.test.js */
const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php', U = BASE;
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
const docs = async (tok) => { let since = 0; const out = []; for (;;) { const r = await fetch(`${B}?a=pull&since=${since}&limit=3000`, { headers: { 'X-Token': tok } }).then((x) => x.json()); out.push(...r.docs); since = r.rev; if (!r.more) break; } const m = new Map(); out.forEach((d) => m.set(`${d.store}:${d.id}`, d)); return m; };
const mkUser = (id, username, extra = {}) => { const salt = crypto.randomBytes(16), hash = crypto.pbkdf2Sync('Passw0rd!', salt, 1000, 32, 'sha256').toString('hex'); return { store: 'users', id, rev: -1, data: { id, username, name: 'حساب ' + username, role: 'department', active: 1, mustChangePassword: 0, pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash }, createdAt: Date.now(), updatedAt: Date.now(), ...extra } }; };
(async () => {
  const T = String(Date.now() % 100000), sup = (await api('login', { username: 'sup', password: 'Passw0rd!' })).j.token;
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const errs = [];
  const page = async (user = 'sup') => {
    const c = await b.newContext({ viewport: { width: 1400, height: 900 } }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} });
    const p = await c.newPage(); p.setDefaultTimeout(20000); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(U); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', user); await p.fill('[name="password"]', 'Passw0rd!'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.App && App.Auth.user, null, { timeout: 20000 }); await p.waitForTimeout(1500); return p;
  };
  const S = await page();
  const D1 = `هيكل تجريبي ${T}`, D2 = `هيكل الدمج ${T}`;
  /* 1) البناء من قائمة: إدارتان بأقسامهما، والتكرار لا يُنشئ شيئاً */
  await S.evaluate(() => { location.hash = '#/org'; }); await S.waitForTimeout(1200);
  await S.click('[data-act="outline"]');
  await S.fill('dialog [name="outline"]', `${D1}\n  قسم الشبكات ${T}\n    شعبة الخوادم ${T}\n  قسم الدعم ${T}\n${D2}\n  قسم الشبكات ${T}`);
  await S.waitForTimeout(600);
  const prev = await S.textContent('dialog [data-prev]');
  ok('outline preview lists new nodes', /6 جديد/.test(prev) || /٦ جديد/.test(prev), prev.slice(0, 80));
  await S.click('dialog button.btn-primary'); await S.waitForTimeout(1500);
  const ids = await S.evaluate(async ([d1, d2, t]) => { const deps = App.Data.list('departments'), units = await App.DB.getAll('deptUnits'); const a = deps.find((d) => d.name === d1), z = deps.find((d) => d.name === d2); const u = (dep, n) => (units.find((x) => x.departmentId === dep && x.name === n) || {}).id; return { a: a && a.id, z: z && z.id, net: a && u(a.id, `قسم الشبكات ${t}`), srv: a && u(a.id, `شعبة الخوادم ${t}`), sup: a && u(a.id, `قسم الدعم ${t}`), znet: z && u(z.id, `قسم الشبكات ${t}`) }; }, [D1, D2, T]);
  ok('outline created departments and nested units', Object.values(ids).every(Boolean), JSON.stringify(ids));
  const again = await S.evaluate(async ([d1, t]) => { const r = await App.Data.org.buildOutline(App.Data.org.planOutline(`${d1}\n  قسم الشبكات ${t}`)); return r.deps + r.units; }, [D1, T]);
  ok('running the same outline again creates nothing', again === 0, String(again));
  /* 2) حسابات تجريبية في الإدارة الأولى، ونقلها من نافذة الحسابات */
  const uA = `u_org_a_${T}`, uB = `u_org_b_${T}`, uC = `u_org_c_${T}`;
  await api('push', { ops: [mkUser(uA, `orga${T}`, { departmentId: ids.a, unitId: ids.srv }), mkUser(uB, `orgb${T}`, { departmentId: ids.a, unitId: ids.net }), mkUser(uC, `orgc${T}`, { departmentId: ids.a, unitId: '' })] }, sup);
  await S.evaluate(() => App.Sync.pull()); await S.waitForTimeout(1500);
  await S.click(`[data-members="${ids.a}|"]`); await S.waitForSelector('dialog [data-list] .list-row');
  const listed = await S.$$eval('dialog [data-list] .list-row b', (x) => x.map((e) => e.textContent));
  ok('position dialog lists the department accounts', listed.length === 3, listed.join('، '));
  await S.check(`dialog [data-pick="${uC}"]`); await S.selectOption('dialog [data-to]', `${ids.a}|${ids.sup}`); await S.click('dialog [data-move]'); await S.waitForTimeout(1200);
  await S.click('dialog [data-x]'); await S.waitForTimeout(2500);
  let m = await docs(sup);
  ok('moved account saved on the server', (m.get(`users:${uC}`).data.unitId || '') === ids.sup);
  /* 3) حذف قسم له فرع: يرتفع الفرع مستوى، وتنتقل حسابات القسم إلى الإدارة */
  await S.evaluate(async (id) => App.Data.org.removeUnit(id, { keepKids: true }), ids.net); await S.waitForTimeout(2500);
  m = await docs(sup);
  ok('deleting a section moves its accounts up one level', (m.get(`users:${uB}`).data.unitId || '') === '' && m.get(`users:${uB}`).data.departmentId === ids.a);
  ok('its sub-branch moves up with its accounts', (m.get(`deptUnits:${ids.srv}`).data.parentId || '') === '' && m.get(`users:${uA}`).data.unitId === ids.srv);
  /* 4) حذف الإدارة مع نقلها إلى إدارة أخرى: تُدمج الأقسام المتماثلة الاسم */
  /* قسم بالاسم نفسه في الإدارتين، فيه حساب، ليُدمج عند النقل */
  await S.evaluate(async ([a, t]) => App.Data.org.saveUnit({ departmentId: a, type: 'section', name: `قسم الشبكات ${t}` }), [ids.a, T]);
  await S.evaluate(async ([a, t, uid]) => { const units = await App.DB.getAll('deptUnits'), n = units.find((x) => x.departmentId === a && x.name === `قسم الشبكات ${t}`); await App.Data.org.assign([uid], { departmentId: a, unitId: n.id }); }, [ids.a, T, uB]);
  await S.evaluate(() => { location.hash = '#/org'; }); await S.waitForTimeout(1200);
  await S.click(`[data-deldep="${ids.a}"]`); await S.waitForSelector('dialog [name="moveTo"]');
  await S.selectOption('dialog [name="moveTo"]', ids.z); await S.click('dialog button.btn-danger'); await S.waitForTimeout(3000);
  m = await docs(sup);
  ok('department deleted on the server', !m.get(`departments:${ids.a}`) || m.get(`departments:${ids.a}`).deleted === 1);
  ok('its accounts moved to the chosen department', [uA, uB, uC].every((x) => m.get(`users:${x}`).data.departmentId === ids.z));
  ok('same-named section merged (no duplicate)', m.get(`users:${uB}`).data.unitId === ids.znet && [...m.values()].filter((d) => d.store === 'deptUnits' && !d.deleted && d.data.departmentId === ids.z && d.data.name === `قسم الشبكات ${T}`).length === 1);
  /* 5) حذف الإدارة مع إبقاء الحسابات بلا إدارة، ثم اقتراح موضعها حين تعود */
  await S.evaluate(async (z) => App.Data.org.removeDept(z, { moveTo: '' }), ids.z); await S.waitForTimeout(2500);
  m = await docs(sup);
  ok('accounts kept without a department, remembering their old place', [uA, uB, uC].every((x) => !m.get(`users:${x}`).data.departmentId && /هيكل الدمج/.test(m.get(`users:${x}`).data.orgText || '')), m.get(`users:${uA}`).data.orgText);
  const back = await S.evaluate(async (name) => { const d = await App.Data.org.saveDept({ name }); const lost = await App.Data.org.unassigned(); return lost.filter((r) => r.suggest && r.suggest.departmentId === d.id).length; }, D2);
  ok('unassigned list suggests the re-created department', back >= 3, String(back));
  await S.evaluate(() => { location.hash = '#/org'; }); await S.waitForTimeout(1200);
  await S.click('[data-act="lost"]'); await S.waitForSelector('dialog [data-all]'); await S.click('dialog [data-all]'); await S.click('dialog .btn-primary'); await S.waitForTimeout(2500);
  m = await docs(sup);
  ok('suggestions applied in one step', [uA, uB, uC].every((x) => !!m.get(`users:${x}`).data.departmentId));
  /* 6) صلاحية «توزيع الحسابات على الهيكل» دون تعديل الهيكل */
  const dz = m.get(`users:${uA}`).data.departmentId, asg = `u_org_asg_${T}`;
  await api('push', { ops: [mkUser(asg, `orgasg${T}`, { role: 'technician', extraPerms: ['org.assign'] })] }, sup);
  const atok = (await api('login', { username: `orgasg${T}`, password: 'Passw0rd!' })).j.token;
  const ud = m.get(`users:${uA}`).data;
  const r1 = (await api('push', { ops: [{ store: 'users', id: uA, rev: -1, data: { ...ud, departmentId: '', unitId: '', name: 'تغيير الاسم ممنوع' } }] }, atok)).j;
  m = await docs(sup);
  ok('assigner can move an account (department only, other fields untouched)', (r1.applied || []).length === 1 && !m.get(`users:${uA}`).data.departmentId && m.get(`users:${uA}`).data.name === ud.name);
  const r2 = (await api('push', { ops: [{ store: 'departments', id: `dep_x_${T}`, rev: 0, data: { id: `dep_x_${T}`, name: 'إدارة ممنوعة' } }] }, atok)).j;
  ok('assigner cannot change the structure itself', !(r2.applied || []).length);
  const A = await page(`orgasg${T}`); await A.evaluate(() => { location.hash = '#/org'; }); await A.waitForTimeout(1500);
  const ui = await A.evaluate(() => ({ people: !!document.querySelector('[data-members]'), add: !!document.querySelector('[data-act="adddep"]'), lost: !!document.querySelector('[data-act="lost"]') }));
  ok('assigner sees account tools but no structure editing', ui.people && ui.lost && !ui.add, JSON.stringify(ui));
  /* 7) التحديث المباشر: إدارة تُضاف على جهاز تظهر في صفحة الهيكل المفتوحة على جهاز آخر دون تحديث */
  const live = `إدارة مباشرة ${T}`;
  await S.evaluate(async (name) => App.Data.org.saveDept({ name }), live);
  let seen = false; for (let i = 0; i < 12 && !seen; i++) { await A.waitForTimeout(2000); seen = await A.evaluate((n) => document.body.innerText.includes(n), live); }
  ok('a department added on another device appears without refresh', seen);
  /* تنظيف */
  const ops = [uA, uB, uC, asg].map((id) => ({ store: 'users', id, rev: -1, deleted: 1 }));
  await api('push', { ops }, sup);
  await S.evaluate(async ([names]) => { for (const n of names) { const d = App.Data.list('departments').find((x) => x.name === n); if (d) await App.Data.org.removeDept(d.id, {}).catch(() => null); } }, [[D1, D2, live]]);
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
