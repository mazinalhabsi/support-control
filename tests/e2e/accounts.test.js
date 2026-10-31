/* اختبار طرفي: فحص الحسابات والصلاحيات.
   - صلاحيات كانت تظهر ولا تعمل: إخفاء المستندات، جدول النسخ الاحتياطي، كلمات المرور لحساب موظف، صلاحية النماذج
   - حذف سجل قبل وصوله للخادم لا يُظهر «رفض الخادم»، والمسارات المباشرة مطابقة لمدخلها في مركز الإعدادات
   - ما يستلمه كل حساب من الخادم بحسب صلاحياته، وتحدّث الجهاز حين تُمنح صلاحية أو تُسحب، وتنظيف الأجهزة القديمة
   - سياسة الصور الشخصية تُفرض على الخادم
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome DBNAME=اسم_قاعدة_الاختبار node tests/e2e/accounts.test.js */
const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php', U = BASE;
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
const pull = async (tok) => { let since = 0; const out = []; for (;;) { const r = await fetch(`${B}?a=pull&since=${since}&limit=3000`, { headers: { 'X-Token': tok } }).then((x) => x.json()); out.push(...r.docs); since = r.rev; if (!r.more) return { docs: out, scope: r.scope }; } };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
const mkUser = (id, username, extra = {}) => { const salt = crypto.randomBytes(16), hash = crypto.pbkdf2Sync('Passw0rd!', salt, 1000, 32, 'sha256').toString('hex'); return { store: 'users', id, rev: -1, data: { id, username, name: 'حساب ' + username, role: 'department', active: 1, mustChangePassword: 0, extraPerms: [], deniedPerms: [], pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash }, createdAt: Date.now(), updatedAt: Date.now(), ...extra } }; };
(async () => {
  const T = String(Date.now() % 100000), sup = (await api('login', { username: 'sup', password: 'Passw0rd!' })).j.token;
  const depLogin = (await api('login', { username: 'dep', password: 'Passw0rd!' })).j, depId = depLogin.user.id;
  const P = (k) => `u_acc_${k}_${T}`, N = (k) => `acc${k}${T}`;
  const accounts = { hide: ['forms.hide'], bak: ['backup.manage'], pw: ['users.password'], rep: ['replies.manage'], inv: ['inventory.manage'], kb: ['kb.write'], rpt: ['reports'], emp2: [] };
  await api('push', { ops: [...Object.entries(accounts).map(([k, perms]) => mkUser(P(k), N(k), { extraPerms: perms })), mkUser(P('tech'), N('tech'), { role: 'technician', deniedPerms: ['forms'] })] }, sup);
  /* بلاغ لموظف آخر، ليُعرف من يستلم بلاغات غيره */
  const TK = `tk_acc_${T}`;
  await api('push', { ops: [{ store: 'tickets', id: TK, rev: 0, data: { id: TK, number: `ACC-${T}`, title: 'بلاغ موظف آخر', description: 'x', categoryId: 'other', priority: 'medium', status: 'new', requesterId: depId, createdAt: Date.now(), updatedAt: Date.now(), dueAt: Date.now() + 86400000 } }] }, sup);
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const page = async (user, pw = 'Passw0rd!') => {
    const c = await b.newContext({ viewport: { width: 1366, height: 860 } }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} });
    const p = await c.newPage(); p.setDefaultTimeout(25000); p.on('pageerror', (e) => errs.push(`${user}: ${e.message}`));
    await p.goto(U); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', user); await p.fill('[name="password"]', pw); await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.App && App.Auth.user, null, { timeout: 25000 }); await p.waitForTimeout(2000); return p;
  };
  const settle = async (p) => { await p.evaluate(() => App.Sync.flush()).catch(() => null); await p.waitForTimeout(2500); };
  const warns = (p) => p.evaluate(() => [...document.querySelectorAll('#toasts .toast.tone-amber span')].map((x) => x.textContent).join(' | '));
  const server = async (store, id) => { const d = (await pull(sup)).docs.filter((x) => x.store === store && x.id === id).pop(); return d && !d.deleted ? d.data : null; };

  /* 1) إخفاء المستندات (النماذج المدمجة يسجّلها على الخادم من يملك إدارة النماذج عند فتح صفحتها) */
  const S0 = await page('sup'); await S0.evaluate(() => App.Data.forms.list()); await settle(S0); await S0.context().close();
  const H = await page(N('hide'));
  const form = await H.evaluate(async () => { const f = (await App.Data.forms.list())[0]; const r = await App.DB.get('forms', f.id); r.hidden = r.hidden ? 0 : 1; r.updatedAt = Date.now(); await App.DB.put('forms', r); return { id: f.id, hidden: r.hidden }; });
  await settle(H);
  ok('«hide documents» can hide a form (was rolled back by the server)', (await server('forms', form.id)).hidden === form.hidden && !(await warns(H)), await warns(H));
  await H.evaluate(async (id) => { const r = await App.DB.get('forms', id); r.hidden = r.hidden ? 0 : 1; r.updatedAt = Date.now(); await App.DB.put('forms', r); }, form.id); await settle(H);

  /* 2) جدول النسخ الاحتياطي، دون غيره من الإعدادات */
  const K = await page(N('bak'));
  await K.evaluate(async () => { App.Data.c.settings.supportPhone = '11111111'; await App.Data.backup.setSchedule({ on: 1, every: 'weekly' }); });
  await settle(K);
  const st = await server('meta', 'settings');
  ok('«backup» can save the backup schedule (was rolled back)', st.value.backupPlan && st.value.backupPlan.every === 'weekly' && !(await warns(K)), await warns(K));
  ok('…but cannot change other settings through it', st.value.supportPhone !== '11111111', String(st.value.supportPhone));

  /* 3) كلمات المرور لحساب موظف */
  const W = await page(N('pw'));
  const pwRes = await W.evaluate(async ([a, t]) => { const r = []; for (const id of [a, t]) { try { await App.Data.users.setPassword(id, 'Newpass123', 0); r.push('done'); } catch (e) { r.push(e.message); } } return r; }, [P('emp2'), P('tech')]);
  ok('employee with «passwords» resets an employee password', pwRes[0] === 'done' && !!(await api('login', { username: N('emp2'), password: 'Newpass123' })).j.token, pwRes[0]);
  ok('…but not a technician\'s', pwRes[1] !== 'done' && !(await api('login', { username: N('tech'), password: 'Newpass123' })).j.token, pwRes[1]);

  /* 4) صلاحية النماذج تُسحب فعلاً، والمسارات المباشرة مطابقة لمدخلها */
  const X = await page(N('tech'));
  const forms = await X.evaluate(async () => { location.hash = '#/forms'; await new Promise((r) => setTimeout(r, 1200)); return { denied: /لا تملك صلاحية لهذه الصفحة/.test(document.body.innerText), nav: !!document.querySelector('a[href="#/forms"]') }; });
  ok('revoking «forms» closes the forms page and hides it from the menu', forms.denied && !forms.nav, JSON.stringify(forms));
  const R = await page(N('rep'));
  const direct = async (p, path) => p.evaluate(async (path) => { location.hash = '#' + path; await new Promise((r) => setTimeout(r, 1300)); return location.hash.split('?')[0] === '#' + path && !/لا تملك صلاحية/.test((document.querySelector('#view, main') || document.body).innerText.slice(0, 600)); }, path);
  ok('«replies» opens the replies page from a direct link', await direct(R, '/replies'));
  const I = await page(N('inv'));
  ok('«manage inventory» opens the printers page from a direct link', await direct(I, '/printers'));

  /* 5) حذف قبل الإرسال */
  await R.evaluate(async () => { const r = await App.Data.replies.save({ title: 'رد عام مؤقت', text: 'نص مؤقت', scope: 'all', kind: 'ticket' }); await App.Data.replies.remove(r.id); });
  await settle(R);
  ok('create then delete before syncing: no «server refused» message', !(await warns(R)), await warns(R));

  /* 6) ما يستلمه كل حساب */
  const tickets = (await pull(sup)).docs.filter((d) => d.store === 'tickets' && !d.deleted && d.data.requesterId !== P('kb')).length;
  const seen = async (user, pw = 'Passw0rd!') => { const tok = (await api('login', { username: user, password: pw })).j.token, me = (await api('me', {}, tok)).j.user.id, { docs, scope } = await pull(tok); const c = (st, f) => docs.filter((d) => d.store === st && !d.deleted && d.data && f(d.data)).length; return { scope, tickets: c('tickets', (x) => x.requesterId !== me), notes: c('notifications', (x) => x.userId !== me), activity: c('activity', (x) => x.userId !== me) }; };
  const vKb = await seen(N('kb')), vRpt = await seen(N('rpt')), vTech = await seen('tech'), vSup = await seen('sup');
  ok('employee with a small extra permission gets only own data', vKb.tickets === 0 && vKb.notes === 0 && vKb.activity === 0, JSON.stringify(vKb));
  ok('employee with «reports» gets tickets, not others\' notifications or activity', vRpt.tickets === tickets && tickets > 0 && vRpt.notes === 0 && vRpt.activity === 0, JSON.stringify(vRpt));
  ok('technician gets tickets, not others\' notifications or the activity log', vTech.tickets > 0 && vTech.notes === 0 && vTech.activity === 0, JSON.stringify(vTech));
  ok('supervisor still gets everything', vSup.notes > 0 && vSup.activity > 0, JSON.stringify(vSup));

  /* 7) منح صلاحية وسحبها: الجهاز يستلم ما صار متاحاً ويمحو ما لم يعد كذلك */
  const E = await page(N('emp2'), 'Newpass123');
  const others = () => E.evaluate(async (me) => (await App.DB.getAll('tickets')).filter((t) => t.requesterId !== me).length, P('emp2'));
  const before = await others();
  const setPerms = async (perms) => { const u = (await pull(sup)).docs.filter((d) => d.store === 'users' && d.id === P('emp2')).pop().data; await api('push', { ops: [{ store: 'users', id: P('emp2'), rev: -1, data: { ...u, extraPerms: perms, updatedAt: Date.now() } }] }, sup); };
  const waitFor = async (want) => { for (let i = 0; i < 20; i++) { await E.evaluate(() => App.Sync.pull()).catch(() => null); await E.waitForTimeout(1500); if (want(await others())) return true; } return false; };
  await setPerms(['tickets.all']);
  const grew = await waitFor((n) => n > 0);
  await setPerms([]);
  const shrank = await waitFor((n) => n === 0);
  ok('granting a permission brings its data to the open device', before === 0 && grew);
  ok('revoking it removes that data from the device', shrank);

  /* 8) تنظيف الأجهزة القديمة: إشعارات غير صاحبها وسجل نشاط الجميع */
  const TP = await page('tech');
  const pruned = await TP.evaluate(async (dep) => { const me = App.Auth.user.id; await App.Sync.raw.put('notifications', { id: 'nt_old_' + Date.now(), userId: dep, at: Date.now(), read: 0, title: 'إشعار لغيره', body: '', link: '', kind: 'info' }); await App.Sync.raw.put('activity', { id: 'act_old_' + Date.now(), at: Date.now(), userId: dep, action: 'update', entity: 'x', entityId: '', summary: 'قديم' }); await App.Sync.raw.del('meta', 'sync:pruned:' + me); await App.Sync.prune(); return { notes: (await App.DB.getAll('notifications')).filter((n) => n.userId !== me).length, acts: (await App.DB.getAll('activity')).filter((a) => a.userId !== me).length }; }, depId);
  ok('old devices: others\' notifications and activity are cleaned once', pruned.notes === 0 && pruned.acts === 0, JSON.stringify(pruned));

  /* 9) سياسة الصور الشخصية على الخادم */
  const S = await page('sup');
  const policy = await S.evaluate(() => App.Data.c.settings.avatars || 'off');
  const pic = 'data:image/png;base64,iVBORw0KGgo=';
  const tryAvatar = async (pol, pic) => { await S.evaluate(async (pol) => App.Data.saveSettings({ avatars: pol }), pol); await settle(S); const me = (await pull(sup)).docs.filter((d) => d.store === 'users' && d.id === P('kb')).pop().data; const tok = (await api('login', { username: N('kb'), password: 'Passw0rd!' })).j.token; await api('push', { ops: [{ store: 'users', id: P('kb'), rev: -1, data: { ...me, avatar: pic, avatarPending: pic, updatedAt: Date.now() } }] }, tok); return server('users', P('kb')); };
  const pic2 = 'data:image/png;base64,iVBORw0KGgoX';
  const ap = await tryAvatar('approval', pic), off = await tryAvatar('off', pic2);
  ok('«approval» policy: a picture sent directly stays pending', !ap.avatar && ap.avatarPending === pic);
  ok('«off» policy: a new picture is not stored at all', !off.avatar && off.avatarPending === pic);
  await S.evaluate(async (pol) => App.Data.saveSettings({ avatars: pol }), policy); await settle(S);

  /* تنظيف */
  await api('push', { ops: [...Object.keys(accounts), 'tech'].map((k) => ({ store: 'users', id: P(k), rev: -1, deleted: 1 })).concat([{ store: 'tickets', id: TK, rev: -1, deleted: 1 }]) }, sup);
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
