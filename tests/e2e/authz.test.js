/* اختبار طرفي (Playwright) على خادم تجريبي فيه الحسابات sup و dep و tech بكلمة المرور Passw0rd!
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/<name>.test.js */
const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php', U = BASE;
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
const res = []; const ok = (name, cond, info = '') => res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);
const docOf = async (tok, store, id) => { /* سحب كامل من الخادم بحساب المشرف */ let since = 0, found = null; for (;;) { const r = (await fetch(`${B}?a=pull&since=${since}&limit=3000`, { headers: { 'X-Token': tok } }).then((x) => x.json())); for (const d of r.docs) if (d.store === store && d.id === id) found = d; since = r.rev; if (!r.more) break; } return found; };
(async () => {
  const sup = (await api('login', { username: 'sup', password: 'Passw0rd!' })).j.token;
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const page = async (u) => { const c = await b.newContext({ viewport: { width: 1300, height: 860 } }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} }); const p = await c.newPage(); p.setDefaultTimeout(20000); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
    await p.goto(U); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', u); await p.fill('[name="password"]', 'Passw0rd!'); await p.keyboard.press('Enter'); await p.waitForFunction(() => window.App && App.Auth.user); await p.waitForTimeout(1500);
    await p.evaluate(() => { window.__conf = []; const r0 = App.Sync.resolve.bind(App.Sync); App.Sync.resolve = async (c) => { window.__conf.push(...c.map((x) => `${x.store}:${x.reason}`)); return r0(c); }; }); return p; };
  const idle = (p) => p.evaluate(async () => { App.Sync.flush(); await App.Sync.waitIdle(8000); await new Promise((r) => setTimeout(r, 400)); return window.__conf.slice(); });
  /* تجهيز: الفني مسؤول عن فئة الأجهزة */
  const S = await page('sup');
  const techId = await S.evaluate(async () => { const t = App.Data.list('users').find((u) => u.username === 'tech'); const rec = await App.DB.get('users', t.id); rec.categories = ['hardware']; rec.updatedAt = Date.now(); await App.DB.put('users', rec); await App.Sync.waitIdle(5000); return t.id; });
  /* ── الموظف ── */
  const D = await page('dep');
  const tk = await D.evaluate(async () => { const t = await App.Data.tickets.create({ title: 'تجربة الصلاحيات ' + Date.now(), description: 'وصف', categoryId: 'hardware', priority: 'medium' }); return { id: t.id, number: t.number }; });
  await D.evaluate((id) => App.Data.tickets.comment(id, 'تعليق من صاحب البلاغ'), tk.id);
  const chatId = await D.evaluate(async () => { const c = await App.Data.chat.start({ subject: 'استفسار تجريبي', text: 'السلام عليكم' }); await App.Data.chat.send(c.id, 'رسالة ثانية'); return c.id; });
  const kbId = await D.evaluate(async () => { const a = (await App.DB.getAll('kb'))[0]; if (a) await App.Data.kb.view(a.id); return a ? a.id : ''; });
  const conf1 = await idle(D);
  ok('employee: create/comment/chat/kb produce no rejections', !conf1.length, JSON.stringify(conf1));
  const t1 = await docOf(sup, 'tickets', tk.id);
  ok('employee ticket stored and auto-assigned to the category technician', t1 && t1.data.assigneeId === techId && t1.data.status === 'assigned', t1 ? `${t1.data.status} → ${t1.data.assigneeId}` : 'missing');
  ok('employee chat stored', !!(await docOf(sup, 'chats', chatId)));
  /* ── الفني ── */
  const Tq = await page('tech');
  await Tq.evaluate(async (id) => { await App.Data.tickets.comment(id, 'رد الفني'); await App.Data.tickets.setStatus(id, 'resolved', 'تم الحل'); }, tk.id);
  await Tq.evaluate(async (cid) => { await App.Data.chat.send(cid, 'رد الدعم'); }, chatId);
  const conf2 = await idle(Tq);
  ok('technician: comment/resolve/answer chat produce no rejections', !conf2.length, JSON.stringify(conf2));
  ok('ticket resolved on the server', ((await docOf(sup, 'tickets', tk.id)) || { data: {} }).data.status === 'resolved');
  /* ── الموظف يقيّم ويؤكد ── */
  await D.waitForTimeout(1500); await D.evaluate(() => App.Sync.pull().catch(() => null)); await D.waitForTimeout(800);
  await D.evaluate(async (id) => { await App.Data.tickets.rateFull(id, 5, ['سريع'], 'شكراً'); }, tk.id);
  const conf3 = await idle(D);
  const t3 = await docOf(sup, 'tickets', tk.id);
  ok('employee rating accepted', !conf3.length && t3 && Number(t3.data.rating || (t3.data.rate || {}).stars || 0) === 5, JSON.stringify(conf3) + ' ' + JSON.stringify((t3 || {}).data ? { rating: t3.data.rating, status: t3.data.status } : {}));
  /* ── محاولات العبث المباشر بحساب الموظف ── */
  const dep = (await api('login', { username: 'dep', password: 'Passw0rd!' })).j.token;
  const other = (await api('push', { ops: [{ store: 'tickets', id: 'tk_other_' + Date.now(), rev: 0, data: { id: 'x', title: 'بلاغ موظف آخر', requesterId: techId, status: 'new' } }] }, sup)).j.applied[0].id;
  const tries = [
    ['edit another user\'s ticket', [{ store: 'tickets', id: other, rev: -1, data: { id: other, title: 'عبث', requesterId: techId, status: 'closed' } }]],
    ['create an inventory item', [{ store: 'items', id: 'it_t_' + Date.now(), rev: 0, data: { id: 'x', name: 'صنف' } }]],
    ['write a stock balance', [{ store: 'stock', id: 'w|i' + Date.now(), rev: 0, data: { warehouseId: 'w', itemId: 'i', qty: 99 } }]],
    ['delete an activity entry', [{ store: 'activity', id: 'act_any', rev: -1, deleted: 1 }]],
    ['publish an announcement', [{ store: 'announcements', id: 'an_' + Date.now(), rev: 0, data: { id: 'x', title: 'إعلان' } }]],
    ['write a KB article', [{ store: 'kb', id: 'kb_t_' + Date.now(), rev: 0, data: { id: 'x', title: 'مقال' } }]],
    ['reset the ticket sequence', [{ store: 'meta', id: 'seq:ticket', rev: -1, data: { key: 'seq:ticket', value: 1 } }]],
    ['write an unknown settings key', [{ store: 'meta', id: 'feat:x', rev: -1, data: { key: 'feat:x', value: 1 } }]],
    ['delete another user\'s notification', [{ store: 'notifications', id: 'nt_x', rev: -1, deleted: 1 }]]
  ];
  for (const [name, ops] of tries) { const r = (await api('push', { ops }, dep)).j; ok(`employee blocked: ${name}`, !(r.applied || []).length, JSON.stringify(r.conflicts ? r.conflicts.map((c) => c.reason) : r)); }
  /* حقول الفني في بلاغ الموظف نفسه */
  const mine = await docOf(sup, 'tickets', tk.id);
  await api('push', { ops: [{ store: 'tickets', id: tk.id, rev: -1, data: { ...mine.data, status: 'resolved', assigneeId: 'u_someone', requesterId: 'u_other' } }] }, dep);
  const after = (await docOf(sup, 'tickets', tk.id)).data;
  ok('employee cannot set staff status/assignee/requester on own ticket', after.requesterId === mine.data.requesterId && after.assigneeId === mine.data.assigneeId && after.status === mine.data.status, `${after.status} ${after.assigneeId} ${after.requesterId}`);
  /* سجل النشاط يُكتب دائماً باسم صاحب الجلسة */
  const aid = 'act_forge_' + Date.now();
  await api('push', { ops: [{ store: 'activity', id: aid, rev: 0, data: { id: aid, action: 'delete', userId: 'u1', summary: 'مزور' } }] }, dep);
  const act = await docOf(sup, 'activity', aid);
  ok('activity entry is stamped with the real author', act && act.data.userId !== 'u1', act ? act.data.userId : 'missing');
  /* شاشة العرض للقراءة فقط */
  const salt = crypto.randomBytes(16), h = crypto.pbkdf2Sync('Passw0rd!', salt, 1000, 32, 'sha256').toString('hex');
  await api('push', { ops: [{ store: 'users', id: 'u_mon_t', rev: -1, data: { id: 'u_mon_t', username: 'mon_t', name: 'شاشة', role: 'monitor', active: 1, pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash: h } } }] }, sup);
  const mon = (await api('login', { username: 'mon_t', password: 'Passw0rd!' })).j.token;
  const m1 = (await api('push', { ops: [{ store: 'meta', id: 'settings', rev: -1, data: { key: 'settings', value: { systemName: 'x' } } }] }, mon)).j;
  const m2 = (await api('push', { ops: [{ store: 'meta', id: 'presence:u_mon_t', rev: -1, data: { key: 'presence:u_mon_t', value: { at: Date.now() } } }] }, mon)).j;
  ok('display account cannot change settings', !(m1.applied || []).length);
  ok('display account can still report its own presence', (m2.applied || []).length === 1);
  console.log(res.join('\n'));
  console.log('page errors:', JSON.stringify([...S.errs, ...D.errs, ...Tq.errs].slice(0, 5)));
  await api('push', { ops: [{ store: 'users', id: 'u_mon_t', rev: -1, deleted: 1 }, { store: 'tickets', id: other, rev: -1, deleted: 1 }, { store: 'activity', id: aid, rev: -1, deleted: 1 }] }, sup);
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
