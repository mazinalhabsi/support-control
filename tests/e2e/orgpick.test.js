/* اختبار طرفي: اختيار الموضع شجرةً، وتحديد الكل، ووسم الفروع بألوانها، وثبات القائمة عند التحديد.
   - لوحة التوزيع، «كل من فيه مع فروعه»: بجانب كل اسم فرعه بلونه (لون بطاقة الفرع نفسه، ومختلف بين الفروع)، و«غير موزع» لمن لم يُوزَّع
   - التحديد في أسفل القائمة لا يعيدها إلى أولها (في اللوحة وفي نافذة حسابات الموضع)
   - «تحديد الكل» يحدد كل من في القائمة بعد البحث
   - الموضع الجديد: تظهر الإدارات الرئيسية فقط، والسهم يفتح فروعها، والبحث يعرض المسارات، والاختيار ينقل المحددين
   - مكان الجهاز في استلام الصيانة: الفني يرى كل المواضع
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/orgpick.test.js */
const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php';
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return r.json().catch(() => ({})); };
const pull = async (tok) => { let since = 0; const out = []; for (;;) { const r = await fetch(`${B}?a=pull&since=${since}&limit=3000`, { headers: { 'X-Token': tok } }).then((x) => x.json()); out.push(...r.docs); since = r.rev; if (!r.more) return out; } };
const mkUser = (id, name, extra = {}) => { const salt = crypto.randomBytes(16), hash = crypto.pbkdf2Sync('Passw0rd!', salt, 1000, 32, 'sha256').toString('hex'); return { store: 'users', id, rev: -1, data: { id, username: id, name, role: 'department', active: 1, mustChangePassword: 0, extraPerms: [], deniedPerms: [], pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash }, createdAt: Date.now(), updatedAt: Date.now(), ...extra } }; };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
(async () => {
  const T = String(Date.now() % 100000), SH = process.env.SHOTS || '', sup = (await api('login', { username: 'sup', password: 'Passw0rd!' })).token;
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const open = async (u) => {
    const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} });
    const p = await c.newPage(); p.on('pageerror', (e) => errs.push(`${u}: ${e.message}`)); p.setDefaultTimeout(25000);
    await p.goto(BASE); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', u); await p.fill('[name="password"]', 'Passw0rd!'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.App && App.Auth.user); await p.waitForTimeout(1500); return p;
  };
  const S = await open('sup');
  /* الكلية: خمسة أقسام، وفي الثاني شعبة؛ وإدارة أخرى تُنقل إليها حسابات */
  const ids = await S.evaluate(async (T) => {
    await App.Data.org.buildOutline(App.Data.org.planOutline(`كلية الاختيار ${T}\n  قسم الأول\n  قسم الثاني\n    شعبة المختبر\n  قسم الثالث\n  قسم الرابع\n  قسم الخامس\nإدارة الوجهة ${T}\n  قسم الاستقبال\n    مكتب الوصول`));
    await App.Sync.flush();
    const deps = App.Data.list('departments'), d = deps.find((x) => x.name === `كلية الاختيار ${T}`), o = deps.find((x) => x.name === `إدارة الوجهة ${T}`), u = await App.DB.getAll('deptUnits'), f = (dep, n) => u.find((x) => x.departmentId === dep && x.name === n).id;
    return { d: d.id, o: o.id, s1: f(d.id, 'قسم الأول'), s2: f(d.id, 'قسم الثاني'), lab: f(d.id, 'شعبة المختبر'), s3: f(d.id, 'قسم الثالث'), rec: f(o.id, 'قسم الاستقبال'), arr: f(o.id, 'مكتب الوصول') };
  }, T);
  const uid = (i) => `op${T}_${i}`;
  /* خمسون: 15 في القسم الأول، و5 في شعبة المختبر، والبقية غير موزعين */
  await api('push', { ops: Array.from({ length: 50 }, (_, i) => mkUser(uid(i), `فرد ${T}-${String(i + 1).padStart(2, '0')}`, { departmentId: ids.d, unitId: i < 15 ? ids.s1 : i < 20 ? ids.lab : '', militaryNo: `${T}${i}` })) }, sup);
  for (let i = 0; i < 30 && !(await S.evaluate((id) => App.Data.c.users.has(id), uid(49))); i++) { await S.evaluate(() => App.Sync.pull()); await S.waitForTimeout(500); }
  const board = async (u = '') => { await S.evaluate(() => { location.hash = '#/dashboard'; }); await S.waitForTimeout(250); await S.evaluate(({ d, u }) => { location.hash = `#/org/people?d=${d}${u ? `&u=${u}` : ''}`; }, { d: ids.d, u }); await S.waitForSelector('.dp-toolbar'); await S.waitForTimeout(600); };

  /* 1) الوسوم والألوان */
  await board(); await S.check('input[name="dpview"][value="all"]', { force: true }); await S.waitForTimeout(700);
  const tags = await S.evaluate(() => [...document.querySelectorAll('.dp-row')].map((r) => { const t = r.querySelector('.dp-tag'); return { id: r.dataset.dpuser, text: t ? t.textContent.replace(/\s+/g, ' ').trim() : '', none: !!(t && t.classList.contains('none')), bc: t ? getComputedStyle(t).getPropertyValue('--bc').trim() : '' }; }));
  const tg = (i) => tags.find((x) => x.id === uid(i)) || {};
  const card = (u) => S.evaluate((u) => { const c = document.querySelector(`.dp-card[data-dpto$="|${u}"]`); return c ? getComputedStyle(c).getPropertyValue('--bc').trim() : ''; }, u);
  ok('in «everyone with its branches», those in a section carry its name next to them', /قسم الأول/.test(tg(0).text) && /قسم الثاني/.test(tg(16).text) && /شعبة المختبر/.test(tg(16).text), `${tg(0).text} | ${tg(16).text}`);
  ok('…and those not yet distributed are marked «غير موزع»', tg(30).none && /غير موزع/.test(tg(30).text) && tags.filter((x) => x.none).length === 30);
  ok('each section has its own colour, the same as its card', tg(0).bc && tg(0).bc === tg(1).bc && tg(0).bc !== tg(16).bc && tg(0).bc === (await card(ids.s1)) && tg(16).bc === (await card(ids.s2)), `${tg(0).bc} / ${tg(16).bc}`);
  const allColors = await S.evaluate(() => [...document.querySelectorAll('.dp-card')].map((c) => getComputedStyle(c).getPropertyValue('--bc').trim()));
  ok('all five section cards have different colours', new Set(allColors).size === 5, allColors.join(' '));
  if (SH) await S.screenshot({ path: `${SH}/board-tags.png` });

  /* 2) التحديد في أسفل القائمة لا يعيدها إلى أولها */
  await S.check('input[name="dpview"][value="here"]', { force: true }); await S.waitForTimeout(700);
  await S.evaluate(() => { const l = document.querySelector('.dp-list'); l.scrollIntoView({ block: 'end' }); l.scrollTop = l.scrollHeight - l.clientHeight - 80; }); await S.waitForTimeout(300);
  const before = await S.evaluate(() => document.querySelector('.dp-list').scrollTop);
  const bp = await S.evaluate(() => { const l = document.querySelector('.dp-list'), lr = l.getBoundingClientRect(), row = [...l.querySelectorAll('.dp-row')].reverse().find((r) => { const b = r.getBoundingClientRect(); return b.bottom < Math.min(lr.bottom, innerHeight) - 4 && b.top > Math.max(lr.top, 0); }), b = row.querySelector('b').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await S.mouse.click(bp.x, bp.y); await S.waitForTimeout(700);
  const after = await S.evaluate(() => document.querySelector('.dp-list').scrollTop);
  ok('ticking a name at the bottom keeps the list where it was', before > 100 && Math.abs(after - before) < 5, `${before} → ${after}`);
  const bp2 = await S.evaluate(() => { const l = document.querySelector('.dp-list'), lr = l.getBoundingClientRect(), rows = [...l.querySelectorAll('.dp-row:not(.on)')].filter((r) => { const b = r.getBoundingClientRect(); return b.bottom < Math.min(lr.bottom, innerHeight) - 4 && b.top > Math.max(lr.top, 0); }), b = rows[rows.length - 1].querySelector('b').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await S.mouse.click(bp2.x, bp2.y); await S.waitForTimeout(700);
  ok('…also for the next one', Math.abs((await S.evaluate(() => document.querySelector('.dp-list').scrollTop)) - before) < 5 && /المحدد: 2/.test(await S.textContent('.dp-cnt')));
  await S.click('[data-dpnone]'); await S.waitForTimeout(500);

  /* 3) تحديد الكل */
  await S.check('input[name="dpview"][value="all"]', { force: true }); await S.waitForTimeout(700);
  ok('«select all» says how many it will take', /تحديد الكل \(50\)/.test(await S.textContent('[data-dpall]')));
  await S.fill('[data-dpq]', `${T}-0`); await S.waitForTimeout(800); await S.click('[data-dpall]'); await S.waitForTimeout(500);
  ok('…and takes everyone in the filtered list', /المحدد: 9/.test(await S.textContent('.dp-cnt')), await S.textContent('.dp-cnt'));

  /* 4) الموضع الجديد شجرةً */
  await S.click('.dp-other summary'); await S.waitForTimeout(300);
  await S.click('.dp-other [data-ppopen]'); await S.waitForSelector('.pp-pop');
  const top = await S.evaluate(() => ({ rows: document.querySelectorAll('.pp-pop .pp-row').length, tops: document.querySelectorAll('.pp-pop .pp-row.top').length, deps: App.Data.list('departments').length, names: [...document.querySelectorAll('.pp-pop .pp-row.top .pp-name .grow')].map((x) => x.textContent) }));
  ok('choosing a new place shows the main departments only', top.rows === top.tops && top.tops === top.deps && top.names.includes(`إدارة الوجهة ${T}`), JSON.stringify({ rows: top.rows, tops: top.tops, deps: top.deps }));
  if (SH) await S.screenshot({ path: `${SH}/picker-top.png` });
  /* الضغط على اسم الإدارة يفتح فروعها، وأولها «الإدارة نفسها» */
  await S.click(`.pp-pop .pp-name[data-ppx="d:${ids.o}"]`); await S.waitForTimeout(250);
  ok('clicking a department opens its sections, with «the department itself» first', (await S.$$('.pp-pop .pp-row:not(.self)')).length === top.tops + 1 && /قسم الاستقبال/.test(await S.textContent('.pp-pop')) && !!(await S.$(`.pp-pop .pp-self[data-ppv="${ids.o}|"]`)) && !!(await S.$('.pp-pop')));
  await S.click(`.pp-pop .pp-x[data-ppx="u:${ids.rec}"]`); await S.waitForTimeout(250);
  ok('…and a section\'s arrow (or name) opens what is under it', /مكتب الوصول/.test(await S.textContent('.pp-pop')));
  if (SH) await S.screenshot({ path: `${SH}/picker-open.png` });
  await S.click(`.pp-pop [data-ppv="${ids.o}|${ids.arr}"]`); await S.waitForTimeout(300);
  ok('choosing closes the list and shows the full path', !(await S.$('.pp-pop')) && /إدارة الوجهة .* \/ قسم الاستقبال \/ مكتب الوصول/.test(await S.textContent('.dp-other .pp-lbl')) && (await S.$eval('.dp-other [data-dpplace]', (x) => x.value)) === `${ids.o}|${ids.arr}`);
  await S.click('[data-dpplacego]'); await S.waitForSelector('.dp-undo'); await S.evaluate(() => App.Sync.flush()); await S.waitForTimeout(900);
  const srv = new Map((await pull(sup)).filter((x) => x.store === 'users' && x.data).map((x) => [x.id, x.data]));
  const moved = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => srv.get(uid(i))).filter((u) => u && u.departmentId === ids.o && u.unitId === ids.arr).length;
  ok('…and «move» takes all nine there, on the server', moved === 9, `${moved}`);
  /* البحث */
  await S.fill('[data-dpq]', ''); await S.waitForTimeout(600); await S.click('.dp-other summary').catch(() => {}); await S.waitForTimeout(200);
  if (!(await S.$('.dp-other[open]'))) await S.click('.dp-other summary'); await S.click('.dp-other [data-ppopen]'); await S.waitForSelector('.pp-pop');
  await S.fill('.pp-pop .pp-q', 'المختبر'); await S.waitForTimeout(300);
  const hits = await S.$$eval('.pp-pop .pp-hit', (x) => x.map((h) => h.textContent.replace(/\s+/g, ' ').trim()));
  ok('searching shows matching places with their paths', hits.some((h) => h.includes(`كلية الاختيار ${T} / قسم الثاني / شعبة المختبر`)), hits.slice(0, 3).join(' | '));
  await S.keyboard.press('Escape'); await S.waitForTimeout(200);
  ok('Esc closes the list', !(await S.$('.pp-pop')));

  /* 5) نافذة حسابات الموضع: تحديد الكل والنقل بالشجرة وثبات القائمة */
  await S.evaluate(() => { location.hash = '#/org'; }); await S.waitForTimeout(400);
  const dlgOpen = await S.evaluate(async (d) => { App.Pages.orgMembers({ departmentId: d }); return true; }, ids.d);
  await S.waitForSelector('dialog [data-list] .list-row');
  const listTop = async () => S.evaluate(() => document.querySelector('dialog [data-list]').scrollTop);
  /* نقرة كما يفعلها المستخدم على اسم ظاهر قرب أسفل القائمة (لا تمرير آلي قبلها) */
  await S.evaluate(() => { const l = document.querySelector('dialog [data-list]'); l.scrollTop = l.scrollHeight - l.clientHeight - 80; }); await S.waitForTimeout(200); const b0 = await listTop();
  const pt = await S.evaluate(() => { const l = document.querySelector('dialog [data-list]'), lr = l.getBoundingClientRect(), row = [...l.querySelectorAll('.pick-row')].reverse().find((r) => { const b = r.getBoundingClientRect(); return b.bottom < lr.bottom - 4 && b.top > lr.top; }), b = row.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, id: row.querySelector('[data-pick]').dataset.pick }; });
  await S.mouse.click(pt.x, pt.y); await S.waitForTimeout(400);
  ok('in a place\'s accounts window, clicking a name low in the list ticks it and keeps the list there', dlgOpen && b0 > 100 && Math.abs((await listTop()) - b0) < 5 && (await S.$eval(`dialog [data-pick="${pt.id}"]`, (x) => x.checked)), `${b0} → ${await listTop()}`);
  await S.click('dialog [data-mall]'); await S.waitForTimeout(300);
  ok('«select all» there takes everyone in the place', /المحدد: 41 من 41/.test(await S.textContent('dialog [data-cnt]')), await S.textContent('dialog [data-cnt]'));
  await S.click('dialog [data-mnone]'); await S.waitForTimeout(200);
  await S.fill('dialog [data-q]', `${T}-2`); await S.waitForTimeout(400); await S.click('dialog [data-mall]'); await S.waitForTimeout(300);
  await S.click('dialog [data-ppopen]'); await S.waitForSelector('.pp-pop');
  ok('the picker opens inside the window, departments only', (await S.$$('dialog .pp-pop .pp-row.top')).length === (await S.$$('dialog .pp-pop .pp-row')).length);
  /* «قسم الاستقبال» له فرع: الضغط عليه يفتحه، ثم «القسم نفسه» */
  await S.click(`dialog .pp-pop .pp-name[data-ppx="d:${ids.o}"]`); await S.waitForTimeout(200); await S.click(`dialog .pp-pop .pp-name[data-ppx="u:${ids.rec}"]`); await S.waitForTimeout(200);
  ok('a section with branches under it is chosen through its «itself» line', !!(await S.$(`dialog .pp-pop .pp-self[data-ppv="${ids.o}|${ids.rec}"]`)));
  await S.click(`dialog .pp-pop .pp-self[data-ppv="${ids.o}|${ids.rec}"]`); await S.waitForTimeout(200);
  await S.click('dialog [data-move]'); await S.waitForTimeout(1200); await S.evaluate(() => App.Sync.flush()); await S.waitForTimeout(900);
  const srv2 = new Map((await pull(sup)).filter((x) => x.store === 'users' && x.data).map((x) => [x.id, x.data]));
  const n2 = Array.from({ length: 50 }, (_, i) => srv2.get(uid(i))).filter((u) => u && u.unitId === ids.rec).length;
  ok('…and moves all the selected there at once', n2 === 10, `${n2}`);
  await S.keyboard.press('Escape');

  /* 6) مكان الجهاز في استلام الصيانة: الفني يرى المواضع */
  const TQ = await open('tech');
  await TQ.evaluate(() => { location.hash = '#/maintenance'; }); await TQ.waitForSelector('#mdsn'); await TQ.fill('#mdsn', `NOPE-${T}`); await TQ.click('[data-mdfind] button[type="submit"]'); await TQ.waitForSelector('[data-mdin=""]');
  await TQ.click('[data-mdin=""]'); await TQ.waitForSelector('dialog [data-ppopen]'); await TQ.click('dialog [data-ppopen]'); await TQ.waitForSelector('.pp-pop');
  ok('a technician without org rights still sees every place for an unregistered device', (await TQ.$$('.pp-pop .pp-row.top')).length >= 2 && /غير محدد/.test(await TQ.textContent('.pp-pop')));
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
