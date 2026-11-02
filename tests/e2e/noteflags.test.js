/* اختبار طرفي: علامات ملاحظات البلاغ للفني والموظف، وأيقونات الفئات في الإشعارات وشاشة العرض.
   - ملاحظة جديدة من الموظف (لا رد): الفني يرى في قائمة البلاغات سطراً مظللاً بمقتطفها ونقطة «لم تُفتح»،
     وعلامة «ملاحظة من الموظف»، وتبويب «ملاحظات الموظفين» بعددها، وشارة مستقلة بجانب «البلاغات»
   - داخل البلاغ: شريط «ملاحظة جديدة» ورسالتها في المحادثة مميزة، ثم تهدأ العلامة في القائمة بعد الفتح (وتبقى حتى الرد)
   - رد الفني يظهر للموظف «ردّ الفني»، ورد الموظف بعده يظهر للفني «ردّ الموظف»
   - شاشة العرض: أيقونة فئة لكل بلاغ في قائمة الوصول، وشريط الفئات، وبطاقة الوارد بأيقونة فئته
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/noteflags.test.js */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/';
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const login = async (u, vw = { width: 1400, height: 900 }) => {
    const c = await b.newContext({ viewport: vw }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} });
    const p = await c.newPage(); p.on('pageerror', (e) => errs.push(`${u}: ${e.message}`)); p.setDefaultTimeout(20000);
    await p.goto(BASE); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', u); await p.fill('[name="password"]', 'Passw0rd!'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.App && App.Auth.user); await p.waitForTimeout(1000); return p;
  };
  const sync = (p) => p.evaluate(async () => { await App.Sync.flush(); await App.Sync.pull(); });
  const until = async (p, fn, arg) => { for (let i = 0; i < 30; i++) { await sync(p); if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(500); } return false; };
  const go = async (p, hash) => { await p.evaluate(() => { location.hash = '#/profile'; }); await p.waitForTimeout(300); await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(1000); };
  const rowTxt = (p, id) => p.evaluate((id) => { const r = document.querySelector(`tr[data-href="#/tickets/${id}"]`); return r ? r.textContent.replace(/\s+/g, ' ') : ''; }, id);
  const has = (p, sel) => p.evaluate((s) => !!document.querySelector(s), sel);
  const badge = (p) => p.evaluate(() => { const x = document.querySelector('[data-badge="tnotes"]'); return x && !x.hidden ? Number(x.textContent) : 0; });

  const dep = await login('dep'), tech = await login('tech');
  const title = `الشاشة لا تعرض ${Date.now() % 100000}`;
  const tid = await dep.evaluate(async (title) => (await App.Data.tickets.create({ title, description: 'x', categoryId: 'printer', priority: 'high' })).id, title);
  await sync(dep); await until(tech, (id) => App.DB.get('tickets', id).then(Boolean), tid);
  await tech.evaluate(async (id) => { await App.Data.tickets.assign(id, App.Auth.user.id); }, tid); await sync(tech); await until(dep, (id) => App.DB.get('tickets', id).then((t) => t && t.assigneeId), tid);
  const b0 = await (async () => { await go(tech, '#/tickets'); return badge(tech); })();
  /* أيقونة الفئة في الإشعارات: تُحفظ على الإشعار، وتظهر في قائمة الجرس وصفحة الإشعارات */
  await until(tech, (id) => App.DB.getAll('notifications').then((x) => x.some((n) => n.userId === App.Auth.user.id && n.link === `/tickets/${id}`)), tid);
  const nt = await tech.evaluate((id) => App.DB.getAll('notifications').then((x) => x.filter((n) => n.userId === App.Auth.user.id && n.link === `/tickets/${id}`).map((n) => n.cat)), tid);
  ok('a ticket notification carries the ticket\'s category', nt.length > 0 && nt.every((c) => c === 'printer'), JSON.stringify(nt));
  await tech.click('#bellBtn'); await tech.waitForTimeout(700);
  ok('…and the bell list shows the category icon instead of a generic one', await tech.evaluate((id) => { const n = document.querySelector(`#bellPop .note[data-link="/tickets/${id}"]`); return !!n && !!n.querySelector('.n-cat .cat-ic, .n-cat svg:not(.ic), .n-cat img') && /الطابعات/.test(n.querySelector('.n-cat').title); }, tid));
  await tech.keyboard.press('Escape'); await tech.mouse.click(700, 600); await go(tech, '#/tickets?scope=all');
  /* القائمة المغلقة تبقى في الصفحة بأيقوناتها: إن تكررت معرّفات التدرّج أخذت الأيقونات الظاهرة تدرّج النسخة المخفية فبهتت */
  ok('icon gradient ids are unique on the page even after the bell list is closed', await tech.evaluate(() => { const ids = [...document.querySelectorAll('svg.img3d [id]')].map((x) => x.id); return ids.length > 0 && new Set(ids).size === ids.length && !!document.querySelector('#bellPop svg.img3d'); }));
  await go(tech, '#/notifications');
  ok('…as does the notifications page', await tech.evaluate((id) => !!document.querySelector(`#nList .note[data-link="/tickets/${id}"] .n-cat`), tid));
  await go(tech, '#/tickets');
  /* 1) ملاحظة جديدة من الموظف */
  await go(dep, `#/tickets/${tid}`); await dep.fill('#cmt', 'جربت إعادة التشغيل ولم تنفع، والضوء الأحمر يومض'); await dep.click('[data-act="send"]'); await dep.waitForTimeout(800); await sync(dep);
  /* الموظف يغادر البلاغ: لو بقي مفتوحاً أمامه لعُدّ رد الفني مقروءاً حين يصل */
  await go(dep, '#/profile');
  await until(tech, (id) => App.DB.get('tickets', id).then((t) => t && t.noteFrom === 'requester'), tid);
  await go(tech, '#/tickets?scope=mine');
  const r1 = await rowTxt(tech, tid);
  ok('the technician\'s list says «note from the employee» (a new note, not a reply)', /ملاحظة من الموظف/.test(r1) && !/ردّ الموظف/.test(r1), r1.slice(0, 120));
  ok('…with the note excerpt and who wrote it under the title', /حساب dep:/.test(r1) && /جربت إعادة التشغيل/.test(r1));
  ok('…in a highlighted row with an «unopened» dot', await has(tech, `tr.t-note.t-note-new[data-href="#/tickets/${tid}"] .t-ico-dot`));
  ok('a separate badge next to «Tickets» counts unopened notes', (await badge(tech)) === b0 + 1, `${b0} → ${await badge(tech)}`);
  await go(tech, '#/tickets?scope=notes');
  ok('the «employee notes» tab lists it, with a count', /ملاحظات الموظفين/.test(await tech.textContent('[data-scope="notes"]')) && (await has(tech, `tr[data-href="#/tickets/${tid}"]`)) && (await has(tech, '[data-scope="notes"].tab-note.has-new')));
  await go(tech, '#/dashboard');
  ok('the dashboard and board cards carry the marker too', /ملاحظة من الموظف/.test(await tech.evaluate((id) => (document.querySelector(`[href="#/tickets/${id}"], [data-href="#/tickets/${id}"]`) || {}).textContent || '', tid)));
  /* 2) داخل البلاغ */
  await go(tech, `#/tickets/${tid}`);
  const bar = (await tech.textContent('.note-bar')).replace(/\s+/g, ' ');
  ok('inside the ticket: a «new note» banner with the text and a reply button', /ملاحظة جديدة من حساب dep/.test(bar) && /جديدة/.test(bar) && /الضوء الأحمر/.test(bar) && (await has(tech, '.note-bar.is-new [data-act="replynote"]')));
  ok('…and the message itself is highlighted in the conversation', /جديدة/.test(await tech.textContent('#tlNote .tl-flag')) && /الضوء الأحمر/.test(await tech.textContent('#tlNote')));
  await tech.click('.note-bar [data-act="seenote"]'); await tech.waitForTimeout(400);
  ok('«in the conversation» jumps to it', await tech.evaluate(() => { const r = document.getElementById('tlNote').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
  await go(tech, '#/tickets?scope=mine');
  ok('after opening, the row calms down but keeps the marker until a reply', (await has(tech, `tr.t-note[data-href="#/tickets/${tid}"]`)) && !(await has(tech, `tr.t-note-new[data-href="#/tickets/${tid}"]`)) && (await badge(tech)) === b0);
  /* 3) رد الفني ثم رد الموظف */
  await go(tech, `#/tickets/${tid}`); await tech.fill('#cmt', 'سأحضر خلال ساعة ومعي حبر بديل'); await tech.click('[data-act="send"]'); await tech.waitForTimeout(800); await sync(tech);
  ok('once the technician replies, the marker leaves his list', await (async () => { await go(tech, '#/tickets?scope=mine'); return !(await has(tech, `tr.t-note[data-href="#/tickets/${tid}"]`)); })());
  await until(dep, (id) => App.DB.get('tickets', id).then((t) => t && t.noteFrom === 'staff'), tid);
  await go(dep, '#/tickets');
  const r2 = await rowTxt(dep, tid);
  ok('the employee sees «technician\'s reply» with its excerpt, highlighted', /ردّ الفني/.test(r2) && /حبر بديل/.test(r2) && (await has(dep, `tr.t-note-amber.t-note-new[data-href="#/tickets/${tid}"]`)), r2.slice(0, 120));
  await go(dep, `#/tickets/${tid}`); await dep.fill('#cmt', 'شكراً، أنا في المكتب'); await dep.click('[data-act="send"]'); await dep.waitForTimeout(800); await sync(dep);
  await until(tech, (id) => App.DB.get('tickets', id).then((t) => t && t.noteFrom === 'requester'), tid);
  await go(tech, '#/tickets?scope=mine');
  ok('…and the employee\'s answer shows to the technician as «employee replied»', /ردّ الموظف/.test(await rowTxt(tech, tid)) && (await has(tech, `tr.t-note-new[data-href="#/tickets/${tid}"]`)));
  /* 4) شاشة العرض */
  const M = await login('sup', { width: 1920, height: 1080 });
  await M.evaluate(() => { location.hash = '#/monitor'; }); await M.waitForSelector('.tv2-tr'); await M.waitForTimeout(2500);
  const icons = await M.evaluate(() => [...document.querySelectorAll('.tv2-tr:not(.tv2-th)')].map((r) => ({ cat: !!r.querySelector('.tv2-cat'), img: !!r.querySelector('.tv2-cat .cat-ic, .tv2-cat svg, .tv2-cat img'), chat: !!r.querySelector('.tv2-cat.chat') })));
  ok('the display shows a category icon on every queue row', icons.length > 0 && icons.every((x) => x.cat && (x.img || x.chat)), `${icons.length} rows`);
  ok('…a band of categories with their open counts', /الطابعات/.test(await M.textContent('[data-cats]')) && (await M.$$('.tv2-cchip')).length > 0);
  /* تقليب الصفحات كل 12 ثانية، ولا يُعاد رسم القائمة أكثر من ذلك (كان مع صفحة واحدة يُعاد كل 400 جزء من الثانية) */
  await dep.evaluate(async () => { for (let i = 0; i < 10; i++) await App.Data.tickets.create({ title: `عطل للتقليب ${i}`, description: 'x', categoryId: i % 2 ? 'network' : 'hardware', priority: 'low' }); await App.Sync.flush(); });
  for (let i = 0; i < 20 && (await M.$$('.tv2-dots i')).length < 2; i++) { await M.evaluate(() => App.Sync.pull()); await M.waitForTimeout(800); }
  await M.evaluate(() => { const x = document.getElementById('tvAlert'); if (x) x.click(); });
  const turnInfo = await M.evaluate(() => new Promise((res) => { const on0 = [...document.querySelectorAll('.tv2-dots i')].findIndex((x) => x.classList.contains('on')); let c = 0; const o = new MutationObserver(() => c++); o.observe(document.querySelector('[data-rows]'), { childList: true }); setTimeout(() => { o.disconnect(); res({ c, on0, on1: [...document.querySelectorAll('.tv2-dots i')].findIndex((x) => x.classList.contains('on')), dots: document.querySelectorAll('.tv2-dots i').length }); }, 13000); }));
  ok('pages turn on their 12-second cycle with page dots, without redrawing in between', turnInfo.dots >= 2 && turnInfo.on1 !== turnInfo.on0 && turnInfo.c >= 1 && turnInfo.c <= 3, JSON.stringify(turnInfo));
  ok('…and each row has a priority edge', await M.evaluate(() => [...document.querySelectorAll('.tv2-tr:not(.tv2-th)')].every((r) => /\bpe-/.test(r.className))));
  const tid2 = await dep.evaluate(async () => { const t = await App.Data.tickets.create({ title: 'الطابعة الملونة متوقفة', description: 'x', categoryId: 'printer', priority: 'medium' }); await App.Sync.flush(); return t.id; });
  let card = false; for (let i = 0; i < 20 && !card; i++) { await M.evaluate(() => App.Sync.pull()); await M.waitForTimeout(800); card = await has(M, '#tvAlert .tv-alert-ic.has-cat'); }
  ok('a new ticket\'s arrival card shows its category icon with a type badge', card && (await has(M, '#tvAlert .tva-badge')));
  ok('…and its category glows in the band', (await M.$$('.tv2-cchip.hot')).length >= 1);
  /* لا يبقى بلاغ مفتوح يربك الاختبارات التالية */
  await tech.evaluate(async (ids) => { await App.Sync.pull(); const extra = (await App.DB.getAll('tickets')).filter((t) => /^عطل للتقليب /.test(t.title)).map((t) => t.id); for (const id of [...ids, ...extra]) await App.Data.tickets.setStatus(id, 'cancelled').catch(() => {}); await App.Sync.flush(); }, [tid, tid2]).catch(() => {});
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
