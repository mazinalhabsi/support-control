/* اختبار طرفي: تأكيد الاطلاع، والمهام المتكررة، وربط الملاحظة ببلاغ أو إدارة، وتسليم المناوبة، وبداية الملاحظة الجديدة.
   - تأكيد الاطلاع يصل كاتب الملاحظة وصاحبه فقط، ولا يكتبه غير صاحبه، ولا لملاحظة لا تصله؛ ويعدّها مقروءة على أجهزته الأخرى
   - الكاتب يرى «اطّلع N من M» ومن اطّلع ومن لم يطّلع، ويذكّر من لم يطّلع وحده
   - المهمة اليومية: إنجاز الأمس لا يُحسب اليوم
   - الملاحظة المرتبطة ببلاغ تظهر في صفحة البلاغ لمن يراها، وبإدارة في لوحة توزيعها
   - تسليم المناوبة: قائمة جديدة للمستلم بما لم يُنجز، مع إشعار، والأصل في الأرشيف
   - الملاحظة الجديدة تبدأ «لي وحدي»، و«مثل آخر ملاحظة» يعيد آخر اختيار عند الطلب
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/notes2.test.js */
const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php';
const api = async (a, body, tok, q = '') => { const r = await fetch(`${B}?a=${a}${q}`, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(tok ? { 'X-Token': tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); return r.json().catch(() => ({})); };
const pull = async (tok) => { let since = 0; const out = []; for (;;) { const r = await api('pull', null, tok, `&since=${since}&limit=3000`); out.push(...r.docs); since = r.rev; if (!r.more) return out; } };
const mkUser = (id, name, extra = {}) => { const salt = crypto.randomBytes(16), hash = crypto.pbkdf2Sync('Passw0rd!', salt, 1000, 32, 'sha256').toString('hex'); return { store: 'users', id, rev: -1, data: { id, username: id, name, role: 'technician', active: 1, mustChangePassword: 0, extraPerms: [], deniedPerms: [], pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash }, createdAt: Date.now(), updatedAt: Date.now(), ...extra } }; };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
(async () => {
  const T = String(Date.now() % 100000), sup = (await api('login', { username: 'sup', password: 'Passw0rd!' })).token;
  const [A, Bt, C, D] = ['ra', 'rb', 'rc', 'rd'].map((x) => x + T);
  await api('push', { ops: [mkUser(A, `أحمد ${T}`), mkUser(Bt, `بدر ${T}`), mkUser(C, `سالم ${T}`), mkUser(D, `دانة ${T}`)] }, sup);
  const tok = {}; for (const u of [A, Bt, C, D]) tok[u] = (await api('login', { username: u, password: 'Passw0rd!' })).token;
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const login = async (u) => { const c = await b.newContext({ viewport: { width: 1440, height: 1000 } }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(`${u}: ${e.message}`)); p.setDefaultTimeout(20000); await p.goto(BASE); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', u); await p.fill('[name="password"]', 'Passw0rd!'); await p.keyboard.press('Enter'); await p.waitForFunction(() => window.App && App.Auth.user); await p.waitForTimeout(1500); return p; };
  const sync = (p) => p.evaluate(async () => { await App.Sync.flush(); await App.Sync.pull(); await App.VAULT.resync(); });
  const open = async (p, q = '') => { await p.evaluate(() => { location.hash = '#/dashboard'; }); await p.waitForTimeout(200); await p.evaluate((q) => { location.hash = `#/vault${q}`; }, q); await p.waitForSelector('.nt-layout'); await p.waitForTimeout(500); };
  const P = await login(A);
  for (let i = 0; i < 20 && !(await P.evaluate((ids) => ids.every((id) => App.Data.c.users.has(id)), [Bt, C, D])); i++) { await P.evaluate(() => App.Sync.pull()); await P.waitForTimeout(400); }

  /* 1) الملاحظة الجديدة تبدأ «لي وحدي»، و«مثل آخر ملاحظة» عند الطلب */
  await open(P); await P.click('[data-act="new"]'); await P.waitForSelector('dialog input[name="vis"]');
  ok('a new note starts as «me only»', await P.isChecked('dialog input[name="vis"][value="private"]'));
  await P.check('dialog input[name="vis"][value="custom"]', { force: true }); await P.click('dialog [data-nptab="technician"]'); await P.fill('dialog [data-npq]', `بدر ${T}`); await P.waitForTimeout(300); await P.check(`dialog [data-npu="${Bt}"]`);
  await P.fill('dialog [name="title"]', `أولى ${T}`); await P.click('dialog .btn-primary'); await P.waitForTimeout(1000);
  await P.click('[data-act="new"]'); await P.waitForSelector('dialog input[name="vis"]');
  const fresh = await P.isChecked('dialog input[name="vis"][value="private"]'), chipsBefore = await P.$$eval('dialog .np-chip', (x) => x.length);
  await P.click('dialog [data-vlast]'); await P.waitForTimeout(300);
  const chipsAfter = await P.$$eval('dialog .np-chip', (x) => x.map((e) => e.textContent));
  ok('the next note does not reuse the last people by itself; «like the last note» loads them', fresh && chipsBefore === 0 && chipsAfter.some((t) => t.includes('بدر')) && await P.isChecked('dialog input[name="vis"][value="custom"]'));
  await P.keyboard.press('Escape'); await P.waitForTimeout(300);

  /* 2) تأكيد الاطلاع */
  const nid = await P.evaluate(async ({ Bt, C }) => { const n = await App.VAULT.save({ type: 'general', title: 'تحديث كلمة مرور الشبكة', body: 'الجديدة عند المناوب', visibility: 'custom', audience: { users: [Bt, C], roles: [], groups: [] }, important: 1 }); await App.Sync.flush(); return n.id; }, { Bt, C });
  const Q = await login(Bt); await sync(Q); await open(Q); await Q.waitForSelector(`[data-vseen="${nid}"]`); await Q.click(`[data-vseen="${nid}"]`); await Q.waitForTimeout(1200); await sync(Q);
  const reads = async (u) => (await pull(tok[u])).filter((d) => d.store === 'noteReads' && !d.deleted && d.data).map((d) => d.data.userId);
  ok('the confirmation reaches the author and the reader only', (await reads(A)).includes(Bt) && (await reads(Bt)).includes(Bt) && !(await reads(C)).includes(Bt) && !(await reads(D)).includes(Bt));
  const forge = await api('push', { ops: [{ store: 'noteReads', id: `${nid}:${Bt}`, rev: -1, data: { id: `${nid}:${Bt}`, noteId: nid, userId: Bt, at: 1 } }] }, tok[C]);
  const outsider = await api('push', { ops: [{ store: 'noteReads', id: `${nid}:${D}`, rev: -1, data: { id: `${nid}:${D}`, noteId: nid, userId: D, at: 1 } }] }, tok[D]);
  ok('nobody writes another person\'s confirmation, or one for a note they cannot see', !(forge.applied || []).length && !(outsider.applied || []).length);
  await sync(P); await open(P); await P.waitForSelector(`[data-vreads="${nid}"]`);
  ok('the author sees «read 1 of 2»', /اطّلع 1 من 2/.test(await P.textContent(`[data-vreads="${nid}"]`)));
  await P.click(`[data-vreads="${nid}"]`); await P.waitForSelector('dialog .list');
  ok('the list names who read and who has not', (await P.textContent('dialog')).includes(`بدر ${T}`) && (await P.textContent('dialog')).includes(`سالم ${T}`));
  await P.click('dialog .btn-primary'); await P.waitForTimeout(1200); await P.evaluate(() => App.Sync.flush());
  const rem = async (u) => (await pull(tok[u])).filter((d) => d.store === 'notifications' && d.data && d.data.userId === u && /تذكير/.test(d.data.title || '')).length;
  ok('«remind» notifies only those who have not read', (await rem(C)) === 1 && (await rem(Bt)) === 0);
  const Q2 = await login(Bt); await sync(Q2);
  ok('the reader\'s other device counts it as read', await Q2.evaluate(async (id) => !App.VAULT.isNew(await App.DB.get('vault', id)), nid));

  /* 3) المهام المتكررة */
  const rid = await P.evaluate(async () => { const n = await App.VAULT.save({ type: 'task', title: 'فحص يومي', items: [{ id: 'i1', t: 'النسخ الاحتياطي', done: 1, at: Date.now() - 86400000 * 1.5 }, { id: 'i2', t: 'الطابعات', done: 1, at: Date.now() }], repeat: 'daily', visibility: 'private' }); await App.Sync.flush(); return n.id; });
  await open(P); await P.waitForSelector(`[data-nid="${rid}"]`);
  ok('a daily list counts only today\'s ticks', /أُنجز 1 من 2/.test(await P.textContent(`[data-nid="${rid}"] .nt-tasks`)) && /تتجدد كل يوم/.test(await P.textContent(`[data-nid="${rid}"]`)));
  await P.click(`[data-nid="${rid}"] [data-vtask="${rid}:i1"]`); await P.waitForTimeout(800);
  ok('ticking yesterday\'s item marks it done for today', /أُنجز 2 من 2/.test(await P.textContent(`[data-nid="${rid}"] .nt-tasks`)));

  /* 4) الربط ببلاغ وبإدارة */
  const tk = await P.evaluate(async () => { const t = await App.Data.tickets.create({ title: 'طابعة لا تعمل', description: 'x', categoryId: 'other', priority: 'medium' }); await App.Sync.flush(); return { id: t.id, number: t.number }; });
  await open(P, `?link=ticket:${tk.id}`); await P.click('[data-lnew]'); await P.waitForSelector('dialog [name="lticket"]');
  ok('«linked note» opens with the ticket number filled in', (await P.inputValue('dialog [name="lticket"]')) === tk.number);
  await P.fill('dialog [name="title"]', 'جرّبت تغيير الحبر'); await P.check('dialog input[name="vis"][value="all"]', { force: true }); await P.click('dialog .btn-primary'); await P.waitForTimeout(1200);
  await P.evaluate((id) => { location.hash = `#/tickets/${id}`; }, tk.id); await P.waitForSelector('[data-tknotes] .panel'); await P.waitForTimeout(400);
  ok('the ticket page lists the linked note', /جرّبت تغيير الحبر/.test(await P.textContent('[data-tknotes]')));
  const seq = Number(String(tk.number).split('-').pop());
  await open(P); await P.click('[data-act="new"]'); await P.waitForSelector('dialog [name="lkind"]'); await P.selectOption('dialog [name="lkind"]', 'ticket'); await P.fill('dialog [name="lticket"]', String(seq)); await P.fill('dialog [name="title"]', `بالرقم القصير ${T}`); await P.click('dialog .btn-primary'); await P.waitForTimeout(1000);
  ok('a ticket can be linked by its sequence alone', await P.evaluate(async ({ T, id }) => (await App.VAULT.list()).some((n) => n.title === `بالرقم القصير ${T}` && n.link && n.link.id === id), { T, id: tk.id }));
  const S = await login('sup');
  const dep = await S.evaluate(async (T) => { await App.Data.org.buildOutline(App.Data.org.planOutline(`إدارة الملاحظات ${T}\n  قسم أ`)); await App.Sync.flush(); return App.Data.list('departments').find((d) => d.name === `إدارة الملاحظات ${T}`).id; }, T);
  await sync(P);
  await P.evaluate(async (dep) => { await App.VAULT.save({ type: 'general', title: 'مفاتيح مستودع الإدارة', visibility: 'all', link: { kind: 'dept', id: dep, label: 'الإدارة' } }); await App.VAULT.save({ type: 'general', title: 'ملاحظتي عن الإدارة', visibility: 'private', link: { kind: 'dept', id: dep, label: 'الإدارة' } }); await App.Sync.flush(); }, dep);
  await sync(S); await S.evaluate((d) => { location.hash = `#/org/people?d=${d}`; }, dep); await S.waitForSelector('.dp-stats'); await S.waitForTimeout(700);
  ok('a department\'s linked notes are counted on its board — only those the viewer may see', /ملاحظات الإدارة: 1/.test((await S.textContent('.dp-stats')).replace(/\s+/g, ' ')), (await S.textContent('.dp-stats')).replace(/\s+/g, ' ').slice(0, 80));

  /* 5) تسليم المناوبة */
  const hid = await P.evaluate(async ({ Bt }) => { const n = await App.VAULT.save({ type: 'task', title: 'مناوبة الصباح', items: [{ id: 'h1', t: 'تسليم العهد', done: 1, at: Date.now() }, { id: 'h2', t: 'متابعة بلاغ الطابعة', done: 0 }, { id: 'h3', t: 'فحص الكاميرات', done: 0 }], visibility: 'custom', audience: { users: [Bt], roles: [], groups: [] } }); await App.Sync.flush(); return n.id; }, { Bt });
  await open(P); await P.waitForSelector(`[data-vhand="${hid}"]`);
  ok('a task list offers «hand over the shift» with the unfinished count', /2 لم تُنجز/.test(await P.textContent(`[data-vhand="${hid}"]`)));
  await P.click(`[data-vhand="${hid}"]`); await P.waitForSelector('dialog [name="to"]'); await P.selectOption('dialog [name="to"]', C); await P.fill('dialog [name="msg"]', 'الطابعة تحتاج حبراً'); await P.click('dialog .btn-primary'); await P.waitForTimeout(1500); await P.evaluate(() => App.Sync.flush());
  const R = await login(C); await sync(R);
  const got = await R.evaluate(async () => (await App.VAULT.list()).find((n) => n.title === 'تسليم: مناوبة الصباح'));
  ok('the next person gets only the unfinished tasks, as an important note with the message', !!got && got.items.map((x) => x.t).join('|') === 'متابعة بلاغ الطابعة|فحص الكاميرات' && got.important === 1 && /الطابعة تحتاج حبراً/.test(got.body));
  ok('they are notified', (await pull(tok[C])).some((d) => d.store === 'notifications' && d.data && d.data.userId === C && /مناوبة الصباح/.test(d.data.title || '')));
  ok('the original moves to the archive, marked as handed over', await P.evaluate(async (id) => { const n = await App.DB.get('vault', id); return n.archived === 1 && !!n.handedTo; }, hid));
  /* بلاغ الاختبار يُلغى حتى لا يبقى بلاغ ينتظر الاستلام فيغيّر ما تتوقعه اختبارات الفنيين */
  await S.evaluate(async (id) => { await App.Data.tickets.setStatus(id, 'cancelled', 'انتهى اختبار الملاحظات'); await App.Sync.flush(); }, tk.id).catch(() => null);
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
