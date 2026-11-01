/* اختبار طرفي: تنظيم الإعدادات — لكل فئة مكان واحد.
   - سبع مجموعات في مركز الإعدادات، والإعدادات العامة أقسام مستقلة يحفظ كل منها حقوله وحدها
   - الروابط القديمة (?tab= و ?s=system و /features) تفتح القسم المقابل
   - البحث بأسماء الإعدادات داخل الأقسام، وحالات الخصائص في النظرة العامة تفتح أقسامها
   - الردود القديمة ضُمّت إلى الردود الجاهزة، ومفاتيح الخصائص في أماكنها (الملاحظات الإدارية، النماذج، التقييم)
   - من يملك إدارة المخزون وحدها يرى أقسام المخازن ولا يرى الإعدادات العامة
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/settings.test.js */
const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php';
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return r.json().catch(() => ({})); };
const pull = async (tok) => { let since = 0; const out = []; for (;;) { const r = await fetch(`${B}?a=pull&since=${since}&limit=3000`, { headers: { 'X-Token': tok } }).then((x) => x.json()); out.push(...r.docs); since = r.rev; if (!r.more) return out; } };
const mkUser = (id, extra = {}) => { const salt = crypto.randomBytes(16), hash = crypto.pbkdf2Sync('Passw0rd!', salt, 1000, 32, 'sha256').toString('hex'); return { store: 'users', id, rev: -1, data: { id, username: id, name: 'حساب ' + id, role: 'department', active: 1, mustChangePassword: 0, extraPerms: [], deniedPerms: [], pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash }, createdAt: Date.now(), updatedAt: Date.now(), ...extra } }; };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
(async () => {
  const T = String(Date.now() % 100000), sup0 = (await api('login', { username: 'sup', password: 'Passw0rd!' })).token, INV = `sinv${T}`;
  await api('push', { ops: [mkUser(INV, { extraPerms: ['inventory.manage'] })] }, sup0);
  const meta = async (key) => { const d = (await pull(sup0)).filter((x) => x.store === 'meta' && x.id === key && !x.deleted).pop(); return d ? d.data.value : null; };
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const login = async (u) => {
    const c = await b.newContext({ viewport: { width: 1440, height: 1000 } }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} });
    const p = await c.newPage(); p.on('pageerror', (e) => errs.push(`${u}: ${e.message}`)); p.setDefaultTimeout(20000);
    await p.goto(BASE); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', u); await p.fill('[name="password"]', 'Passw0rd!'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.App && App.Auth.user); await p.waitForTimeout(1200); return p;
  };
  const S = await login('sup');
  const open = async (q, sel) => { await S.evaluate(() => { location.hash = '#/dashboard'; }); await S.waitForTimeout(250); await S.evaluate((q) => { location.hash = `#/settings${q}`; }, q); if (sel) await S.waitForSelector(sel); await S.waitForTimeout(500); };
  const on = () => S.evaluate(() => (document.querySelector('.cc-item.on') || {}).dataset?.cc || '');

  /* 1) سبع مجموعات، وكل قسم من الإعدادات العامة في مجموعته */
  await open('', '.cc-tile');
  const groups = await S.$$eval('.cc-grp .cc-gl', (x) => x.map((e) => e.textContent.trim()));
  ok('the settings center has seven groups', groups.join('|') === 'النظام|الحسابات والصلاحيات|الهيكل التنظيمي|البلاغات والخدمة|النماذج والملاحظات|المخازن والعهد|البيانات', groups.join('|'));
  const where = await S.$$eval('.cc-grp', (gs) => Object.fromEntries(gs.flatMap((g) => [...g.querySelectorAll('.cc-item')].map((i) => [i.dataset.cc, g.querySelector('.cc-gl').textContent.trim()]))));
  ok('each part of the general settings sits in its own group', where.info === 'النظام' && where.security === 'الحسابات والصلاحيات' && where.orglists === 'الهيكل التنظيمي' && where.handling === 'البلاغات والخدمة' && where.sla === 'البلاغات والخدمة' && where.vault === 'النماذج والملاحظات' && where.invlists === 'المخازن والعهد' && where.data === 'البيانات' && !where.features && !where.system, JSON.stringify(where));

  /* 2) كل قسم يحفظ حقوله وحدها */
  await open('?s=info', '[data-setform] [name="orgName"]');
  const s0 = await S.evaluate(() => JSON.stringify(App.Data.c.settings));
  await S.fill('[name="systemName"]', `نظام الدعم ${T}`); await S.waitForSelector('[data-setdirty]:not([hidden])');
  ok('an edited section shows that changes are not saved yet', await S.isVisible('[data-setdirty]'));
  await S.click('[data-setform] [type="submit"]'); await S.waitForTimeout(1500); await S.evaluate(() => App.Sync.flush());
  const s1 = await S.evaluate(() => App.Data.c.settings), was = JSON.parse(s0);
  const changed = Object.keys({ ...was, ...s1 }).filter((k) => JSON.stringify(was[k]) !== JSON.stringify(s1[k]));
  ok('saving the organization section changes only its own fields', changed.join(',') === 'systemName', changed.join(','));
  await open('?s=handling', '[name="autoCloseDays"]');
  await S.fill('[name="autoCloseDays"]', '5'); await S.selectOption('[name="autoStrategy"]', 'round');
  await S.click('[data-setform] [type="submit"]'); await S.waitForTimeout(1500); await S.evaluate(() => App.Sync.flush()); await S.waitForTimeout(800);
  const srv = await meta('settings');
  ok('ticket handling saves to the server and keeps the organization name just saved', srv && srv.autoCloseDays === 5 && srv.autoAssign.strategy === 'round' && srv.systemName === `نظام الدعم ${T}`, srv ? JSON.stringify({ d: srv.autoCloseDays, s: srv.autoAssign, n: srv.systemName }) : 'no settings');
  await open('?s=sla', '[name="urgent_respond"], [name$="_respond"]');
  ok('the service-level section has its own form', (await S.$$('[data-setform]')).length === 1 && (await S.$$('[name$="_respond"]')).length >= 3);

  /* 3) القوائم: المواقع والرتب فقط، والأقسام والفئات في صفحاتها */
  await open('?s=orglists', '[data-lookup]');
  const tabs = await S.$$eval('[data-lookup]', (x) => x.map((e) => e.dataset.lookup));
  ok('the locations and ranks section lists only those two', tabs.join(',') === 'locations,ranks', tabs.join(','));
  await S.click('[data-lookup="ranks"]'); await S.waitForTimeout(300); await S.click('[data-add]'); await S.waitForSelector('dialog [name="name"]');
  await S.fill('dialog [name="name"]', `رتبة ${T}`); await S.click('dialog .btn-primary'); await S.waitForTimeout(1200); await S.evaluate(() => App.Sync.flush()); await S.waitForTimeout(800);
  const rank = (await pull(sup0)).filter((d) => d.store === 'ranks' && !d.deleted && (d.data || {}).name === `رتبة ${T}`).pop();
  ok('a rank added there reaches the server', !!rank);
  if (rank) { await S.click(`[data-del="${rank.id}"]`); await S.waitForSelector('dialog [data-i="1"]'); await S.click('dialog [data-i="1"]'); await S.waitForTimeout(800); }
  await open('?s=invlists', '[data-lookup]');
  ok('warehouses and item categories have their own section', (await S.$$eval('[data-lookup]', (x) => x.map((e) => e.dataset.lookup))).join(',') === 'warehouses,itemCategories');

  /* 4) أدوات البيانات: حذف البيانات التجريبية يسأل مرة واحدة، والنسخ في مركزه */
  await open('?s=data', '[data-act="unsample"]');
  await S.click('[data-act="unsample"]'); await S.waitForSelector('dialog[open]'); await S.locator('dialog[open]').last().locator('[data-i="0"]').click(); await S.waitForTimeout(700);
  ok('removing sample data asks once (it asked twice before)', (await S.$$('dialog[open]')).length === 0);
  ok('the data section links to the backup center instead of its own raw backup', !!(await S.$('a[href="#/settings?s=backup"]')) && !(await S.$('[data-act="backup"]')) && !(await S.$('[data-act="restore"]')));

  /* 5) الروابط القديمة */
  const alias = [];
  for (const [q, want] of [['?s=system', 'info'], ['?tab=general', 'info'], ['?tab=sla', 'sla'], ['?tab=lookups', 'orglists'], ['?tab=templates', 'replies'], ['?tab=data', 'data']]) { await open(q); alias.push(`${q}=${await on()}`); if ((await on()) !== want) alias.push('!'); }
  ok('old links open the matching section', !alias.includes('!'), alias.join(' '));
  await S.evaluate(() => { location.hash = '#/features'; }); await S.waitForTimeout(1200);
  ok('the removed features page opens the settings overview', await S.evaluate(() => location.hash === '#/settings' && !!document.querySelector('.cc-status')));

  /* 6) البحث بأسماء الإعدادات، والحالات تفتح أقسامها */
  await open('', '.cc-tile');
  const find = async (q) => { await S.fill('[data-ccq]', q); await S.waitForTimeout(200); return S.$$eval('.cc-item[data-ccs]:not([hidden])', (x) => x.map((e) => e.dataset.cc).join(',')); };
  const f1 = await find('الإغلاق التلقائي'), f2 = await find('كلمة المرور المؤقتة'), f3 = await find('أمين المخزن'), f4 = await find('لا يوجد شيء كهذا');
  ok('searching by a setting\'s name finds its section', f1 === 'handling' && f2 === 'security' && f3 === 'invlists', `${f1} | ${f2} | ${f3}`);
  ok('a search with no match says so', f4 === '' && await S.isVisible('.cc-none'));
  await find('الإغلاق التلقائي'); await S.press('[data-ccq]', 'Enter'); await S.waitForTimeout(800);
  ok('Enter opens the first result', (await on()) === 'handling');
  await open('', '.cc-status [data-cc="vault"]'); await S.click('.cc-status [data-cc="vault"]'); await S.waitForSelector('[data-act="vsave"]');
  ok('a feature status on the overview opens its section', (await on()) === 'vault');

  /* 7) الملاحظات الإدارية: إعداداتها ومن يصل إليها في قسمها */
  await S.fill('[name="remind"]', '17'); await S.click('[data-act="vsave"]'); await S.waitForTimeout(1200); await S.evaluate(() => App.Sync.flush()); await S.waitForTimeout(600);
  ok('the admin notes section saves its reminder days', ((await meta('vaultcfg')) || {}).remindDays === 17);
  ok('it links to the permissions center for view and edit grants', !!(await S.$('a[href="#/settings?s=perms&p=vault.read"]')) && !!(await S.$('a[href="#/settings?s=perms&p=vault.manage"]')));
  /* التعبئة الفورية في مكتبة النماذج */
  await open('?s=forms', '.ff-set'); await S.click('.ff-set summary'); await S.waitForTimeout(200);
  await S.click('label.switch:has([data-ffsw="ffsign"])'); await S.waitForTimeout(1200); await S.evaluate(() => App.Sync.flush()); await S.waitForTimeout(600);
  const ff = (await meta('formfill')) || {};
  ok('form-fill switches live in the forms library and save', ff.noSign === 1 && await S.evaluate(() => document.querySelector('.ff-set').open));
  await S.click('label.switch:has([data-ffsw="ffsign"])'); await S.waitForTimeout(1000);
  await open('?s=ratings', '#rtForm [name="center"]');
  ok('the ratings center has its own «show in menu» switch', !!(await S.$('#rtForm [name="center"]')));

  /* 8) الردود القديمة ضُمّت إلى الردود الجاهزة */
  let mig = null; for (let i = 0; i < 20 && !mig; i++) { mig = await meta('migrate:templates'); if (!mig) await S.waitForTimeout(1000); }
  const tplReplies = (await pull(sup0)).filter((d) => d.store === 'replies' && !d.deleted && String(d.id).startsWith('rp_tpl_'));
  ok('legacy ready replies are folded into the replies list once, shared with everyone', !!mig && tplReplies.length >= 1 && tplReplies.every((d) => d.data.scope === 'all' && d.data.kind === 'ticket'), `${JSON.stringify(mig)} ${tplReplies.length}`);
  const tk = await S.evaluate(async () => { const x = await App.Data.tickets.create({ title: 'تجربة صندوق الرد', description: 'وصف', categoryId: 'other', priority: 'medium' }); await App.Sync.flush(); return { id: x.id }; }).catch(() => null);
  if (tk) { await S.evaluate((id) => { location.hash = `#/tickets/${id}`; }, tk.id); await S.waitForSelector('#composer'); await S.waitForTimeout(800); }
  ok('the ticket composer no longer shows the second ready-reply picker', !!tk && !!(await S.$('#composer')) && !(await S.$('#tpl')), tk ? '' : 'no ticket');
  /* بلاغ الاختبار يُلغى حتى لا يبقى بلاغ ينتظر الاستلام فيغيّر ما تتوقعه اختبارات الفنيين */
  if (tk) await S.evaluate(async (id) => { await App.Data.tickets.setStatus(id, 'cancelled', 'انتهى اختبار الإعدادات'); await App.Sync.flush(); }, tk.id).catch(() => null);

  /* 9) من يملك إدارة المخزون وحدها */
  const I = await login(INV);
  await I.evaluate(() => { location.hash = '#/settings'; }); await I.waitForSelector('.cc-item'); await I.waitForTimeout(400);
  const mine = await I.$$eval('.cc-item[data-ccs]', (x) => x.map((e) => e.dataset.cc));
  ok('an inventory manager sees the warehouse sections, not the general settings', mine.includes('invlists') && mine.includes('printers') && !mine.includes('info') && !mine.includes('data') && !mine.includes('security'), mine.join(','));
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
