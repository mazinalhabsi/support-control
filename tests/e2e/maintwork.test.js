/* اختبار طرفي: صيانة الأجهزة للفنيين والإداريين والمشرفين.
   - الفني (دون صلاحيات المخزن) يرى «صيانة الأجهزة» في القائمة مرة واحدة، ويُدخل الرقم التسلسلي فتظهر كل بيانات الجهاز ومكانه وحائزه
   - الاستلام: الجهاز يبقى في عهدة إدارته وحالته «تحت الصيانة»، ويصل حائزه إشعار
   - أمر الصيانة: ملاحظات متابعة، ثم ما تم والقطع والإضافات والتعديلات والملاحظات
   - التسليم إلى المكان السابق بتأكيد المستلم من حسابه، والخادم لا يقبل من المستلم غير التأكيد
   - دخول الصيانة مرة ثانية: الصيانة السابقة وما أُضيف فيها ظاهران
   - جهاز غير مسجل في المخزن يُستلم ببياناته ويُحفظ سجله برقمه
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/maintwork.test.js */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php';
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return r.json().catch(() => ({})); };
const pull = async (tok) => { let since = 0; const out = []; for (;;) { const r = await fetch(`${B}?a=pull&since=${since}&limit=3000`, { headers: { 'X-Token': tok } }).then((x) => x.json()); out.push(...r.docs); since = r.rev; if (!r.more) return out; } };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
(async () => {
  const T = String(Date.now() % 100000), SH = process.env.SHOTS || '', sup = (await api('login', { username: 'sup', password: 'Passw0rd!' })).token;
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const open = async (u) => {
    const c = await b.newContext({ viewport: { width: 1440, height: 1000 } }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} window.print = () => { window.__printed = (document.getElementById('print-root') || {}).innerHTML || ''; }; });
    const p = await c.newPage(); p.on('pageerror', (e) => errs.push(`${u}: ${e.message}`)); p.setDefaultTimeout(25000);
    await p.goto(BASE); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', u); await p.fill('[name="password"]', 'Passw0rd!'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.App && App.Auth.user); await p.waitForTimeout(1500);
    await p.evaluate(() => { window.__denied = []; const r0 = App.Sync.resolve.bind(App.Sync); App.Sync.resolve = async (c) => { window.__denied.push(...c.filter((x) => x.reason === 'no_permission').map((x) => `${x.store}/${x.id}`)); return r0(c); }; });
    return p;
  };
  const sync = (p) => p.evaluate(async () => { await App.Sync.flush(); await App.Sync.pull(); });
  const until = async (p, fn, arg) => { for (let i = 0; i < 30; i++) { await sync(p); if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(500); } return false; };
  const srv = async (store, id) => (await pull(sup)).filter((x) => x.store === store && x.id === id).pop();
  /* المشرف يسجل جهازاً مسلسلاً بعهدة إدارة الموظف، في فرع، وحائزه حساب الموظف */
  const S = await open('sup'), TQ = await open('tech'), E = await open('dep');
  const SN = `SN-${T}-A`, fx = await S.evaluate(async ({ T, SN }) => {
    const dep = App.Data.list('users').find((u) => u.username === 'dep'), depId = dep.departmentId || App.Data.list('departments')[0].id;
    const unit = await App.Data.org.saveUnit({ departmentId: depId, type: 'office', name: `مكتب الصيانة ${T}` });
    const it = await App.Data.inv.saveItem({ name: `حاسب مكتبي ${T}`, unit: 'جهاز', categoryId: App.Data.list('itemCategories')[0].id, minQty: 0, brand: 'Dell', model: 'OptiPlex 7090', serialized: 1, specs: {} });
    const a = { id: 'as_mw_' + T, itemId: it.id, serial: SN, tag: `TAG-${T}`, host: `PC-${T}`, status: 'issued', warehouseId: '', departmentId: depId, unitId: unit.id, holder: dep.name, holderId: dep.id, loanId: '', note: '', addedAt: Date.now(), updatedAt: Date.now() };
    await App.DB.put('assets', a); await App.Sync.flush();
    return { depId, unitId: unit.id, assetId: a.id, itemId: it.id, depUser: dep.id, depName: dep.name };
  }, { T, SN });
  ok('a technician has «device maintenance» by default, in the menu once', await TQ.evaluate(() => App.Auth.can('maint.work') && !App.Auth.can('inventory.move') && document.querySelectorAll('.nav-link[data-path="/maintenance"]').length === 1));
  ok('…and so does the supervisor, also once', await S.evaluate(() => document.querySelectorAll('.nav-link[data-path="/maintenance"]').length === 1));
  await until(TQ, (id) => App.DB.get('assets', id).then(Boolean), fx.assetId);
  /* 1) إدخال الرقم التسلسلي */
  await TQ.evaluate(() => { location.hash = '#/maintenance'; }); await TQ.waitForSelector('#mdsn');
  await TQ.fill('#mdsn', SN.toLowerCase()); await TQ.click('[data-mdfind] button[type="submit"]'); await TQ.waitForSelector('[data-mdcard]');
  const card = (await TQ.textContent('[data-mdcard]')).replace(/\s+/g, ' ');
  ok('typing the serial (any case) shows the device with its model, place, branch and holder', card.includes(`حاسب مكتبي ${T}`) && /Dell/.test(card) && card.includes(`مكتب الصيانة ${T}`) && card.includes(fx.depName) && card.includes(`PC-${T}`), card.slice(0, 160));
  if (SH) await TQ.screenshot({ path: `${SH}/maint-card.png` });
  /* 2) الاستلام */
  await TQ.click(`[data-mdin="${fx.assetId}"]`); await TQ.waitForSelector('dialog [name="symptom"]');
  await TQ.fill('dialog [name="symptom"]', 'لا يقلع ويصدر صفيراً'); await TQ.fill('dialog [name="accessories"]', 'كابل طاقة');
  await TQ.click('dialog .modal-foot .btn-primary'); await TQ.waitForFunction(() => /^#\/maintenance\/mt_/.test(location.hash)); await TQ.waitForTimeout(800);
  const mid = await TQ.evaluate(() => location.hash.split('/').pop());
  await sync(TQ); await TQ.waitForTimeout(800);
  let r = await srv('maintenance', mid), a = await srv('assets', fx.assetId);
  ok('intake opens a work order kept on the server, the device stays in its department and branch, status «in maintenance»', r && r.data.keep === 1 && r.data.status === 'open' && a.data.status === 'maintenance' && a.data.departmentId === fx.depId && a.data.unitId === fx.unitId && a.data.holderId === fx.depUser, JSON.stringify(a && a.data.status));
  ok('…without a single server refusal for the technician', !(await TQ.evaluate(() => window.__denied.length)), (await TQ.evaluate(() => window.__denied)).join(','));
  await until(E, (id) => App.DB.getAll('notifications').then((x) => x.some((n) => n.link === `/maint-receipt/${id}`)), mid);
  ok('the holder is told his device was received', await E.evaluate((id) => App.DB.getAll('notifications').then((x) => x.some((n) => n.link === `/maint-receipt/${id}` && /استُلم جهازك للصيانة/.test(n.title))), mid));
  /* 3) المتابعة ثم الإنهاء */
  await TQ.click('[data-mo="log"]'); await TQ.fill('dialog [name="text"]', 'مزود الطاقة لا يعطي جهداً ثابتاً'); await TQ.click('dialog .modal-foot .btn-primary'); await TQ.waitForTimeout(700);
  ok('a progress note is added with who wrote it', /مزود الطاقة لا يعطي/.test(await TQ.textContent('.timeline')));
  await TQ.click('[data-mo="finish"]'); await TQ.waitForSelector('dialog [name="workDone"]');
  await TQ.fill('dialog [name="workDone"]', 'استبدال مزود الطاقة وتنظيف داخلي'); await TQ.fill('dialog [name="parts"]', 'مزود طاقة 500W');
  await TQ.fill('dialog [name="additions"]', 'ذاكرة 8GB'); await TQ.fill('dialog [name="changes"]', 'تحديث نظام BIOS'); await TQ.fill('dialog [name="notes"]', 'المروحة صوتها مرتفع، تُراقب');
  await TQ.click('dialog .modal-foot .btn-primary'); await TQ.waitForTimeout(800);
  const done = (await TQ.textContent('main, #view, body')).replace(/\s+/g, ' ');
  ok('finishing saves what was done, parts, additions, changes and notes', ['استبدال مزود الطاقة', 'مزود طاقة 500W', 'ذاكرة 8GB', 'تحديث نظام BIOS', 'المروحة صوتها'].every((x) => done.includes(x)));
  if (SH) await TQ.screenshot({ path: `${SH}/maint-order.png`, fullPage: true });
  /* 4) التسليم بتأكيد المستلم */
  await TQ.click('[data-mo="deliver"]'); await TQ.waitForSelector('dialog [name="receiverId"]');
  ok('the handover returns it to its previous place, with the holder preselected', (await TQ.textContent('dialog .banner')).includes(`مكتب الصيانة ${T}`) && (await TQ.$eval('dialog [name="receiverId"]', (x) => x.value)) === fx.depUser);
  await TQ.check('dialog input[name="mode"][value="confirm"]', { force: true }); await TQ.click('dialog .modal-foot .btn-ok'); await TQ.waitForTimeout(800); await sync(TQ); await TQ.waitForTimeout(600);
  r = await srv('maintenance', mid); a = await srv('assets', fx.assetId);
  ok('after handover the device is back in use where it was, awaiting the receiver\'s confirmation', r.data.status === 'sent' && a.data.status === 'issued' && a.data.unitId === fx.unitId && a.data.holderId === fx.depUser);
  await until(E, (id) => App.DB.get('maintenance', id).then((x) => x && x.status === 'sent'), mid);
  /* المستلم لا يغيّر غير التأكيد */
  const hack = await E.evaluate(async (id) => { const x = await App.DB.get('maintenance', id); await App.DB.put('maintenance', { ...x, workDone: 'تلاعب', updatedAt: Date.now() }); await App.Sync.flush(); return true; }, mid);
  await E.waitForTimeout(800); r = await srv('maintenance', mid);
  ok('the receiver cannot change the work order', hack && r.data.workDone === 'استبدال مزود الطاقة وتنظيف داخلي');
  await sync(E); await E.evaluate((id) => { location.hash = `#/maint-receipt/${id}`; }, mid); await E.waitForSelector('[data-mrok]');
  ok('the receiver sees what was done on his device', /ذاكرة 8GB/.test(await E.textContent('main, #view, body')));
  if (SH) await E.screenshot({ path: `${SH}/maint-receipt.png` });
  await E.click('[data-mrok]'); await E.waitForTimeout(900); await sync(E); await E.waitForTimeout(500);
  r = await srv('maintenance', mid);
  ok('…and confirms receipt from his account', r.data.status === 'returned' && r.data.receivedConfirm === 1 && r.data.receivedAt > 0);
  /* 5) دخول الصيانة مرة ثانية */
  await sync(TQ); await TQ.evaluate((sn) => { location.hash = `#/maintenance?sn=${encodeURIComponent(sn)}`; }, SN); await TQ.waitForSelector('[data-mdcard]'); await TQ.waitForTimeout(500);
  const c2 = (await TQ.textContent('[data-mdcard]')).replace(/\s+/g, ' ');
  ok('the device card shows the previous maintenance, what was added, and who received it', /سجل الصيانة \(1\)/.test(c2) && c2.includes('ذاكرة 8GB') && c2.includes('استبدال مزود الطاقة') && /أكّد الاستلام/.test(c2));
  await TQ.click(`[data-mdin="${fx.assetId}"]`); await TQ.waitForSelector('dialog [name="symptom"]'); await TQ.selectOption('dialog [name="reason"]', { index: 1 }); await TQ.click('dialog .modal-foot .btn-primary'); await TQ.waitForFunction((m) => /^#\/maintenance\/mt_/.test(location.hash) && !location.hash.endsWith(m), mid); await TQ.waitForTimeout(800);
  const o2 = (await TQ.textContent('main, #view, body')).replace(/\s+/g, ' ');
  ok('a second visit is its own order, with the earlier one and its additions shown', /صيانات سابقة لهذا الجهاز \(1\)/.test(o2) && o2.includes('ذاكرة 8GB'));
  const twice = await TQ.evaluate(async (sn) => { try { await App.Data.maint.intake({ assetId: (await App.Data.assets.bySerialOrTag(sn)).id, reason: 'سبب آخر' }); return 'accepted'; } catch (e) { return e.message; } }, SN);
  ok('a device already in maintenance cannot be received twice', /في الصيانة الآن/.test(twice), twice);
  await TQ.click('[data-mo="print"]'); await TQ.waitForTimeout(400);
  ok('the maintenance slip prints with the device place', (await TQ.evaluate(() => window.__printed || '')).includes(`مكتب الصيانة ${T}`));
  /* 6) جهاز غير مسجل */
  const SN2 = `UNREG-${T}`;
  await TQ.evaluate(() => { location.hash = '#/maintenance'; }); await TQ.waitForSelector('#mdsn'); await TQ.fill('#mdsn', SN2); await TQ.click('[data-mdfind] button[type="submit"]'); await TQ.waitForSelector('[data-mdcard]');
  ok('an unknown serial says it is not registered and offers to receive it', /غير مسجل/.test(await TQ.textContent('[data-mdcard]')) && !!(await TQ.$('[data-mdin=""]')));
  await TQ.click('[data-mdin=""]'); await TQ.waitForSelector('dialog [name="mname"]'); await TQ.fill('dialog [name="mname"]', 'طابعة ليزر شخصية'); await TQ.fill('dialog [name="mholder"]', 'زائر من الإدارة');
  await TQ.click('dialog .modal-foot .btn-primary'); await TQ.waitForFunction(() => /^#\/maintenance\/mt_/.test(location.hash)); await TQ.waitForTimeout(800); await sync(TQ); await TQ.waitForTimeout(500);
  const m3 = await TQ.evaluate(() => location.hash.split('/').pop()); r = await srv('maintenance', m3);
  ok('…and its record is kept by serial', r && r.data.serial === SN2 && r.data.registered === 0 && r.data.itemName === 'طابعة ليزر شخصية' && r.data.fromHolder === 'زائر من الإدارة');
  /* 7) الموظف لا يفتح أوامر الصيانة ولا يستلم أجهزة */
  const empTry = await E.evaluate(async (sn) => { try { await App.Data.maint.intake({ serial: sn + 'X', reason: 'سبب آخر', manual: { name: 'جهاز' } }); return 'accepted'; } catch (e) { return e.message; } }, SN2);
  ok('an employee cannot open a maintenance order', /صلاحية/.test(empTry), empTry);
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
