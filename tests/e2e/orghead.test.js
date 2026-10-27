/* اختبار طرفي: رئاسة الإدارات والفروع وسجل تغييرات الهيكل.
   رئيس الفرع يدير ما تحته فقط (في الواجهة وعلى الخادم)، ورئيس الإدارة يعدّل إدارته ولا يحذفها،
   وكل إجراء يُسجَّل ويمكن التراجع عنه، وما تعدّل بعد الإجراء لا يُكتب فوقه.
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/orghead.test.js */
const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php', U = BASE;
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
const docs = async (tok) => { let since = 0; const out = []; for (;;) { const r = await fetch(`${B}?a=pull&since=${since}&limit=3000`, { headers: { 'X-Token': tok } }).then((x) => x.json()); out.push(...r.docs); since = r.rev; if (!r.more) break; } const m = new Map(); out.forEach((d) => m.set(`${d.store}:${d.id}`, d)); return m; };
const mkUser = (id, username, extra = {}) => { const salt = crypto.randomBytes(16), hash = crypto.pbkdf2Sync('Passw0rd!', salt, 1000, 32, 'sha256').toString('hex'); return { store: 'users', id, rev: -1, data: { id, username, name: 'حساب ' + username, role: 'department', active: 1, mustChangePassword: 0, pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash }, createdAt: Date.now(), updatedAt: Date.now(), ...extra } }; };
const applied = (r) => (r.j.applied || []).length === 1;
(async () => {
  const T = String(Date.now() % 100000), sup = (await api('login', { username: 'sup', password: 'Passw0rd!' })).j.token;
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const errs = [];
  const page = async (user = 'sup') => {
    const c = await b.newContext({ viewport: { width: 1400, height: 900 } }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} });
    const p = await c.newPage(); p.setDefaultTimeout(20000); p.on('pageerror', (e) => errs.push(`${user}: ${e.message}`));
    await p.goto(U); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', user); await p.fill('[name="password"]', 'Passw0rd!'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.App && App.Auth.user, null, { timeout: 20000 }); await p.waitForTimeout(1500); return p;
  };
  const settle = async (p) => { await p.evaluate(() => App.Sync.flush()).catch(() => null); await p.waitForTimeout(2500); };
  const S = await page();
  /* الهيكل: إدارة D فيها «قسم أ» (وتحته «شعبة ب») و«قسم ج»، وإدارة E فيها «قسم د» */
  const DN = `إدارة الرئاسة ${T}`, EN = `إدارة أخرى ${T}`;
  await S.evaluate(async ([d, e, t]) => App.Data.org.buildOutline(App.Data.org.planOutline(`${d}\n  قسم أ ${t}\n    شعبة ب ${t}\n  قسم ج ${t}\n${e}\n  قسم د ${t}`)), [DN, EN, T]);
  const ids = await S.evaluate(async ([d, e, t]) => { const deps = App.Data.list('departments'), units = await App.DB.getAll('deptUnits'), D = deps.find((x) => x.name === d), E = deps.find((x) => x.name === e), u = (n) => (units.find((x) => x.name === n) || {}).id; return { D: D.id, E: E.id, X: u(`قسم أ ${t}`), Y: u(`شعبة ب ${t}`), Z: u(`قسم ج ${t}`), W: u(`قسم د ${t}`) }; }, [DN, EN, T]);
  ok('test structure built', Object.values(ids).every(Boolean), JSON.stringify(ids));
  const H1 = `u_h1_${T}`, H2 = `u_h2_${T}`, M1 = `u_m1_${T}`, M2 = `u_m2_${T}`, M3 = `u_m3_${T}`, M4 = `u_m4_${T}`;
  await api('push', { ops: [mkUser(H1, `h1${T}`, { departmentId: ids.D, unitId: ids.X }), mkUser(H2, `h2${T}`, { departmentId: ids.D }), mkUser(M1, `m1${T}`, { departmentId: ids.D, unitId: ids.Y }), mkUser(M2, `m2${T}`, { departmentId: ids.D, unitId: ids.Z }), mkUser(M3, `m3${T}`, { orgText: 'قسم أ' }), mkUser(M4, `m4${T}`, { departmentId: ids.E, unitId: ids.W })] }, sup);
  await S.evaluate(() => App.Sync.pull()); await S.waitForTimeout(1200);
  /* تعيين الرئيسين من نافذة التعديل نفسها */
  await S.evaluate(() => { location.hash = '#/org'; }); await S.waitForTimeout(1200);
  await S.click(`[data-editunit="${ids.X}"]`); await S.waitForSelector('dialog [name="headId"]');
  await S.fill('dialog [data-headq]', `h1${T}`); await S.waitForTimeout(200);
  ok('head picker search selects the matching account', (await S.inputValue('dialog [name="headId"]')) === H1);
  await S.click('dialog button.btn-primary'); await S.waitForTimeout(800);
  await S.evaluate(async ([d, h]) => App.Data.org.saveDept({ ...App.Data.c.departments.get(d), headId: h }), [ids.D, H2]);
  await settle(S);
  let m = await docs(sup);
  ok('heads saved on the server', m.get(`deptUnits:${ids.X}`).data.headId === H1 && m.get(`departments:${ids.D}`).data.headId === H2);
  const tok1 = (await api('login', { username: `h1${T}`, password: 'Passw0rd!' })).j.token;

  /* 1) رئيس الفرع في الواجهة: يرى صفحة الهيكل، وأدوات التعديل على ما تحت فرعه فقط */
  const P = await page(`h1${T}`);
  const perm = await P.evaluate(() => App.Auth.can('org.manage|org.assign|org.head'));
  ok('unit head gets the structure page from the structure itself', perm);
  await P.evaluate(() => { location.hash = '#/org'; }); await P.waitForTimeout(1800);
  const ui = await P.evaluate((x) => ({ banner: document.body.innerText.includes(`رئاستك: `), editX: !!document.querySelector(`[data-editunit="${x.X}"]`), delX: !!document.querySelector(`[data-delunit="${x.X}"]`), delY: !!document.querySelector(`[data-delunit="${x.Y}"]`), editZ: !!document.querySelector(`[data-editunit="${x.Z}"]`), editD: !!document.querySelector(`[data-editdep="${x.D}"]`), adddep: !!document.querySelector('[data-act="adddep"]'), log: !!document.querySelector('[data-act="log"]') }), ids);
  ok('unit head: edits own unit but cannot delete it', ui.banner && ui.editX && !ui.delX, JSON.stringify(ui));
  ok('unit head: full control below, nothing outside', ui.delY && !ui.editZ && !ui.editD && !ui.adddep && ui.log, JSON.stringify(ui));
  /* موضع «يتبع» مقفل في نافذة الفرع الذي يرأسه، وحقل الرئيس مقفل */
  await P.click(`[data-editunit="${ids.X}"]`); await P.waitForSelector('dialog [name="headId"]');
  const lock = await P.evaluate(() => ({ head: document.querySelector('dialog [name="headId"]').disabled, parent: document.querySelector('dialog [name="parentId"]').disabled }));
  ok('own unit: parent and head locked in the dialog', lock.head && lock.parent, JSON.stringify(lock));
  await P.fill('dialog [name="phone"]', '1234'); await P.click('dialog button.btn-primary'); await P.waitForTimeout(800);

  /* 2) عمليات الرئيس عبر الواجهة: فرع جديد، نقل حساب، ضم حساب بلا إدارة، تعيين رئيس فرعي */
  const NEWB = `شعبة جديدة ${T}`;
  await P.evaluate(async ([d, x, n]) => App.Data.org.saveUnit({ departmentId: d, parentId: x, type: 'branch', name: n }), [ids.D, ids.X, NEWB]);
  await P.evaluate(async ([x, d, a, c]) => { await App.Data.org.assign([a], { departmentId: d, unitId: x }); await App.Data.org.assign([c], { departmentId: d, unitId: x }); }, [ids.X, ids.D, M1, M3]);
  await P.evaluate(async ([y, h]) => { const u = await App.DB.get('deptUnits', y); return App.Data.org.saveUnit({ ...u, headId: h }); }, [ids.Y, M1]);
  const outside = await P.evaluate(async ([d, x, c, z]) => { const r = []; for (const f of [() => App.Data.org.assign([c], { departmentId: d, unitId: x }), () => App.Data.org.removeUnit(x), async () => { const u = await App.DB.get('deptUnits', x); return App.Data.org.saveUnit({ ...u, parentId: z }); }]) { try { await f(); r.push('done'); } catch (e) { r.push(e.message); } } return r; }, [ids.D, ids.X, M2, ids.Z]);
  ok('client refuses moves and deletes outside the head scope', outside.every((x) => x !== 'done'), outside.join(' | '));
  await settle(P);
  m = await docs(sup);
  const nb = [...m.values()].find((d) => d.store === 'deptUnits' && !d.deleted && d.data.name === NEWB);
  ok('new branch under own unit saved on the server', !!nb && nb.data.parentId === ids.X);
  ok('member moved inside the scope and unassigned account pulled in', m.get(`users:${M1}`).data.unitId === ids.X && m.get(`users:${M3}`).data.unitId === ids.X);
  ok('sub-head assigned and own unit details saved', m.get(`deptUnits:${ids.Y}`).data.headId === M1 && m.get(`deptUnits:${ids.X}`).data.phone === '1234');
  ok('account outside the scope untouched', m.get(`users:${M2}`).data.unitId === ids.Z);

  /* 3) الخادم يفرض الرئاسة نفسها لو تجاوز أحد الواجهة */
  const dx = m.get(`deptUnits:${ids.X}`).data, dy = m.get(`deptUnits:${ids.Y}`).data, dd = m.get(`departments:${ids.D}`).data, u2 = m.get(`users:${M2}`).data, u4 = m.get(`users:${M4}`).data;
  const deny = {
    deleteOwn: await api('push', { ops: [{ store: 'deptUnits', id: ids.X, rev: -1, deleted: 1 }] }, tok1),
    headOwn: await api('push', { ops: [{ store: 'deptUnits', id: ids.X, rev: -1, data: { ...dx, headId: M2 } }] }, tok1),
    moveOwn: await api('push', { ops: [{ store: 'deptUnits', id: ids.X, rev: -1, data: { ...dx, parentId: ids.Z } }] }, tok1),
    moveOut: await api('push', { ops: [{ store: 'deptUnits', id: ids.Y, rev: -1, data: { ...dy, parentId: ids.Z } }] }, tok1),
    otherDept: await api('push', { ops: [{ store: 'deptUnits', id: ids.Y, rev: -1, data: { ...dy, departmentId: ids.E, parentId: ids.X } }] }, tok1),
    newOutside: await api('push', { ops: [{ store: 'deptUnits', id: `un_x_${T}`, rev: 0, data: { id: `un_x_${T}`, departmentId: ids.D, parentId: ids.Z, name: 'ممنوع' } }] }, tok1),
    dept: await api('push', { ops: [{ store: 'departments', id: ids.D, rev: -1, data: { ...dd, name: 'ممنوع' } }] }, tok1),
    userOut: await api('push', { ops: [{ store: 'users', id: M2, rev: -1, data: { ...u2, unitId: ids.X } }] }, tok1),
    userIn: await api('push', { ops: [{ store: 'users', id: M4, rev: -1, data: { ...u4, departmentId: ids.D, unitId: ids.X } }] }, tok1)
  };
  const leaked = Object.entries(deny).filter(([, r]) => applied(r)).map(([k]) => k);
  ok('server rejects every write outside the head scope', !leaked.length, leaked.join(', '));
  const allow = await api('push', { ops: [{ store: 'deptUnits', id: ids.X, rev: -1, data: { ...dx, name: `قسم أ ${T}`, room: 'الطابق الثاني' } }] }, tok1);
  ok('server accepts own unit details', applied(allow));

  /* 4) رئيس الإدارة: يعدّل إدارته ولا يحذفها ولا يغيّر رئيسها، ويحذف ما تحتها */
  const tok2 = (await api('login', { username: `h2${T}`, password: 'Passw0rd!' })).j.token;
  m = await docs(sup); const dd2 = m.get(`departments:${ids.D}`).data;
  const d1 = await api('push', { ops: [{ store: 'departments', id: ids.D, rev: -1, data: { ...dd2, phone: '5555' } }] }, tok2);
  const d2 = await api('push', { ops: [{ store: 'departments', id: ids.D, rev: -1, data: { ...dd2, headId: H1 } }] }, tok2);
  const d3 = await api('push', { ops: [{ store: 'departments', id: ids.D, rev: -1, deleted: 1 }] }, tok2);
  const d4 = await api('push', { ops: [{ store: 'departments', id: ids.E, rev: -1, data: { ...m.get(`departments:${ids.E}`).data, phone: '1' } }] }, tok2);
  ok('department head edits own department only', applied(d1) && !applied(d2) && !applied(d3) && !applied(d4), [d1, d2, d3, d4].map(applied).join(','));

  /* 5) سجل التغييرات: كل إجراء للرئيس مسجل باسمه، ولا يرى سجل غيره، ولا يحذفه */
  const l1 = [...(await docs(tok1)).values()].filter((d) => d.store === 'orgLog' && !d.deleted);
  ok('head actions are logged under the head', l1.length >= 4 && l1.every((d) => d.data.userId === H1), String(l1.length));
  const supLog = [...(await docs(sup)).values()].find((d) => d.store === 'orgLog' && !d.deleted && d.data.userId !== H1);
  const spoof = await api('push', { ops: [{ store: 'orgLog', id: supLog.id, rev: -1, data: { ...supLog.data, undoneAt: Date.now() } }, { store: 'orgLog', id: l1[0].id, rev: -1, deleted: 1 }] }, tok1);
  ok('head cannot mark others\' entries undone or delete entries', !(spoof.j.applied || []).length);

  /* 6) التراجع من نافذة السجل: الرئيس يتراجع عن ضم الحساب، فيعود بلا إدارة */
  await P.evaluate(() => { location.hash = '#/org'; }); await P.waitForTimeout(1200);
  await P.click('[data-act="log"]'); await P.waitForSelector('dialog [data-undo]');
  const entries = await P.$$eval('dialog .org-log > .row .grow > b', (x) => x.map((e) => e.textContent));
  ok('history window lists own actions', entries.length >= 4, entries.slice(0, 3).join(' | '));
  const target = await P.evaluate((m3) => App.DB.getAll('orgLog').then((all) => (all.filter((e) => e.action === 'assign' && e.changes.some((c) => c.id === m3)).sort((a, b) => b.at - a.at)[0] || {}).id), M3);
  await P.click(`dialog [data-undo="${target}"]`); await P.waitForTimeout(400);
  await P.click('dialog[open]:last-of-type button.btn-primary'); await P.waitForTimeout(1200);
  await P.click('dialog [data-x]'); await settle(P);
  m = await docs(sup);
  ok('undo restores the account to its previous place', !m.get(`users:${M3}`).data.departmentId && m.get(`users:${M1}`).data.unitId === ids.X);
  ok('undone entry marked, and the undo itself logged', !!m.get(`orgLog:${target}`).data.undoneAt && [...m.values()].some((d) => d.store === 'orgLog' && d.data.action === 'undo' && d.data.userId === H1));

  /* 7) قيد مزوّر يكتبه الرئيس بنفسه (حالة سابقة تجعله رئيساً لإدارة أخرى): تراجع المشرف عنه لا يطبّق ما لا يملكه صاحبه،
        وقيده الصحيح (فرع أضافه تحت فرعه) يُتراجع عنه */
  m = await docs(sup);
  const de = m.get(`departments:${ids.E}`).data, fid = `ol_forge_${T}`;
  const forged = await api('push', { ops: [{ store: 'orgLog', id: fid, rev: 0, data: { id: fid, at: Date.now(), userId: H1, action: 'update', summary: 'تعديل بسيط', nodes: [ids.D], changes: [{ store: 'departments', id: ids.E, before: { ...de, headId: H1 }, after: de }] } }] }, tok1);
  await S.evaluate(() => App.Sync.pull()); await S.waitForTimeout(800);
  const fr = await S.evaluate(async (id) => App.OrgLog.undo(await App.DB.get('orgLog', id)), fid);
  const legit = await S.evaluate(async ([h, n]) => { const e = (await App.DB.getAll('orgLog')).find((x) => x.userId === h && x.action === 'create' && x.changes.some((c) => c.after && c.after.name === n)); return App.OrgLog.undo(e); }, [H1, NEWB]);
  await settle(S);
  m = await docs(sup);
  ok('forged entry: undo applies nothing the author could not do', applied(forged) && fr.denied === 1 && fr.undone === 0 && !m.get(`departments:${ids.E}`).data.headId, JSON.stringify(fr));
  ok('genuine head entry undone by the supervisor', legit.undone === 1 && m.get(`deptUnits:${nb.id}`).deleted === 1, JSON.stringify(legit));

  /* 8) تراجع المشرف عن حذف فرع: يعود الفرع بفروعه وحساباته، وما تعدّل بعد الحذف يبقى كما هو */
  const del = await S.evaluate(async (z) => { await App.Data.org.removeUnit(z, { keepKids: false }); const all = await App.DB.getAll('orgLog'); return all.filter((e) => e.action === 'delete').sort((a, b) => b.at - a.at)[0]; }, ids.Z);
  await settle(S);
  m = await docs(sup);
  ok('unit deleted and its account moved up', (!m.get(`deptUnits:${ids.Z}`) || m.get(`deptUnits:${ids.Z}`).deleted === 1) && !m.get(`users:${M2}`).data.unitId);
  /* حساب أُضيف للاختبار يُنقل بعد الحذف: التراجع لا يكتب فوقه */
  await S.evaluate(async ([m2, e, w]) => App.Data.org.assign([m2], { departmentId: e, unitId: w }), [M2, ids.E, ids.W]);
  const r = await S.evaluate(async (id) => App.OrgLog.undo(await App.DB.get('orgLog', id)), del.id);
  await settle(S);
  m = await docs(sup);
  ok('undo re-creates the deleted unit', m.get(`deptUnits:${ids.Z}`) && !m.get(`deptUnits:${ids.Z}`).deleted && m.get(`deptUnits:${ids.Z}`).data.name === `قسم ج ${T}`);
  ok('change made after the action is kept, and reported', r.kept === 1 && m.get(`users:${M2}`).data.unitId === ids.W, JSON.stringify(r));
  const twice = await S.evaluate(async (id) => App.OrgLog.undo(await App.DB.get('orgLog', id)).then(() => 'done', (e) => e.message), del.id);
  ok('an action cannot be undone twice', twice !== 'done', twice);

  /* تنظيف */
  await api('push', { ops: [H1, H2, M1, M2, M3, M4].map((id) => ({ store: 'users', id, rev: -1, deleted: 1 })) }, sup);
  await S.evaluate(async (names) => { for (const n of names) { const d = App.Data.list('departments').find((x) => x.name === n); if (d) await App.Data.org.removeDept(d.id, {}).catch(() => null); } }, [DN, EN]);
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
