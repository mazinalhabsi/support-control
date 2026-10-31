/* اختبار طرفي: مصفوفة الصلاحيات. لكل صلاحية تُمنح من شاشة الصلاحيات: حساب موظف لا يملك غيرها
   يفتح صفحاتها، وينفّذ عملياتها الفعلية من الواجهة، ويُتحقق أن الخادم لم يرفض شيئاً منها
   (كانت صلاحيات تظهر في الواجهة ويرفض الخادم عملياتها، فتعود كما كانت).
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/permissions.test.js [صلاحية,صلاحية] */
const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php', U = BASE;
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return r.json().catch(() => ({})); };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
const ONLY = (process.argv[2] || '').split(',').filter(Boolean);
const T = String(Date.now() % 100000);

/* عمليات كل صلاحية كما تنفذها الواجهة (fx: بيانات أعدّها المشرف) */
const ACT = {
  'tickets.create': ["await App.Data.tickets.create({ title: 'اختبار صلاحية الإنشاء', description: 'x', categoryId: 'other' })"],
  'tickets.work': ['await App.Data.tickets.claim(fx.tkWork)', "await App.Data.tickets.comment(fx.tkWork, 'رد من الفني')", "await App.Data.tickets.setStatus(fx.tkWork, 'in_progress')"],
  'tickets.manage': ['await App.Data.tickets.assign(fx.tkMgr, fx.techId)', "await App.Data.tickets.setPriority(fx.tkMgr, 'high')", "await App.Data.tickets.setStatus(fx.tkMgr, 'cancelled')"],
  'chat.answer': ["await App.Data.chat.send(fx.chat, 'رد على الاستفسار')"],
  'users.password': ["await App.Data.users.setPassword(fx.depId, 'Passw0rd!', 0)"],
  'forms.manage': ["const f = await App.Data.forms.save({ title: 'نموذج اختبار ' + fx.T, desc: 'x', categoryId: '', file: { name: 'x.pdf', type: 'application/pdf', size: 4, data: 'data:application/pdf;base64,JVBERg==' } }); await App.Data.forms.remove(f.id)"],
  'forms.hide': ['for (let i = 0; i < 2; i++) { const f = await App.DB.get("forms", fx.form); f.hidden = f.hidden ? 0 : 1; f.updatedAt = Date.now(); await App.DB.put("forms", f); }'],
  'backup.manage': ["await App.Data.backup.setSchedule({ on: 1, every: 'daily' })"],
  'announce.manage': ["const a = await App.Data.ann.save({ title: 'تعميم اختبار', body: 'x', level: 'info', audience: 'all' }); await App.Data.ann.remove(a.id)", "const s = (await App.Data.svc.list())[0]; await App.Data.svc.set(s.id, 'up', '')"],
  'worklog': ["const w = await App.Data.work.save({ title: 'عمل اختبار', type: 'support', hours: 1, at: Date.now() }); await App.Data.work.remove(w.id)"],
  'works': ["const f = await App.Data.works.saveFolder({ name: 'مجلد اختبار ' + fx.T }); const i = await App.Data.works.saveItem({ title: 'مهمة', folderId: f.id }); await App.Data.works.removeItem(i.id); await App.Data.works.removeFolder(f.id)"],
  'inventory.move': ["await App.Data.inv.move({ type: 'receive', itemId: fx.item, warehouseId: fx.wh, qty: 2, note: 'اختبار' })", "await App.Data.inv.move({ type: 'issue', itemId: fx.item, warehouseId: fx.wh, qty: 1, departmentId: fx.dep, note: 'صرف اختبار' })"],
  'loans.manage': ["const l = await App.Data.inv.lend({ itemId: fx.item, warehouseId: fx.wh, qty: 1, borrower: 'موظف', departmentId: fx.dep, dueAt: Date.now() + 86400000, note: '' }); await App.Data.inv.returnLoan(l.id, 1, 'سليم')"],
  'inventory.manage': ["const it = await App.Data.inv.saveItem({ name: 'صنف اختبار ' + fx.T, unit: 'حبة', categoryId: App.Data.list('itemCategories')[0].id, minQty: 0 }); await App.Data.inv.saveItem({ ...it, name: 'صنف معدّل ' + fx.T })"],
  'custody.direct': ['await App.Data.dept.addDirect({ departmentId: fx.dep, itemId: fx.item, qty: 1 })'],
  'custody.lock': ['await App.Custody.set(true)'],
  'extmaint.manage': ['await App.XM.saveCfg({ name: App.XM.name() })'],
  'vouchers.design': ['await App.VTPL.save(App.VTPL.data ? App.VTPL.data() : {})'],
  'kb.write': ["const k = await App.Data.saveRecord('kb', { title: 'مقال اختبار', body: 'خطوات', categoryId: 'other', tags: [], author: App.Auth.user.name, views: 0, helpful: 0 }, 'مقال'); await App.Data.deleteRecord('kb', k.id, 'مقال')"],
  'categories.docs': ["const c = App.Data.c.categories.get('other'); await App.Data.saveRecord('categories', { ...c, docNote: 'ملاحظة' }, 'فئة')"],
  'categories.manage': ["await App.Data.catAdmin.setHidden('other', false)"],
  'formfill.manage': ["await App.XCFG.save('formfill', 'formFill', { ...(App.Data.c.formFill || {}) }, 'التعبئة الفورية')"],
  'surveys.manage': ["await App.Surveys.save({ ...App.Surveys.blank(), title: 'استبيان اختبار' })"],
  'ratings.manage': ['await App.Ratings.save({ on: App.Ratings.cfg().on ? 1 : 0 })'],
  'replies.manage': ["const r = await App.Data.replies.save({ title: 'رد عام', text: 'نص الرد العام', scope: 'all', kind: 'ticket' }); await App.Data.replies.remove(r.id)"],
  'users.manage': ["await App.Data.users.save({ name: 'حساب اختبار الإدارة', username: 'pmnew' + fx.T, role: 'department', active: 1, departmentId: fx.dep }, 'Passw0rd!')"],
  'org.manage': ["const d = await App.Data.org.saveDept({ name: 'إدارة اختبار الصلاحية ' + fx.T }); const u = await App.Data.org.saveUnit({ departmentId: d.id, type: 'section', name: 'قسم' }); await App.Data.org.removeUnit(u.id); await App.Data.org.removeDept(d.id)"],
  'org.assign': ['await App.Data.org.assign([fx.depId], { departmentId: fx.dep2 })', 'await App.Data.org.assign([fx.depId], { departmentId: fx.depOf })'],
  'settings': ['await App.Data.saveSettings({ supportPhone: App.Data.c.settings.supportPhone })'],
  'nav.manage': ['await App.Nav.save({ ...(App.Data.c.navHide || {}) })'],
  'vault.manage': ["const v = await App.VAULT.save({ title: 'ملاحظة اختبار', type: 'general', visibility: 'shared', body: 'x' }); await App.VAULT.remove(v.id)"]
};

(async () => {
  const sup = (await api('login', { username: 'sup', password: 'Passw0rd!' })).token;
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const open = async (user) => {
    const c = await b.newContext({ viewport: { width: 1366, height: 860 } }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} });
    const p = await c.newPage(); p.setDefaultTimeout(25000); p.on('pageerror', (e) => errs.push(`${user}: ${e.message}`));
    await p.goto(U); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', user); await p.fill('[name="password"]', 'Passw0rd!'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.App && App.Auth.user, null, { timeout: 30000 }); await p.waitForTimeout(2000);
    /* رفض الخادم يصل الجهاز تعارضاً سببه «لا صلاحية» */
    await p.evaluate(() => { window.__denied = []; const r0 = App.Sync.resolve.bind(App.Sync); App.Sync.resolve = async (c) => { window.__denied.push(...c.filter((x) => x.reason === 'no_permission').map((x) => `${x.store}/${x.id}`)); return r0(c); }; });
    return p;
  };
  /* بيانات يعدّها المشرف: بلاغان، استفسار، صنف برصيد، نماذج مسجلة، وفتح الإضافة المباشرة للعهد */
  const S = await open('sup'), D = await open('dep');
  const fx = await S.evaluate(async (T) => {
    const mk = async (title) => (await App.Data.tickets.create({ title, description: 'x', categoryId: 'other' })).id;
    const users = App.Data.list('users'), deps = App.Data.list('departments'), wh = App.Data.list('warehouses')[0].id;
    const item = await App.Data.inv.saveItem({ name: 'صنف المصفوفة ' + T, unit: 'حبة', categoryId: App.Data.list('itemCategories')[0].id, minQty: 0 });
    await App.Data.inv.move({ type: 'receive', itemId: item.id, warehouseId: wh, qty: 20, note: 'رصيد اختبار' });
    const forms = await App.Data.forms.list(); const custody = await App.Custody.state().catch(() => null); await App.Custody.set(true);
    const dep = users.find((u) => u.username === 'dep');
    return { T, tkWork: await mk('بلاغ لاختبار الفني'), tkMgr: await mk('بلاغ لاختبار المدير'), techId: users.find((u) => u.username === 'tech').id, depId: dep.id, depOf: dep.departmentId || deps[0].id, dep: deps[0].id, dep2: deps[1].id, item: item.id, wh, form: forms[0].id, custodyWas: custody };
  }, T);
  fx.chat = await D.evaluate(async () => (await App.Data.chat.start({ subject: 'استفسار اختبار', text: 'مرحبا' })).id);
  await S.evaluate(() => App.Sync.flush()); await D.evaluate(() => App.Sync.flush()); await S.waitForTimeout(2500);
  const perms = (await S.evaluate(() => [...App.PERM_KEYS])).filter((p) => !ONLY.length || ONLY.includes(p));
  const routes = await S.evaluate(() => App.Router.routes.filter((r) => r.perm && !r.keys.length).map((r) => ({ path: r.re.source.slice(1, -1).replace(/\\\//g, '/'), perm: r.perm })));
  for (const perm of perms) {
    const id = `u_pm_${perm.replace(/\./g, '_')}_${T}`, uname = `pm_${perm.replace(/\./g, '_')}_${T}`;
    const salt = crypto.randomBytes(16), hash = crypto.pbkdf2Sync('Passw0rd!', salt, 1000, 32, 'sha256').toString('hex');
    await api('push', { ops: [{ store: 'users', id, rev: -1, data: { id, username: uname, name: `صلاحية ${perm}`, role: 'department', active: 1, mustChangePassword: 0, departmentId: fx.dep, extraPerms: [perm], deniedPerms: [], pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash } } }] }, sup);
    const P = await open(uname), problems = [];
    for (const r of routes.filter((x) => x.perm.split('|').includes(perm))) {
      await P.evaluate((p) => { location.hash = '#' + p; }, r.path); await P.waitForTimeout(1100);
      if (await P.evaluate(() => /لا تملك صلاحية لهذه الصفحة/.test(document.body.innerText))) problems.push(`page ${r.path} refused`);
    }
    for (const code of ACT[perm] || []) {
      const r = await P.evaluate(async ([code, fx]) => { try { await (new Function('fx', 'App', `return (async () => { ${code} })()`))(fx, window.App); return ''; } catch (e) { return e && e.message; } }, [code, fx]);
      if (r) problems.push(`action refused: ${r}`);
    }
    await P.evaluate(() => App.Sync.flush()).catch(() => null); await P.waitForTimeout(2500);
    const denied = await P.evaluate(() => window.__denied);
    if (denied.length) problems.push(`server refused: ${[...new Set(denied.map((x) => x.split('/')[0]))].join(', ')}`);
    ok(`${perm}${ACT[perm] ? '' : ' (pages only)'}`, !problems.length, problems.join(' | '));
    await P.context().close();
    await api('push', { ops: [{ store: 'users', id, rev: -1, deleted: 1 }] }, sup);
  }
  if (!fx.custodyWas || !fx.custodyWas.open) await S.evaluate(() => App.Custody.set(false)).catch(() => null);
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
