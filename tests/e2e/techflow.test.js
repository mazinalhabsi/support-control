/* اختبار طرفي: سير عمل الفني في البلاغات — موظف وفنيان ومشرف على أجهزة منفصلة.
   الإسناد التلقائي، سباق الاستلام، التعليق بسبب، رد المستفيد على المعلّق، الملاحظات الداخلية، الحل والتأكيد،
   «المشكلة لم تُحل»، إعادة الإسناد، لوحة البلاغات، والعدادات.
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/techflow.test.js */
const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php', U = BASE;
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
const pull = async (tok) => { let since = 0; const out = []; for (;;) { const r = await fetch(`${B}?a=pull&since=${since}&limit=3000`, { headers: { 'X-Token': tok } }).then((x) => x.json()); out.push(...r.docs); since = r.rev; if (!r.more) break; } return out; };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
(async () => {
  const T = String(Date.now() % 100000), sup = (await api('login', { username: 'sup', password: 'Passw0rd!' })).j.token;
  const TECH2 = `u_tech2_${T}`, salt = crypto.randomBytes(16), hash = crypto.pbkdf2Sync('Passw0rd!', salt, 1000, 32, 'sha256').toString('hex');
  await api('push', { ops: [{ store: 'users', id: TECH2, rev: -1, data: { id: TECH2, username: `tech2_${T}`, name: 'الفني الثاني', role: 'technician', active: 1, mustChangePassword: 0, categories: [], pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash } } }] }, sup);
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const page = async (user) => {
    const c = await b.newContext({ viewport: { width: 1400, height: 900 } }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} });
    const p = await c.newPage(); p.setDefaultTimeout(20000); p.on('pageerror', (e) => errs.push(`${user}: ${e.message}`));
    await p.goto(U); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', user); await p.fill('[name="password"]', 'Passw0rd!'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.App && App.Auth.user, null, { timeout: 20000 }); await p.waitForTimeout(1500); return p;
  };
  const S = await page('sup');
  /* الفني الأول مسؤول عن فئة الطابعات (يعود تخصصه كما كان في النهاية) */
  const techId = await S.evaluate(() => App.Data.list('users').find((u) => u.username === 'tech').id);
  const oldCats = await S.evaluate(async (id) => { const r = await App.DB.get('users', id), was = r.categories || []; r.categories = ['printer']; r.updatedAt = Date.now(); await App.DB.put('users', r); await App.Data.refresh('users'); return was; }, techId);
  await S.waitForTimeout(2500);
  const D = await page('dep'), T1 = await page('tech'), T2 = await page(`tech2_${T}`);
  const depTok = (await api('login', { username: 'dep', password: 'Passw0rd!' })).j.token;
  const sync = async (...ps) => { for (const p of ps) await p.evaluate(() => App.Sync.flush()).catch(() => null); await new Promise((r) => setTimeout(r, 1500)); for (const p of ps) await p.evaluate(() => App.Sync.pull()).catch(() => null); await new Promise((r) => setTimeout(r, 800)); };
  const notes = (p, num) => p.evaluate(async (num) => (await App.DB.getAll('notifications')).filter((n) => n.userId === App.Auth.user.id && (!num || String(n.title).includes(num))).sort((a, b) => a.at - b.at).map((n) => ({ t: n.title, b: n.body })), num);
  const server = async (id) => (await pull(sup)).filter((d) => d.store === 'tickets' && d.id === id).pop().data;
  const create = (o) => D.evaluate(async (o) => { const t = await App.Data.tickets.create({ description: 'اختبار سير العمل', priority: 'medium', ...o }); return { id: t.id, number: t.number }; }, o);
  /* ينفّذ عملية على البلاغ ويعيد «done» أو رسالة الرفض */
  const tryRun = (p, op, id, ...args) => p.evaluate(async ([op, id, args]) => { try { await App.Data.tickets[op](id, ...args); return 'done'; } catch (e) { return e.message; } }, [op, id, args]);

  /* 1) فئة لها مسؤول: إسناد تلقائي وإشعار واحد له */
  const p1 = await create({ title: `طابعة لا تطبع ${T}`, categoryId: 'printer' });
  await sync(D, T1, T2);
  const t1 = await server(p1.id), n1 = await notes(T1, p1.number);
  ok('auto-assigned to the category owner', t1.assigneeId === techId && t1.status === 'assigned');
  ok('owner gets one notice for it, not two', n1.length === 1 && /أُسند إليك/.test(n1[0].t), JSON.stringify(n1));
  const badge = await T1.evaluate(() => { const b = document.querySelector('[data-badge="tickets"]'); return b && !b.hidden ? Number(b.textContent) : 0; });
  ok('nav badge counts own tickets not started yet', badge >= 1, String(badge));

  /* 2) فئة بلا مسؤول، وسباق الاستلام بعد وصول استلام الأول */
  const e1 = await create({ title: `البريد لا يفتح ${T}`, categoryId: 'email', priority: 'high' });
  await sync(D, T1, T2);
  const tabs = await T1.evaluate(async () => { location.hash = '#/tickets'; await new Promise((r) => setTimeout(r, 1500)); return [...document.querySelectorAll('#scopes .tab')].map((x) => x.textContent.trim()); });
  ok('the unclaimed tab is named «بانتظار الاستلام»', tabs.some((x) => x.startsWith('بانتظار الاستلام')), tabs.join(' | '));
  await T1.evaluate((id) => App.Data.tickets.claim(id), e1.id); await sync(T1, T2);
  const steal = await tryRun(T2, 'claim', e1.id);
  await sync(T2, T1, D);
  ok('a ticket already claimed cannot be claimed again', steal !== 'done' && (await server(e1.id)).assigneeId === techId, steal);
  ok('requester told once that it was claimed', (await notes(D, e1.number)).filter((n) => /استلم/.test(n.t)).length === 1);

  /* 3) العمل، الملاحظة الداخلية، ملاحظة التسليم، التعليق بسبب */
  const noReason = await tryRun(T1, 'setStatus', e1.id, 'waiting', '');
  ok('putting on hold needs a reason', noReason !== 'done', noReason);
  await T1.evaluate(async (id) => { await App.Data.tickets.setStatus(id, 'in_progress'); await App.Data.tickets.comment(id, 'ملاحظة داخلية سرية', true); await App.Data.tickets.handover(id, 'تسليم: يحتاج إعادة ضبط', false); await App.Data.tickets.setStatus(id, 'waiting', 'نحتاج رقم هاتفك المحدّث'); }, e1.id);
  await sync(T1, D);
  const hold = (await notes(D, e1.number)).pop();
  ok('hold notice tells the requester the reason', hold && /معلّق/.test(hold.t) && /رقم هاتفك/.test(hold.b), JSON.stringify(hold));
  const leak = (await pull(depTok)).filter((d) => (d.store === 'ticketEvents' && d.data && d.data.ticketId === e1.id && d.data.internal) || (d.store === 'tickets' && d.id === e1.id && d.data && d.data.handover));
  ok('internal and handover notes never reach the requester device', !leak.length, leak.map((d) => d.store).join(','));

  /* 4) رد المستفيد على المعلّق */
  await D.evaluate((id) => App.Data.tickets.comment(id, 'رقمي 99887766'), e1.id); await sync(D, T1);
  const after = await server(e1.id), tn = (await notes(T1, e1.number)).pop();
  ok('requester reply resumes the held ticket', after.status === 'in_progress', after.status);
  ok('technician told the requester answered', tn && /ردّ المستفيد/.test(tn.t), JSON.stringify(tn));
  ok('handover note survives the requester write', !!(after.handover && after.handover.text));

  /* 5) الحل والتأكيد */
  const noSummary = await tryRun(T1, 'setStatus', e1.id, 'resolved', '');
  await T1.evaluate((id) => App.Data.tickets.setStatus(id, 'resolved', 'أُعيد ضبط كلمة المرور'), e1.id); await sync(T1, D);
  await D.evaluate((id) => App.Data.tickets.confirmFix(id), e1.id); await sync(D, T1);
  ok('resolving needs a summary; requester confirms and it closes', noSummary !== 'done' && (await server(e1.id)).status === 'closed');

  /* 6) استلام متزامن قبل أن يصل أيٌّ منهما للآخر */
  const e2 = await create({ title: `البريد على الجوال ${T}`, categoryId: 'email' });
  await sync(D, T1, T2);
  await Promise.all([T1, T2].map((p) => p.evaluate((id) => { location.hash = '#/tickets/' + id; }, e2.id))); await T1.waitForTimeout(1200);
  await Promise.all([T1, T2].map((p) => p.evaluate((id) => App.Data.tickets.claim(id).catch(() => null), e2.id)));
  await sync(T1, T2); await sync(T1, T2, D);
  const win = (await server(e2.id)).assigneeId, loser = win === techId ? T2 : T1, winnerPage = win === techId ? T1 : T2;
  const toast = await loser.evaluate(() => [...document.querySelectorAll('#toasts .toast span')].map((x) => x.textContent).join(' | '));
  ok('simultaneous claims: the loser is told who got it', /قبلك بلحظات/.test(toast), toast);
  ok('simultaneous claims: requester told once', (await notes(D, e2.number)).filter((n) => /استلم/.test(n.t)).length === 1);
  ok('simultaneous claims: one claim in the timeline', (await pull(sup)).filter((d) => d.store === 'ticketEvents' && d.data && d.data.ticketId === e2.id && d.data.type === 'assigned').length === 1);

  /* 7) إعادة الإسناد: الفني السابق يعلم */
  const other = win === techId ? TECH2 : techId;
  await S.evaluate(([id, to]) => App.Data.tickets.assign(id, to), [e2.id, other]); await sync(S, T1, T2);
  const prevNote = (await notes(winnerPage, e2.number)).pop();
  ok('previous technician told of reassignment', prevNote && /أُعيد إسناد البلاغ/.test(prevNote.t), JSON.stringify(prevNote));

  /* 8) «المشكلة لم تُحل» من المستفيد */
  const owner = win === techId ? T2 : T1;
  await owner.evaluate((id) => App.Data.tickets.setStatus(id, 'resolved', 'فُعّل الحساب'), e2.id); await sync(owner, D);
  await D.evaluate(async (id) => { const t = await App.DB.get('tickets', id); return App.Data.tickets.setStatus(id, t.assigneeId ? 'in_progress' : 'new', 'ما زالت الرسائل لا تصل'); }, e2.id);
  await sync(D, owner); await sync(D, owner);
  const nf = (await notes(owner, e2.number)).pop();
  ok('«not fixed» reopens the ticket to its technician', (await server(e2.id)).status === 'in_progress');
  ok('technician told the requester reopened it', nf && /أعاد المستفيد فتح البلاغ/.test(nf.t), JSON.stringify(nf));

  /* 9) لوحة البلاغات: بلاغ زميلك لا تغيّر حالته بالسحب */
  await T2.evaluate(() => { location.hash = '#/tickets?view=board&scope=open'; }); await T2.waitForSelector(`.tcard[data-id="${p1.id}"]`);
  await T2.dragAndDrop(`.tcard[data-id="${p1.id}"]`, '.lane[data-lane="in_progress"]'); await T2.waitForTimeout(800);
  const bt = await T2.evaluate(() => [...document.querySelectorAll('#toasts .toast span')].map((x) => x.textContent).pop() || '');
  await sync(T2);
  ok('board: a colleague\'s ticket cannot be moved', (await server(p1.id)).status === 'assigned' && /ويغيّر حالته هو/.test(bt), bt);

  /* 10) الاستكمال والفني الأول نشط، والتبويب الأول للفني */
  const take = await tryRun(T2, 'takeOver', p1.id, 'سأكمله');
  ok('taking over from an active colleague is refused', take !== 'done', take);
  const tab = await T1.evaluate(async () => { location.hash = '#/dashboard'; await new Promise((r) => setTimeout(r, 300)); location.hash = '#/tickets'; await new Promise((r) => setTimeout(r, 1500)); return new URLSearchParams(location.hash.split('?')[1]).get('scope'); });
  ok('ticket list opens on «assigned to me» when nothing waits to be claimed', tab === 'mine', tab);

  /* تنظيف */
  await S.evaluate(async ([id, cats]) => { const r = await App.DB.get('users', id); r.categories = cats; r.updatedAt = Date.now(); await App.DB.put('users', r); }, [techId, oldCats]);
  await api('push', { ops: [p1.id, e1.id, e2.id].map((id) => ({ store: 'tickets', id, rev: -1, deleted: 1 })).concat([{ store: 'users', id: TECH2, rev: -1, deleted: 1 }]) }, sup);
  await S.waitForTimeout(1500);
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
