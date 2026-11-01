/* اختبار طرفي: إضافة الهيكل دفعة واحدة.
   - إدارات كثيرة في نافذة واحدة، ومعها أقسامها ومكاتبها بالإزاحة، ونسخ أقسام إدارة قائمة إليها
   - فروع كثيرة داخل إدارة أو فرع، بأنواعها من أول كلمة، وفي قيد واحد في سجل التغييرات، والبدء بفروع موضع قائم
   - نسخ فرع بكل ما تحته إلى إدارات أخرى، وتصدير الهيكل إلى Excel ولصقه من جديد دون تكرار
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/orgbulk.test.js */
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const crypto = require('crypto');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php', U = BASE;
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return r.json().catch(() => ({})); };
const pull = async (tok) => { let since = 0; const out = []; for (;;) { const r = await fetch(`${B}?a=pull&since=${since}&limit=3000`, { headers: { 'X-Token': tok } }).then((x) => x.json()); out.push(...r.docs); since = r.rev; if (!r.more) return out; } };
const mkUser = (id, username, extra = {}) => { const salt = crypto.randomBytes(16), hash = crypto.pbkdf2Sync('Passw0rd!', salt, 1000, 32, 'sha256').toString('hex'); return { store: 'users', id, rev: -1, data: { id, username, name: 'حساب ' + username, role: 'department', active: 1, mustChangePassword: 0, extraPerms: [], deniedPerms: [], pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash }, createdAt: Date.now(), updatedAt: Date.now(), ...extra } }; };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
(async () => {
  const T = String(Date.now() % 100000), sup = (await api('login', { username: 'sup', password: 'Passw0rd!' })).token;
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); localStorage.setItem('sq_org_mode', 'cards'); } catch (_) {} });
  const S = await c.newPage(); S.setDefaultTimeout(25000); S.on('pageerror', (e) => errs.push(e.message));
  await S.goto(U); await S.waitForSelector('[name="username"]'); await S.fill('[name="username"]', 'sup'); await S.fill('[name="password"]', 'Passw0rd!'); await S.keyboard.press('Enter');
  await S.waitForFunction(() => window.App && App.Auth.user); await S.waitForTimeout(1500);
  const go = async () => { await S.evaluate(() => { location.hash = '#/dashboard'; }); await S.waitForTimeout(300); await S.evaluate(() => { location.hash = '#/org'; }); await S.waitForSelector('.page-head [data-act="adddep"]'); await S.waitForTimeout(600); };
  const settle = async () => { await S.evaluate(() => App.Sync.flush()); await S.waitForTimeout(2500); };
  const struct = async () => { const docs = await pull(sup), deps = docs.filter((d) => d.store === 'departments' && !d.deleted).map((d) => d.data), units = docs.filter((d) => d.store === 'deptUnits' && !d.deleted).map((d) => d.data); return { deps, units, dep: (n) => deps.find((d) => d.name === n), kids: (depId, pid = '') => units.filter((u) => u.departmentId === depId && (u.parentId || '') === pid) }; };
  const logCount = () => S.evaluate(async () => (await App.DB.getAll('orgLog')).length);
  const D = (k) => `${k} ${T}`;

  /* 1) ثلاث إدارات بأقسامها ومكاتبها في نافذة واحدة */
  await go(); await S.click('.page-head [data-act="adddep"]'); await S.waitForSelector('dialog [name="outline"]');
  const text = `${D('الموارد')}\n  قسم شؤون الموظفين\n    مكتب الملفات\n  قسم التدريب\n${D('المالية')}\n  قسم الحسابات\n  قسم المشتريات\n${D('الخدمات')}`;
  await S.fill('dialog [name="outline"]', text); await S.waitForTimeout(600);
  const prev = await S.textContent('dialog [data-prev]');
  ok('preview counts everything as new', /8 جديد/.test(prev), prev.slice(0, 60));
  const logs0 = await logCount();
  await S.click('dialog .btn-primary'); await S.waitForTimeout(1500); await settle();
  let st = await struct(); const hr = st.dep(D('الموارد')), fin = st.dep(D('المالية')), svc = st.dep(D('الخدمات'));
  const emp = hr && st.kids(hr.id).find((u) => u.name === 'قسم شؤون الموظفين'), files = emp && st.kids(hr.id, emp.id)[0];
  ok('three departments with their sections added at once', !!(hr && fin && svc) && st.kids(hr.id).length === 2 && st.kids(fin.id).length === 2);
  ok('nested office lands under its section with the office type', !!files && files.name === 'مكتب الملفات' && files.type === 'office', JSON.stringify(files && { n: files.name, t: files.type }));
  ok('the whole addition is one entry in the change history', (await logCount()) === logs0 + 1, `${logs0} -> ${await logCount()}`);
  /* 2) نفس القائمة مرة أخرى: لا شيء يتكرر */
  await S.click('.page-head [data-act="adddep"]'); await S.waitForSelector('dialog [name="outline"]'); await S.fill('dialog [name="outline"]', text); await S.waitForTimeout(600);
  ok('the same list again shows nothing new', /0 جديد/.test(await S.textContent('dialog [data-prev]')));
  /* زر Tab يزيح السطر داخل الخانة بدل الخروج منها، وShift+Tab يرجعه */
  await S.fill('dialog [name="outline"]', ''); await S.click('dialog [name="outline"]');
  await S.keyboard.type('إدارة'); await S.keyboard.press('Enter'); await S.keyboard.press('Tab'); await S.keyboard.type('قسم'); await S.keyboard.press('Enter'); await S.keyboard.press('Tab'); await S.keyboard.press('Tab'); await S.keyboard.type('مكتب');
  const tabbed = await S.inputValue('dialog [name="outline"]'); await S.keyboard.press('Shift+Tab');
  ok('Tab indents inside the box and Shift+Tab outdents', tabbed === 'إدارة\n  قسم\n    مكتب' && (await S.inputValue('dialog [name="outline"]')) === 'إدارة\n  قسم\n  مكتب', JSON.stringify(tabbed));
  await S.click('dialog [data-x]');
  /* 3) إدارتان جديدتان تأخذان أقسام إدارة قائمة */
  await S.click('.page-head [data-act="adddep"]'); await S.waitForSelector('dialog [name="outline"]');
  await S.fill('dialog [name="outline"]', `${D('الإدارة أ')}\n${D('الإدارة ب')}`); await S.selectOption('dialog [name="copyfrom"]', hr.id); await S.waitForTimeout(500);
  await S.click('dialog .btn-primary'); await S.waitForTimeout(1500); await settle();
  st = await struct();
  const da = st.dep(D('الإدارة أ')), db = st.dep(D('الإدارة ب')), names = (d) => st.kids(d.id).map((u) => u.name).sort().join('|');
  ok('new departments take the sections of an existing one, nested levels included', !!(da && db) && names(da) === names(hr) && names(db) === names(hr) && st.units.some((u) => u.departmentId === da.id && u.name === 'مكتب الملفات'));

  /* 4) فروع كثيرة داخل إدارة: النوع من أول كلمة، والموجود لا يتكرر */
  await go(); await S.click(`[data-addunit="${svc.id}"][data-parent=""]`); await S.waitForSelector('dialog [name="lines"]');
  await S.fill('dialog [name="lines"]', 'قسم النقل\n  شعبة الصيانة\n  مكتب الحركة\nالمستودع\nقسم النقل'); await S.waitForTimeout(600);
  const logs1 = await logCount();
  await S.click('dialog .btn-primary'); await S.waitForTimeout(1500); await settle();
  st = await struct();
  const top = st.kids(svc.id), trans = top.find((u) => u.name === 'قسم النقل'), sub = trans ? st.kids(svc.id, trans.id) : [];
  ok('many branches added inside a department in one go', top.length === 2 && sub.length === 2, top.map((u) => u.name).join('، '));
  ok('types from the first word, the default for others', sub.find((u) => u.name === 'شعبة الصيانة').type === 'branch' && sub.find((u) => u.name === 'مكتب الحركة').type === 'office' && top.find((u) => u.name === 'المستودع').type === 'section');
  ok('a repeated line is not duplicated, and the addition is one history entry', top.filter((u) => u.name === 'قسم النقل').length === 1 && (await logCount()) === logs1 + 1);
  /* 5) البدء بفروع موضع قائم: تُنسخ بأنواعها كما هي */
  await S.click(`[data-addunit="${fin.id}"][data-parent=""]`); await S.waitForSelector('dialog [data-copyfrom]');
  await S.selectOption('dialog [data-copyfrom]', `${svc.id}|`); await S.waitForTimeout(500);
  const filled = await S.inputValue('dialog [name="lines"]');
  await S.click('dialog .btn-primary'); await S.waitForTimeout(1500); await settle();
  st = await struct();
  const fo = st.units.find((u) => u.departmentId === fin.id && u.name === 'مكتب الحركة');
  ok('starting from another place fills the box and keeps the types', /قسم النقل/.test(filled) && fo && fo.type === 'office');
  /* 6) «فرع واحد بكل تفاصيله» يفتح النافذة الكاملة */
  await S.click(`[data-addunit="${svc.id}"][data-parent=""]`); await S.waitForSelector('dialog [name="lines"]');
  await S.click('dialog .btn:has-text("فرع واحد بكل تفاصيله")'); await S.waitForTimeout(600);
  ok('«one branch with all details» opens the full form', !!(await S.$('dialog [name="code"]')) && !!(await S.$('dialog [name="headId"]')));
  await S.click('dialog [data-x]'); await S.waitForTimeout(400);

  /* 7) نسخ فرع بكل ما تحته إلى إدارات أخرى، مرتين دون تكرار */
  await go(); const tr = (await struct()).units.find((u) => u.departmentId === svc.id && u.name === 'قسم النقل');
  for (let i = 0; i < 2; i++) {
    await S.click(`[data-copy="${svc.id}|${tr.id}"]`); await S.waitForSelector('dialog [data-target]');
    await S.check(`dialog [data-target="${da.id}"]`); await S.check(`dialog [data-target="${db.id}"]`); await S.click('dialog .btn-primary'); await S.waitForTimeout(1500); await settle();
  }
  st = await struct();
  const copied = (d) => { const t = st.kids(d.id).filter((u) => u.name === 'قسم النقل'); return t.length === 1 && st.kids(d.id, t[0].id).length === 2; };
  ok('a branch with everything under it is copied to chosen departments, once', copied(da) && copied(db));

  /* 8) التصدير، ولصق ما صُدّر من جديد لا يكرر شيئاً (ويُتجاهل سطر العناوين) */
  const [dl] = await Promise.all([S.waitForEvent('download'), S.click('[data-act="export"]')]);
  const sheet = execSync(`unzip -p "${await dl.path()}" xl/worksheets/sheet1.xml`).toString(), total = st.deps.length + st.units.length;
  ok('export: a structure sheet with a row per department and branch', (sheet.match(/<row /g) || []).length === total + 1, `${(sheet.match(/<row /g) || []).length} / ${total + 1}`);
  const paste = ['الإدارة\tالمستوى 1\tالمستوى 2', ...st.units.filter((u) => u.departmentId === hr.id && !u.parentId).map((u) => `${hr.name}\t${u.name}`)].join('\n');
  await S.click('.page-head [data-act="adddep"]'); await S.waitForSelector('dialog [name="outline"]'); await S.fill('dialog [name="outline"]', paste); await S.waitForTimeout(600);
  ok('pasting exported rows back adds nothing and ignores the header row', /0 جديد/.test(await S.textContent('dialog [data-prev]')));
  await S.click('dialog [data-x]');

  /* 9) التراجع عن إضافة جماعية من السجل يزيلها كلها في خطوة واحدة */
  await S.click('.page-head [data-act="adddep"]'); await S.waitForSelector('dialog [name="outline"]');
  await S.fill('dialog [name="outline"]', `${D('مؤقتة 1')}\n  قسم أ\n    مكتب أ\n${D('مؤقتة 2')}\n  قسم ب`); await S.waitForTimeout(500);
  await S.click('dialog .btn-primary'); await S.waitForTimeout(1500); await settle();
  const before = (await struct()).deps.filter((d) => d.name.startsWith('مؤقتة')).length;
  const undo = await S.evaluate(async () => { const e = (await App.DB.getAll('orgLog')).sort((a, b) => b.at - a.at)[0]; return App.OrgLog.undo(e); }); await settle();
  st = await struct();
  ok('undoing a bulk addition from the history removes all of it at once', before === 2 && undo.undone === 5 && !st.deps.some((d) => d.name.startsWith('مؤقتة')) && !st.units.some((u) => ['قسم أ', 'مكتب أ', 'قسم ب'].includes(u.name)), JSON.stringify(undo));

  /* 10) صفحة عهدة الإدارة: أقسامها ومكاتبها تُدار بنوافذ الهيكل */
  const emp2 = (await struct()).units.find((u) => u.id === emp.id);
  await S.evaluate(async (u) => { await App.Data.org.saveUnit({ ...u, code: 'HR-7', headId: 'u_dep' }); await App.Sync.flush(); }, emp2); await settle();
  const custody = async () => { await S.evaluate(() => { location.hash = '#/dashboard'; }); await S.waitForTimeout(300); await S.evaluate((id) => { location.hash = `#/inventory/departments/${id}`; }, hr.id); await S.waitForSelector(`[data-sec="${emp.id}"]`); await S.waitForTimeout(500); };
  await custody(); await S.click(`[data-sec="${emp.id}"]`); await S.waitForSelector(`[data-editunit="${emp.id}"]`);
  const logs2 = await logCount();
  await S.click(`[data-editunit="${emp.id}"]`); await S.waitForSelector('dialog [name="code"]'); await S.fill('dialog [name="name"]', 'قسم شؤون الموظفين والملفات'); await S.click('dialog .btn-primary'); await S.waitForTimeout(1200); await settle();
  let e2 = (await struct()).units.find((u) => u.id === emp.id);
  ok('editing a section from the custody page keeps its code and head, and is in the history', e2.name === 'قسم شؤون الموظفين والملفات' && e2.code === 'HR-7' && e2.headId === 'u_dep' && (await logCount()) === logs2 + 1, JSON.stringify({ n: e2.name, c: e2.code, h: e2.headId }));
  await custody(); await S.click(`[data-sec="${emp.id}"]`); await S.waitForSelector(`[data-addoffice="${emp.id}"]`); await S.click(`[data-addoffice="${emp.id}"]`); await S.waitForSelector('dialog [name="lines"]');
  const officeOn = await S.isChecked('dialog [name="type"][value="office"]');
  await S.fill('dialog [name="lines"]', 'مكتب الأرشيف\nمكتب الاستقبال'); await S.waitForTimeout(400); await S.click('dialog .btn-primary'); await S.waitForTimeout(1200); await settle();
  const offs = (await struct()).kids(hr.id, emp.id).filter((u) => ['مكتب الأرشيف', 'مكتب الاستقبال'].includes(u.name));
  ok('«add offices» on the custody page adds many offices at once', officeOn && offs.length === 2 && offs.every((u) => u.type === 'office'), `${officeOn} ${offs.length}`);
  /* من يملك إدارة المخزون دون تعديل الهيكل: لا يرى أزرار الهيكل (كان الخادم يرفض ما يضيفه) */
  const P = `st${T}`; await api('push', { ops: [mkUser(P, P, { departmentId: hr.id, extraPerms: ['inventory.read', 'inventory.manage'] })] }, sup);
  const c2 = await b.newContext({ viewport: { width: 1280, height: 860 } }); await c2.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} });
  const K = await c2.newPage(); K.setDefaultTimeout(25000); K.on('pageerror', (e) => errs.push(e.message));
  await K.goto(U); await K.waitForSelector('[name="username"]'); await K.fill('[name="username"]', P); await K.fill('[name="password"]', 'Passw0rd!'); await K.keyboard.press('Enter');
  await K.waitForFunction(() => window.App && App.Auth.user); await K.waitForTimeout(2500);
  await K.evaluate((id) => { location.hash = `#/inventory/departments/${id}`; }, hr.id); await K.waitForSelector(`[data-sec="${emp.id}"]`); await K.click(`[data-sec="${emp.id}"]`); await K.waitForTimeout(600);
  const btns = await K.$$eval('[data-act="addunit"], [data-addoffice], [data-editunit], [data-delunit]', (x) => x.length);
  ok('an inventory manager without structure rights sees no structure buttons on the custody page', btns === 0, String(btns));
  await c2.close();

  /* تنظيف */
  await S.evaluate(async (ids) => { for (const id of ids) await App.Data.org.removeDept(id, {}).catch(() => null); }, [hr.id, fin.id, svc.id, da.id, db.id]);
  await settle();
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
