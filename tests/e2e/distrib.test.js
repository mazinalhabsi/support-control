/* اختبار طرفي: أدوات لوحة التوزيع.
   - التوزيع من ملف (لصق من Excel): رقم عسكري + موضع بالاسم أو بالمسار، ومعاينة لكل صف (جاهز، مكرر الاسم، تقريبي،
     شخص أو موضع غير معروف، في موضعه) ثم التنفيذ في قيد واحد، وتنزيل القالب
   - التوزيع بقواعد: الحرف الأول من الاسم، ونطاق الرقم العسكري، والرتبة، بتعبئة متوازنة ومعاينة حية
   - تبديل حسابين بنقرة، وكشوف الأسماء للطباعة، وتقرير الفروع (الفارغ ومن بلا رئيس)، وسجل تنقلات الشخص
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/distrib.test.js */
const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php';
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return r.json().catch(() => ({})); };
const pull = async (tok) => { let since = 0; const out = []; for (;;) { const r = await fetch(`${B}?a=pull&since=${since}&limit=3000`, { headers: { 'X-Token': tok } }).then((x) => x.json()); out.push(...r.docs); since = r.rev; if (!r.more) return out; } };
const mkUser = (id, name, extra = {}) => { const salt = crypto.randomBytes(16), hash = crypto.pbkdf2Sync('Passw0rd!', salt, 1000, 32, 'sha256').toString('hex'); return { store: 'users', id, rev: -1, data: { id, username: id, name, role: 'department', active: 1, mustChangePassword: 0, extraPerms: [], deniedPerms: [], pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash }, createdAt: Date.now(), updatedAt: Date.now(), ...extra } }; };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
const ABC = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي', first = (n) => String(n).replace(/[أإآ]/g, 'ا').charAt(0);
(async () => {
  const T = String(Date.now() % 100000), sup = (await api('login', { username: 'sup', password: 'Passw0rd!' })).token, SH = process.env.SHOTS || '';
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const c = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} window.print = () => { window.__printed = (document.getElementById('print-root') || {}).innerHTML || ''; };
    /* Chromium بلا واجهة يحفظ الأسماء العربية باسم «download»؛ يُسجَّل الاسم الذي طلبته الصفحة */
    const click0 = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__dlname = this.download; return click0.call(this); }; });
  const S = await c.newPage(); S.on('pageerror', (e) => errs.push(e.message)); S.setDefaultTimeout(25000);
  await S.goto(BASE); await S.waitForSelector('[name="username"]'); await S.fill('[name="username"]', 'sup'); await S.fill('[name="password"]', 'Passw0rd!'); await S.keyboard.press('Enter');
  await S.waitForFunction(() => window.App && App.Auth.user); await S.waitForTimeout(1500);
  const ids = await S.evaluate(async (T) => {
    await App.Data.org.buildOutline(App.Data.org.planOutline(`الكلية ${T}\n  قسم السنة الأولى\n    فصل 1\n    فصل 2\n    فصل 3\n  قسم السنة الثانية\n    فصل 1\n    فصل 2\n    فصل 3`));
    await App.Sync.flush();
    const d = App.Data.list('departments').find((x) => x.name === `الكلية ${T}`), u = await App.DB.getAll('deptUnits'), f = (n, p) => u.find((x) => x.departmentId === d.id && x.name === n && (p === undefined || x.parentId === p)).id;
    const y1 = f('قسم السنة الأولى'), y2 = f('قسم السنة الثانية');
    return { d: d.id, y1, y2, c11: f('فصل 1', y1), c12: f('فصل 2', y1), c13: f('فصل 3', y1), c21: f('فصل 1', y2), c22: f('فصل 2', y2), c23: f('فصل 3', y2), ranks: App.Data.list('ranks').slice(0, 3).map((r) => r.id) };
  }, T);
  const names = ['أحمد', 'بدر', 'ثامر', 'جاسم', 'حمد', 'خالد', 'راشد', 'زايد', 'سالم', 'شهاب', 'صالح', 'طلال', 'عادل', 'غانم', 'فهد', 'قاسم', 'كمال', 'ماجد', 'نايف', 'هلال', 'وليد', 'يوسف', 'إبراهيم', 'تركي', 'ذياب', 'ضاحي', 'ظافر', 'لؤي', 'منصور', 'داود'];
  const uid = (i) => `ds${T}_${i}`, mil = (i) => `${T}${String(i).padStart(2, '0')}`;
  await api('push', { ops: names.map((n, i) => mkUser(uid(i), `${n} ${T}`, { departmentId: ids.d, unitId: '', militaryNo: mil(i), rankId: ids.ranks[i % 3] })) }, sup);
  for (let i = 0; i < 20 && !(await S.evaluate((id) => App.Data.c.users.has(id), uid(29))); i++) { await S.evaluate(() => App.Sync.pull()); await S.waitForTimeout(500); }
  const where = async () => { const m = new Map((await pull(sup)).filter((x) => x.store === 'users' && x.data).map((x) => [x.id, x.data])); return (i) => m.get(uid(i)) || {}; };
  const settle = async () => { await S.evaluate(() => App.Sync.flush()); await S.waitForTimeout(800); };
  const board = async (u = '') => { await S.evaluate(() => { location.hash = '#/dashboard'; }); await S.waitForTimeout(250); await S.evaluate(({ d, u }) => { location.hash = `#/org/people?d=${d}${u ? `&u=${u}` : ''}`; }, { d: ids.d, u }); await S.waitForSelector('.dp-toolbar'); await S.waitForTimeout(600); };
  const logCount = () => S.evaluate((d) => App.DB.getAll('orgLog').then((l) => l.filter((x) => (x.nodes || []).includes(d)).length), ids.d);

  /* 1) من ملف: لصق صفوف من Excel */
  await board();
  ok('the board has the tools: file, rules, branch report and rosters', !!(await S.$('[data-dpxl]')) && !!(await S.$('[data-dprules]')) && !!(await S.$('[data-dpreport]')) && !!(await S.$('[data-dprosters]')));
  await S.click('[data-dpxl]'); await S.waitForSelector('dialog [data-xlpaste]');
  const [dl] = await Promise.all([S.waitForEvent('download'), S.click('dialog [data-xltpl]')]);
  const dlName = await S.evaluate(() => window.__dlname || ''), dlHead = require('fs').readFileSync(await dl.path()).subarray(0, 2).toString();
  ok('«download template» gives an Excel file named after the place', /\.xlsx$/.test(dlName) && dlName.includes(`الكلية ${T}`) && dlHead === 'PK', dlName);
  const paste = [
    ['الرقم العسكري', 'الموضع الجديد'],
    [mil(0), 'قسم السنة الأولى / فصل 2'], // مسار كامل
    [mil(1), 'فصل 3'], // اسم مكرر في القسمين
    [mil(2), 'السنه الثانيه / فصل 1'], // مسار بلا «قسم» وبإملاء مختلف
    [mil(3), 'السنة الأولي'], // فرع بمفتاحه
    [mil(4), 'السنة الأوله'], // خطأ إملائي: تقريبي
    ['99999999', 'فصل 1'], // شخص غير معروف
    [mil(5), 'مختبر الحاسب'], // موضع غير معروف
    [mil(6), `الكلية ${T}`] // في موضعه أصلاً
  ].map((r) => r.join('\t')).join('\n');
  await S.fill('dialog [data-xlpaste]', paste); await S.click('dialog [data-xlread]'); await S.waitForSelector('dialog .dp-xlsum');
  const st = await S.evaluate(() => [...document.querySelectorAll('dialog tbody tr')].map((r) => r.textContent.replace(/\s+/g, ' ')));
  const row = (n) => st.find((x) => x.includes(mil(n))) || '';
  ok('preview: a full path is ready', /جاهز للنقل/.test(row(0)) && /قسم السنة الأولى \/ فصل 2/.test(row(0)), row(0).slice(0, 90));
  ok('preview: a name found in two sections asks for the path, with the choices', /اسم مكرر/.test(row(1)) && /قسم السنة الأولى \/ فصل 3/.test(row(1)) && /قسم السنة الثانية \/ فصل 3/.test(row(1)), row(1).slice(0, 120));
  ok('preview: a path without «قسم» and with other spelling is matched', /جاهز للنقل/.test(row(2)) && /قسم السنة الثانية \/ فصل 1/.test(row(2)), row(2).slice(0, 100));
  ok('preview: a section by its key name is matched', /جاهز للنقل/.test(row(3)) && /قسم السنة الأولى/.test(row(3)));
  ok('preview: a misspelt place is a close match to confirm (ticked)', /تقريبي/.test(row(4)) && /قسم السنة الأولى/.test(row(4)) && !!(await S.$('dialog [data-xlc]:checked')));
  ok('preview: unknown person, unknown place and already-there are flagged', st.some((x) => /99999999/.test(x) && /شخص غير معروف/.test(x)) && /موضع غير معروف/.test(row(5)) && /في موضعه/.test(row(6)));
  if (SH) await S.screenshot({ path: `${SH}/dist-file-preview.png` });
  const n0 = await logCount();
  await S.click('dialog .modal-foot .btn-primary'); await S.waitForSelector('.dp-undo'); await settle();
  let w = await where();
  ok('running it moves the ready and the ticked close rows only', w(0).unitId === ids.c12 && w(2).unitId === ids.c21 && w(3).unitId === ids.y1 && w(4).unitId === ids.y1 && !w(1).unitId && !w(5).unitId, JSON.stringify([0, 1, 2, 3, 4, 5].map((i) => w(i).unitId || '-')));
  ok('…as one entry in the structure log, with undo', (await logCount()) === n0 + 1 && /وُزّع 4 حساب/.test(await S.textContent('.dp-undo')));

  /* 2) قواعد: الحرف الأول على السنتين لغير الموزعين */
  await board();
  await S.click('[data-dprules]'); await S.waitForSelector('dialog [data-ra]');
  const ranges = await S.$$eval('dialog [data-ra]', (x) => x.map((i) => i.value));
  const adds = async () => S.$$eval('dialog [data-rn]', (x) => x.map((e) => Number(e.textContent.replace(/\D/g, ''))));
  const a0 = await adds(), here0 = 30 - 4;
  ok('the alphabet rule is pre-filled with balanced letter ranges and a live preview', ranges.length === 2 && ranges.every((r) => /^.-.$/.test(r)) && a0[0] + a0[1] === here0 && Math.abs(a0[0] - a0[1]) <= 6, `${ranges.join(' | ')} → ${a0.join('+')}`);
  await S.locator('dialog [data-ra]').nth(0).fill('ا-خ'); await S.locator('dialog [data-ra]').nth(1).fill('د-ي'); await S.waitForTimeout(400);
  const a1 = await adds(), miss = await S.textContent('dialog [data-rmiss]');
  ok('editing the ranges updates the preview', a1[0] + a1[1] === here0 && /سيُنقل 26/.test(miss), `${a1.join('+')} ${miss}`);
  if (SH) await S.screenshot({ path: `${SH}/dist-rules.png` });
  await S.click('dialog .modal-foot .btn-primary'); await S.waitForSelector('.dp-undo'); await settle();
  w = await where();
  const inY = (u, y) => [y, ...(y === ids.y1 ? [ids.c11, ids.c12, ids.c13] : [ids.c21, ids.c22, ids.c23])].includes(u);
  const alphaOk = names.every((n, i) => { if ([0, 2, 3, 4].includes(i)) return true; const k = ABC.indexOf(first(n)); return inY(w(i).unitId, k <= ABC.indexOf('خ') ? ids.y1 : ids.y2); });
  ok('everyone went to the year whose letters match the first letter of the name', alphaOk);
  /* الرقم العسكري لكل من في الكلية: من في سنته المطابقة يبقى في فصله */
  await board(); await S.click('[data-dprules]'); await S.waitForSelector('dialog [data-ra]');
  await S.check('dialog input[name="rtype"][value="mil"]', { force: true }); await S.waitForSelector('dialog [data-rm1]');
  await S.check('dialog input[name="rwho"][value="all"]', { force: true }); await S.waitForSelector('dialog [data-rm1]'); await S.waitForTimeout(300);
  await S.locator('dialog [data-rm1]').nth(0).fill(mil(0)); await S.locator('dialog [data-rm2]').nth(0).fill(mil(14)); await S.locator('dialog [data-rm1]').nth(1).fill(mil(15)); await S.locator('dialog [data-rm2]').nth(1).fill(mil(29)); await S.waitForTimeout(400);
  const mtxt = await S.textContent('dialog [data-rmiss]');
  ok('the military-number rule keeps people already inside their matching year', /يبقى \d+ في فرعه المطابق/.test(mtxt), mtxt);
  await S.click('dialog .modal-foot .btn-primary'); await S.waitForSelector('.dp-undo'); await settle();
  w = await where();
  ok('everyone is in the year of his number range, and those already in a class there kept it', names.every((n, i) => inY(w(i).unitId, i <= 14 ? ids.y1 : ids.y2)) && w(0).unitId === ids.c12 && w(2).unitId === ids.y1, JSON.stringify([w(0).unitId === ids.c12, w(2).unitId === ids.y1]));
  /* الرتبة: الرتبة الأولى للسنة الأولى، والباقي للثانية */
  await board(); await S.click('[data-dprules]'); await S.waitForSelector('dialog [data-ra]');
  await S.check('dialog input[name="rtype"][value="rank"]', { force: true }); await S.waitForSelector('dialog [data-rr]', { state: 'attached' });
  await S.check('dialog input[name="rwho"][value="all"]', { force: true }); await S.waitForSelector('dialog [data-rr]', { state: 'attached' }); await S.waitForTimeout(300);
  await S.evaluate(({ y1, y2, r }) => { document.querySelectorAll('dialog [data-rr]').forEach((i) => { i.checked = i.dataset.rr === y1 ? i.value === r[0] : i.value !== r[0]; }); document.querySelector('dialog [data-rr]').dispatchEvent(new Event('change', { bubbles: true })); }, { y1: ids.y1, y2: ids.y2, r: ids.ranks });
  await S.waitForTimeout(300);
  await S.click('dialog .modal-foot .btn-primary'); await S.waitForSelector('.dp-undo'); await settle();
  w = await where();
  ok('the rank rule puts each rank in its chosen year', names.every((n, i) => inY(w(i).unitId, i % 3 === 0 ? ids.y1 : ids.y2)));

  /* 3) تبديل حسابين بنقرة */
  await board(); await S.check('input[name="dpview"][value="all"]', { force: true }); await S.waitForTimeout(600);
  const pa = w(0).unitId, pb = w(1).unitId;
  await S.check(`[data-pick="${uid(0)}"]`, { force: true }); await S.waitForTimeout(300); await S.check(`[data-pick="${uid(1)}"]`, { force: true }); await S.waitForTimeout(400);
  ok('selecting two accounts in different places offers «swap their places»', !!(await S.$('[data-dpswap]:not([disabled])')));
  await S.click('[data-dpswap]'); await S.waitForSelector('.dp-undo'); await settle();
  w = await where();
  ok('one click swaps them', w(0).unitId === pb && w(1).unitId === pa && /بُدّل/.test(await S.textContent('.dp-undo')));

  /* 4) التقرير والكشوف */
  await S.click('[data-dpreport]'); await S.waitForSelector('dialog [data-rf]');
  const cnt = async (k) => Number((await S.textContent(`dialog [data-rf="${k}"] .count`)).replace(/\D/g, ''));
  ok('the branch report lists the 8 branches and counts the empty ones and those without a head', (await cnt('all')) === 8 && (await cnt('empty')) >= 4 && (await cnt('nohead')) === 8, `${await cnt('all')} / empty ${await cnt('empty')} / nohead ${await cnt('nohead')}`);
  await S.click('dialog [data-rf="empty"]'); await S.waitForTimeout(300);
  ok('filtering shows only the empty branches', (await S.$$('dialog [data-rtable] tbody tr')).length === (await cnt('empty')));
  if (SH) await S.screenshot({ path: `${SH}/dist-report.png` });
  await S.click('dialog .modal-foot .btn-primary'); await S.waitForTimeout(400);
  ok('it prints', /تقرير فروع/.test(await S.evaluate(() => window.__printed || '')));
  await S.keyboard.press('Escape'); await S.waitForTimeout(300);
  await S.evaluate(() => { window.__printed = ''; }); await S.click(`[data-dproster="${ids.y1}"]`); await S.waitForTimeout(500);
  const p1 = await S.evaluate(() => window.__printed || '');
  const inY1 = names.filter((n, i) => inY(w(i).unitId, ids.y1)).length, rows1 = (p1.match(/<tr>/g) || []).length - 1;
  ok('a section card prints its roster with everyone in it and their class', /كشف أسماء «قسم السنة الأولى»/.test(p1) && rows1 === inY1 && /فصل 2/.test(p1), `${rows1} rows, expected ${inY1}`);
  await S.evaluate(() => { window.__printed = ''; }); await S.click('[data-dprosters]'); await S.waitForTimeout(500);
  const p2 = await S.evaluate(() => window.__printed || '');
  ok('«rosters of all branches» prints one page per section', (p2.match(/class="dp-pb"/g) || []).length === 2 && /قسم السنة الثانية/.test(p2));

  /* 5) سجل التنقلات: نقلٌ من نموذج الحساب يُسجَّل أيضاً */
  await S.evaluate(async ({ id, to }) => { const u = await App.DB.get('users', id); await App.Data.users.save({ ...u, unitId: to }, ''); await App.Sync.flush(); }, { id: uid(3), to: ids.c22 }); await S.waitForTimeout(600);
  await board(); await S.check('input[name="dpview"][value="all"]', { force: true }); await S.waitForTimeout(500);
  await S.click(`[data-dphist="${uid(3)}"]`); await S.waitForSelector('dialog .dp-hist');
  const h3 = await S.$$eval('dialog .dp-hist li', (x) => x.map((li) => li.textContent.replace(/\s+/g, ' ')));
  ok('a move made from the account form shows in the history too', /من نموذج الحساب/.test(h3[0] || '') && /قسم السنة الثانية \/ فصل 2/.test(h3[0] || ''), (h3[0] || '').slice(0, 90));
  await S.keyboard.press('Escape'); await S.waitForTimeout(300);
  await S.click(`[data-dphist="${uid(0)}"]`); await S.waitForSelector('dialog .dp-hist, dialog .dp-hnow');
  const hist = await S.$$eval('dialog .dp-hist li', (x) => x.map((li) => li.textContent.replace(/\s+/g, ' ')));
  /* أحمد نُقل مرتين: من الملف ثم بالتبديل؛ القواعد أبقته في فصله لأنه داخل فرعه المطابق */
  ok('a person\'s movement history lists each move, newest first, with who did it', hist.length === 2 && /تبديل/.test(hist[0]) && hist.every((x) => /بواسطة/.test(x)) && /فصل 2/.test(hist[hist.length - 1]), `${hist.length}: ${hist[0] && hist[0].slice(0, 80)}`);
  if (SH) await S.screenshot({ path: `${SH}/dist-history.png` });
  await S.keyboard.press('Escape');
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
