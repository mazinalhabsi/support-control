/* اختبار طرفي: ملاحظات البلاغ في الاتجاهين.
   - فني يكتب ملاحظة على بلاغ لم يستلمه: يصل الموظفَ إشعار بنصها، وتظهر علامة «ملاحظة من الفني» في قائمته وشريط في صفحة البلاغ
   - رد الموظف يصل الفني الذي كتب الملاحظة ولو لم يكن المسؤول، وتظهر له علامة «ردّ الموظف»
   - الملاحظة الداخلية لا تغيّر ما يراه الموظف
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/ticketnotes.test.js */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/';
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const login = async (u) => {
    const c = await b.newContext({ viewport: { width: 1400, height: 900 } }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} });
    const p = await c.newPage(); p.on('pageerror', (e) => errs.push(`${u}: ${e.message}`)); p.setDefaultTimeout(20000);
    await p.goto(BASE); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', u); await p.fill('[name="password"]', 'Passw0rd!'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.App && App.Auth.user); await p.waitForTimeout(1000); return p;
  };
  const sync = (p) => p.evaluate(async () => { await App.Sync.flush(); await App.Sync.pull(); });
  /* ينتظر حتى يصل التغيير إلى المتصفح */
  const until = async (p, fn, arg) => { for (let i = 0; i < 30; i++) { await sync(p); if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(500); } return false; };
  const go = async (p, hash) => { await p.evaluate(() => { location.hash = '#/profile'; }); await p.waitForTimeout(300); await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(900); };
  const notes = (p, id) => p.evaluate(async (id) => (await App.DB.getAll('notifications')).filter((n) => n.userId === App.Auth.user.id && n.link === `/tickets/${id}`).sort((a, b) => b.at - a.at).map((n) => n.title + ' | ' + n.body), id);

  const dep = await login('dep'), tech = await login('tech');
  /* بلاغ في فئة بلا فني مسؤول: يبقى دون استلام */
  const tid = await dep.evaluate(async () => (await App.Data.tickets.create({ title: 'طابعة المكتب لا تطبع ' + Date.now(), description: 'تظهر رسالة خطأ', categoryId: 'other', priority: 'medium' })).id);
  await sync(dep); await until(tech, (id) => App.DB.get('tickets', id).then(Boolean), tid);
  ok('the ticket is unassigned', await tech.evaluate(async (id) => !(await App.DB.get('tickets', id)).assigneeId, tid));
  /* الفني يكتب ملاحظة دون استلام */
  await go(tech, `#/tickets/${tid}`); await tech.fill('#cmt', 'هل الطابعة موصولة بالشبكة؟ أرسل صورة الرسالة'); await tech.click('[data-act="send"]'); await tech.waitForTimeout(800); await sync(tech);
  ok('a technician note before taking the ticket leaves it unassigned and marks him as a follower', await tech.evaluate(async (id) => { const t = await App.DB.get('tickets', id); return !t.assigneeId && t.noteFrom === 'staff' && (t.followers || []).includes(App.Auth.user.id); }, tid));
  await until(dep, (id) => App.DB.getAll('notifications').then((x) => x.some((n) => n.link === `/tickets/${id}` && /ملاحظة من/.test(n.title))), tid);
  const n1 = await notes(dep, tid);
  ok('the employee gets a notification with the note text', n1.some((x) => /ملاحظة من حساب tech/.test(x) && /موصولة بالشبكة/.test(x)), n1[0]);
  await go(dep, '#/tickets');
  ok('the employee\'s ticket list marks the ticket «note from the technician»', /ملاحظة من الفني/.test(await dep.textContent(`tr[data-href="#/tickets/${tid}"]`)));
  await go(dep, `#/tickets/${tid}`);
  const bar = await dep.textContent('.note-bar').catch(() => '');
  ok('the ticket page shows the note in a banner with a reply button', /ملاحظة من حساب tech/.test(bar) && /موصولة بالشبكة/.test(bar) && !!(await dep.$('.note-bar [data-act="replynote"]')));
  await dep.click('.note-bar [data-act="replynote"]');
  ok('«reply to the note» takes the employee to the reply box', await dep.evaluate(() => document.activeElement && document.activeElement.id === 'cmt'));
  /* الموظف يرد: يصل الفني رغم أنه ليس المسؤول */
  await dep.fill('#cmt', 'نعم موصولة، والرسالة: Paper jam'); await dep.click('[data-act="send"]'); await dep.waitForTimeout(800); await sync(dep);
  ok('after the employee replies, the marker leaves his list', await dep.evaluate(async (id) => !App.Pages.notePending(await App.DB.get('tickets', id)), tid));
  await until(tech, (id) => App.DB.getAll('notifications').then((x) => x.some((n) => n.link === `/tickets/${id}` && /ردّ الموظف/.test(n.title))), tid);
  const n2 = await notes(tech, tid);
  ok('the technician who wrote the note is notified of the reply although not assigned', n2.some((x) => /ردّ الموظف على الملاحظة/.test(x) && /Paper jam/.test(x)), n2[0]);
  await go(tech, '#/tickets');
  ok('the technician\'s list marks the ticket «employee replied»', /ردّ الموظف/.test(await tech.textContent(`tr[data-href="#/tickets/${tid}"]`).catch(() => '')));
  /* ملاحظة داخلية: لا تصل الموظف ولا تغيّر علامته */
  await go(tech, `#/tickets/${tid}`); await tech.click('label.switch:has(#internal)'); await tech.fill('#cmt', 'ملاحظة للفنيين فقط'); await tech.click('[data-act="send"]'); await tech.waitForTimeout(800); await sync(tech); await sync(dep);
  ok('an internal note does not reach the employee nor change his view', await dep.evaluate(async (id) => { const t = await App.DB.get('tickets', id), ns = (await App.DB.getAll('notifications')).filter((n) => n.link === `/tickets/${id}` && /داخلية/.test(n.title)); return t.noteFrom === 'requester' && !ns.length; }, tid));
  /* عند الإغلاق تختفي العلامات */
  await tech.evaluate(async (id) => { await App.Data.tickets.setStatus(id, 'cancelled'); await App.Sync.flush(); }, tid);
  ok('markers disappear once the ticket is closed or cancelled', await tech.evaluate(async (id) => !App.Pages.notePending(await App.DB.get('tickets', id)), tid));
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
