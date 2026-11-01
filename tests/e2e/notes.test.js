/* اختبار طرفي: الملاحظات — من يرى كل ملاحظة، والمجموعات، والمؤقتة، والمهمة، والمهام.
   الخادم:
   - الخاصة لكاتبها وحده (ولا يراها المشرف)، و«المحددون» بالاسم أو الدور أو المجموعة، والمؤقتة تختفي بانتهاء مدتها وتُحذف
   - من في القائمة يعدّل المحتوى ولا يغيّر من يراها، والحذف لكاتبها، ومن خرج من القائمة تُمسح من جهازه
   - المجموعة يعدّلها منشئها، والمشتركة القديمة تبقى لمن كان يراها وتتحول قائمة صريحة
   الواجهة:
   - اختيار فني بالاسم ودور كامل، وعدد من سيراها، والإشعار والشارة واللافتة و«اطّلعت»، وإنجاز مهمة من مستلم
   - مجموعة جديدة من داخل الاختيار وعضوها يستلم الملاحظة، والمستلم لا يغيّر من يراها، والمؤقتة تختفي من الصفحة
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome FILES_DIR=/مجلد/المرفقات node tests/e2e/notes.test.js */
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php', FILES = process.env.FILES_DIR || '/srv/sqtest/files-e2e';
const api = async (a, body, tok, q = '') => { const r = await fetch(`${B}?a=${a}${q}`, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(tok ? { 'X-Token': tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); return r.json().catch(() => ({})); };
const pull = async (tok, since = 0) => { const out = []; for (;;) { const r = await api('pull', null, tok, `&since=${since}&limit=3000`); out.push(...r.docs); since = r.rev; if (!r.more) return { docs: out, rev: since }; } };
const mkUser = (id, name, extra = {}) => { const salt = crypto.randomBytes(16), hash = crypto.pbkdf2Sync('Passw0rd!', salt, 1000, 32, 'sha256').toString('hex'); return { store: 'users', id, rev: -1, data: { id, username: id, name, role: 'technician', active: 1, mustChangePassword: 0, extraPerms: [], deniedPerms: [], pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash }, createdAt: Date.now(), updatedAt: Date.now(), ...extra } }; };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
(async () => {
  const T = String(Date.now() % 100000), sup = (await api('login', { username: 'sup', password: 'Passw0rd!' })).token;
  const [A, Bt, C, M, D, G2] = ['na', 'nb', 'nc', 'nm', 'nd', 'ng'].map((x) => x + T);
  await api('push', { ops: [mkUser(A, `أحمد ${T}`), mkUser(Bt, `بدر ${T}`), mkUser(C, `سالم ${T}`), mkUser(M, `مريم ${T}`, { role: 'support_manager' }), mkUser(D, `دانة ${T}`, { role: 'department' }), mkUser(G2, `غيث ${T}`, { extraPerms: ['vault.read'] })] }, sup);
  const tok = {}; for (const u of [A, Bt, C, M, D]) tok[u] = (await api('login', { username: u, password: 'Passw0rd!' })).token;
  const sees = async (u, id) => { const d = (await pull(tok[u])).docs.filter((x) => x.store === 'vault' && x.id === id).pop(); return d ? (d.deleted ? 'gone' : 'yes') : 'none'; };
  const put = async (u, data, rev = -1) => api('push', { ops: [{ store: 'vault', id: data.id, rev, data }] }, tok[u]);
  const cur = async (id, t = tok[A]) => (await pull(t)).docs.filter((x) => x.store === 'vault' && x.id === id).pop();

  /* ── الخادم ── */
  const n1 = { id: `vn_a_${T}`, type: 'general', title: 'لزميل', body: 'x', visibility: 'custom', audience: { users: [Bt], roles: [], groups: [] }, createdBy: 'spoof', updatedAt: Date.now() };
  ok('a technician writes notes by default', ((await put(A, n1)).applied || []).length === 1);
  ok('the server records the real author', (await cur(n1.id)).data.createdBy === A);
  ok('the chosen colleague sees it; another technician and a department account do not', (await sees(Bt, n1.id)) === 'yes' && (await sees(C, n1.id)) !== 'yes' && (await sees(D, n1.id)) === 'none');
  const g = { id: `ng_${T}`, name: `مجموعة الخادم ${T}`, members: [C], updatedAt: Date.now() };
  const rg = await api('push', { ops: [{ store: 'noteGroups', id: g.id, rev: -1, data: g }] }, tok[A]);
  const rg2 = await api('push', { ops: [{ store: 'noteGroups', id: g.id, rev: rg.applied[0].rev, data: { ...g, members: [C, Bt] } }] }, tok[Bt]);
  ok('a technician creates a group and only its creator edits it', (rg.applied || []).length === 1 && !(rg2.applied || []).length);
  const n2 = { id: `vn_g_${T}`, type: 'general', title: 'للمجموعة والإداريين', visibility: 'custom', audience: { users: [], roles: ['support_manager'], groups: [g.id] }, updatedAt: Date.now() };
  await put(A, n2);
  ok('group members and a whole role see it, others do not', (await sees(C, n2.id)) === 'yes' && (await sees(M, n2.id)) === 'yes' && (await sees(Bt, n2.id)) !== 'yes');
  const c1 = await cur(n1.id);
  const r3 = await put(Bt, { ...c1.data, body: 'أنجزت', visibility: 'all', audience: { users: [Bt, C], roles: [], groups: [] } }, c1.rev);
  const c1b = await cur(n1.id);
  ok('someone in the list edits the content but cannot widen who sees it', (r3.applied || []).length === 1 && c1b.data.body === 'أنجزت' && c1b.data.visibility === 'custom' && c1b.data.audience.users.join() === Bt);
  const r4 = await api('push', { ops: [{ store: 'vault', id: n1.id, rev: c1b.rev, deleted: 1 }] }, tok[Bt]);
  ok('only the author deletes, and outsiders cannot edit', !(r4.applied || []).length && !((await put(C, { ...c1b.data, body: 'تسلل' }, c1b.rev)).applied || []).length);
  const before = (await pull(tok[Bt])).rev;
  await put(A, { ...c1b.data, audience: { users: [C], roles: [], groups: [] } }, c1b.rev);
  const after = (await pull(tok[Bt], before)).docs.filter((x) => x.store === 'vault' && x.id === n1.id).pop();
  ok('removing someone from the list sends them a delete so their device drops it', after && after.deleted === 1 && !after.data);
  const n3 = { id: `vn_p_${T}`, type: 'general', title: 'خاصة', visibility: 'private', updatedAt: Date.now() };
  await put(A, n3);
  const supSees = (await pull(sup)).docs.filter((x) => x.store === 'vault' && x.id === n3.id).pop();
  ok('a private note reaches nobody else, not even the supervisor', (await sees(Bt, n3.id)) !== 'yes' && (!supSees || supSees.deleted));
  const n4 = { id: `vn_t_${T}`, type: 'general', title: 'مؤقتة', visibility: 'all', until: Date.now() + 2500, updatedAt: Date.now() };
  await put(A, n4);
  const vis4 = await sees(C, n4.id); await new Promise((r) => setTimeout(r, 3000));
  ok('a temporary note is visible until it ends, then hidden from everyone', vis4 === 'yes' && (await sees(C, n4.id)) !== 'yes' && (await sees(A, n4.id)) !== 'yes');
  const n5 = { id: `vn_l_${T}`, type: 'general', title: 'قديمة', visibility: 'shared', createdBy: 'u_sup', updatedAt: Date.now() };
  await api('push', { ops: [{ store: 'vault', id: n5.id, rev: -1, data: n5 }] }, sup);
  ok('a legacy shared note stays with those who saw it, not every technician', (await sees(M, n5.id)) === 'yes' && (await sees(C, n5.id)) !== 'yes');
  try { fs.unlinkSync(path.join(FILES, 'notes-check')); } catch (_) { /* لا يوجد */ }
  await api('beat', { value: {} }, tok[C]);
  const l = await cur(n5.id, sup);
  ok('the server converts it to an explicit list: admins, supervisors and accounts granted by name', l && l.data.visibility === 'custom' && l.data.audience.roles.includes('support_manager') && l.data.audience.users.includes(G2) && !l.data.audience.users.includes(C), l ? JSON.stringify(l.data.audience).slice(0, 120) : 'none');
  const gone = (await pull(tok[A])).docs.filter((x) => x.store === 'vault' && x.id === n4.id).pop();
  ok('the expired temporary note is deleted on the server', gone && gone.deleted === 1);
  const ns = await api('notes_sync', null, tok[C]), ids = (ns.docs || []).filter((d) => d.store === 'vault').map((d) => d.id);
  ok('notes_sync returns exactly the notes this account may see, with groups', ids.includes(n1.id) && ids.includes(n2.id) && !ids.includes(n3.id) && !ids.includes(n5.id) && (ns.docs || []).some((d) => d.store === 'noteGroups'));
  ok('an account without notes access gets nothing', ((await api('notes_sync', null, tok[D])).docs || []).length === 0);

  /* ── الواجهة ── */
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const login = async (u) => {
    const c = await b.newContext({ viewport: { width: 1440, height: 1000 } }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} });
    const p = await c.newPage(); p.on('pageerror', (e) => errs.push(`${u}: ${e.message}`)); p.setDefaultTimeout(20000);
    await p.goto(BASE); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', u); await p.fill('[name="password"]', 'Passw0rd!'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.App && App.Auth.user); await p.waitForTimeout(1200); return p;
  };
  const sync = (p) => p.evaluate(async () => { await App.Sync.flush(); await App.Sync.pull(); });
  const until = async (p, fn, arg) => { for (let i = 0; i < 30; i++) { await sync(p); if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(500); } return false; };
  const open = async (p) => { await p.evaluate(() => { location.hash = '#/dashboard'; }); await p.waitForTimeout(250); await p.evaluate(() => { location.hash = '#/vault'; }); await p.waitForSelector('.nt-layout'); await p.waitForTimeout(500); };
  const P = await login(A); await until(P, (ids) => ids.every((id) => App.Data.c.users.has(id)), [Bt, C, M]);
  const Q = await login(Bt), R = await login(C);
  await open(P);
  ok('the menu and the page say «Notes»', (await P.textContent('.nav-link[data-path="/vault"]')).includes('الملاحظات') && !(await P.textContent('body')).includes('الملاحظات الإدارية'));
  /* مهام اليوم لبدر بالاسم ولكل الإداريين، مهمة */
  await P.click('[data-qnew="task"]'); await P.waitForSelector('dialog [name="items"]');
  ok('«today\'s tasks» starts as a task list that ends with the day', (await P.inputValue('dialog [name="dur"]')) === 'eod' && /مهام/.test(await P.inputValue('dialog [name="title"]')));
  await P.fill('dialog [name="items"]', 'فحص النسخ الاحتياطي\nمتابعة طابعة الاستقبال\nتحديث مضاد الفيروسات');
  await P.check('dialog input[name="vis"][value="custom"]', { force: true }); await P.waitForSelector('dialog [data-np]:not([hidden])');
  await P.click('dialog [data-nptab="technician"]'); await P.fill('dialog [data-npq]', `بدر ${T}`); await P.waitForTimeout(400);
  await P.check(`dialog [data-npu="${Bt}"]`); await P.click('dialog [data-nptab="support_manager"]'); await P.check('dialog [data-nprole="support_manager"]'); await P.waitForTimeout(200);
  const chips = await P.$$eval('dialog .np-chip', (x) => x.map((e) => e.textContent.trim()));
  ok('the picker lists the chosen colleague and «all admins», with how many will see it', chips.some((c) => c.includes('بدر')) && chips.some((c) => c.includes('كل الإداريين')) && /سيراها \d+ حساب/.test(await P.textContent('dialog .np-foot')));
  await P.locator('dialog [name="important"]').evaluate((i) => { i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await P.click('dialog .btn-primary'); await P.waitForTimeout(1500); await sync(P);
  ok('saving an important note notifies the people who see it', /أُشعر \d+ حساب/.test(await P.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' '))));
  const task = await P.evaluate(async () => (await App.VAULT.list()).find((n) => n.type === 'task' && n.important));
  /* المستلم: إشعار وشارة ولافتة، وإنجاز مهمة، و«اطّلعت» */
  ok('the recipient receives the note and a notification that opens it', await until(Q, (id) => App.DB.get('vault', id).then(Boolean), task.id) && await Q.evaluate(async (id) => (await App.DB.getAll('notifications')).some((n) => n.userId === App.Auth.user.id && n.link === `/vault?n=${id}`), task.id));
  await open(Q);
  const badge = await Q.evaluate(() => { const b0 = document.querySelector('[data-badge="notes"]'); return b0 && !b0.hidden ? b0.textContent : ''; });
  ok('a badge on «Notes» and a banner show the unread important note', badge === '1' && /ملاحظة مهمة لم تطّلع عليها/.test(await Q.textContent('#view')), badge);
  ok('the recipient may tick tasks but not pin the note for everyone', !!(await Q.$(`[data-nid="${task.id}"] [data-vtask]`)) && !(await Q.$(`[data-nid="${task.id}"] [data-pin]`)));
  await Q.click(`[data-nid="${task.id}"] [data-vtask]`); await Q.waitForTimeout(800); await sync(Q);
  ok('a task ticked by the recipient shows as done for the author', await until(P, (id) => App.DB.get('vault', id).then((n) => n && n.items.filter((i) => i.done).length === 1), task.id));
  await Q.click(`[data-vseen="${task.id}"]`); await Q.waitForTimeout(800);
  ok('«I\'ve read it» clears the banner and the badge', !/ملاحظة مهمة لم تطّلع عليها/.test(await Q.textContent('#view')) && await Q.evaluate(() => { const b0 = document.querySelector('[data-badge="notes"]'); return !b0 || b0.hidden; }));
  await Q.click(`[data-nid="${task.id}"] [data-vedit]`); await Q.waitForSelector('dialog .nt-ro');
  ok('a recipient editing the note sees who sees it read-only, and no delete', !(await Q.$('dialog input[name="vis"]')) && !(await Q.$('dialog .btn-danger')));
  await Q.keyboard.press('Escape'); await Q.waitForTimeout(300);
  /* مجموعة جديدة من داخل الاختيار، وعضوها يستلم الملاحظة */
  await P.click('[data-act="new"]'); await P.waitForSelector('dialog [name="title"]');
  await P.fill('dialog [name="title"]', `مفتاح غرفة الخوادم ${T}`);
  await P.check('dialog input[name="vis"][value="custom"]', { force: true }); await P.click('dialog [data-nptab="groups"]'); await P.click('dialog [data-npnewg]');
  await P.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 2);
  const top = P.locator('dialog[open]').last();
  await top.locator('[name="gname"]').fill(`فريق الشبكات ${T}`); await top.locator('[data-nptab="technician"]').click(); await top.locator('[data-npq]').fill(`سالم ${T}`); await P.waitForTimeout(400);
  await top.locator(`[data-npu="${C}"]`).check(); await top.locator('.btn-primary').click();
  await P.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 1);
  ok('a group made from inside the picker is selected at once', (await P.$$eval('dialog .np-chip', (x) => x.map((e) => e.textContent))).some((t) => t.includes(`فريق الشبكات ${T}`)));
  await P.click('dialog .btn-primary'); await P.waitForTimeout(1200); await sync(P);
  const gn = await P.evaluate(async (T) => (await App.VAULT.list()).find((n) => n.title === `مفتاح غرفة الخوادم ${T}`), T);
  ok('the group member receives the note (their device catches up when the group arrives)', !!gn && await until(R, (id) => App.VAULT.list().then((x) => x.some((n) => n.id === id)), gn.id));
  ok('people outside the group do not', !(await Q.evaluate((id) => App.DB.get('vault', id).then(Boolean), gn.id)));
  /* إضافة عضو إلى مجموعة قائمة: الملاحظة لم تتغير، فلا يعيدها السحب العادي؛ يلحق بها جهازه حين يصله تعديل المجموعة */
  await P.evaluate(async ({ T, Bt }) => { const g0 = App.VAULT._g.find((x) => x.name === `فريق الشبكات ${T}`); await App.VAULT.saveGroup({ ...g0, members: [...g0.members, Bt] }); await App.Sync.flush(); }, { T, Bt });
  ok('someone added to an existing group receives its older notes', await until(Q, (id) => App.VAULT.list().then((x) => x.some((n) => n.id === id)), gn.id));
  /* المؤقتة تختفي من الصفحة */
  const tmp = await P.evaluate(async () => { const n = await App.VAULT.save({ type: 'general', title: 'مؤقتة قصيرة', visibility: 'all', until: Date.now() + 3000 }); await App.Sync.flush(); return n.id; });
  await open(P);
  const shown = !!(await P.$(`[data-nid="${tmp}"]`)) && /تختفي بعد/.test(await P.textContent(`[data-nid="${tmp}"]`));
  await P.waitForTimeout(3500); await open(P);
  ok('a temporary note shows its time left, then disappears from the page', shown && !(await P.$(`[data-nid="${tmp}"]`)));
  /* حساب بلا وصول */
  const Dp = await login(D);
  ok('an account without notes access has no «Notes» item', !(await Dp.$('.nav-link[data-path="/vault"]')));
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
