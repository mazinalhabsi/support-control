/* اختبار طرفي: أصوات الإشعارات لكل مستخدم، وأصوات شاشة العرض.
   كل صوت يُشغَّل يُسجَّل في App.Snd.played (الحدث والنغمة والمستوى)، فيُتحقق منه دون سماعه.
   المتصفح يُشغَّل بسياسة «لا صوت قبل أول نقرة» كما هو افتراضياً على شاشة لم يلمسها أحد.
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/sounds.test.js */
const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php', U = BASE;
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
(async () => {
  const sup = (await api('login', { username: 'sup', password: 'Passw0rd!' })).j.token;
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--autoplay-policy=user-gesture-required'] });
  const errs = [];
  const newPage = async () => {
    const c = await b.newContext({ viewport: { width: 1400, height: 900 } });
    await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} });
    const p = await c.newPage(); p.setDefaultTimeout(20000);
    p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
    return p;
  };
  const login = async (p, u) => { await p.goto(U); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', u); await p.fill('[name="password"]', 'Passw0rd!'); await p.keyboard.press('Enter'); await p.waitForFunction(() => window.App && App.Auth.user, null, { timeout: 20000 }); await p.waitForTimeout(1500); };
  const plays = (p) => p.evaluate(() => App.Snd.played.map((x) => x.ev + '/' + x.style + '/' + x.vol));
  const waitPlay = async (p, n0, ms = 40000) => { try { await p.waitForFunction((n) => App.Snd.played.length > n, n0, { timeout: ms }); } catch (_) { /* لا صوت */ } return p.evaluate(() => App.Snd.played.slice(-1)[0] || null); };
  const note = (p, n) => p.evaluate(async (n) => { const me = App.Auth.user.id; for (const x of n) await App.DB.put('notifications', { id: 'nt_snd' + Math.random().toString(36).slice(2), userId: me, at: Date.now(), read: 0, link: '', body: '', ...x }); await App.Data.notes.remove([]); }, n);
  const created = [];
  const newTicket = (p, o) => p.evaluate(async (o) => { const t = await App.Data.tickets.create({ description: 'اختبار الأصوات', ...o }); return t.id; }, o).then((id) => { created.push(id); return id; });

  /* 1) الإعداد العام: أصوات الإشعارات مفعّلة لكل المستخدمين */
  const S = await newPage(); await login(S, 'sup');
  await S.evaluate(async () => { await App.Data.saveSettings({ sounds: { on: 1, style: 'chime', vol: 70, tv: { on: 1, ticket: 1, urgent: 1, chat: 1, late: 1, service: 1, ann: 1, done: 0, remind: 5, speak: 0, vol: 85, style: 'bell' } } }); ['sq_sound', 'sq_sstyle', 'sq_svol', 'sq_uisound'].forEach((k) => localStorage.removeItem(k)); });
  const pref = await S.evaluate(() => App.Snd.pref());
  ok('notification sounds on by default (no choice on this device)', pref.on === true && pref.style === 'chime' && pref.vol === 70 && pref.ui === false, JSON.stringify(pref));
  await S.evaluate(async () => { await App.Data.notes.readAll(); }); await S.waitForTimeout(800);

  /* 2) نغمة كل إشعار حسب نوعه */
  let n0 = (await plays(S)).length;
  await note(S, [{ title: 'بلاغ جديد IT-1', kind: 'ticket', tone: 'ticket' }]);
  let last = await waitPlay(S, n0, 5000);
  ok('new ticket notification plays the ticket tone', last && last.ev === 'ticket' && last.style === 'chime' && last.vol === 70, JSON.stringify(last));
  await S.waitForTimeout(1700); n0 = (await plays(S)).length;
  await note(S, [{ title: 'تنبيه تأخر: بلاغان تجاوزا موعدهما', kind: 'ticket' }]);
  last = await waitPlay(S, n0, 5000);
  ok('late warning (no tone field) recognised from its title', last && last.ev === 'warn', JSON.stringify(last));
  await S.waitForTimeout(1700); n0 = (await plays(S)).length;
  await note(S, [{ title: 'إعلان: صيانة', kind: 'system' }, { title: 'بلاغ جديد IT-2', kind: 'ticket', tone: 'urgent' }]);
  await S.waitForTimeout(2500);
  const burst = (await plays(S)).slice(n0);
  ok('several at once: one sound, the most important (urgent)', burst.length === 1 && /^urgent\//.test(burst[0]), JSON.stringify(burst));

  /* 3) الملف الشخصي: لوحة الأصوات لهذا الجهاز */
  await S.evaluate(() => { location.hash = '#/profile'; }); await S.waitForSelector('.snd-panel'); await S.waitForTimeout(500);
  ok('profile has a sounds panel; old switch removed from appearance', await S.evaluate(() => !!document.querySelector('.snd-panel [name="snd_on"]') && !document.querySelector('input[name="sound"]')));
  n0 = (await plays(S)).length;
  await S.click('.snd-panel [data-sndtest="urgent"]'); last = await waitPlay(S, n0, 3000);
  ok('test buttons play each tone', last && last.ev === 'urgent', JSON.stringify(last));
  await S.click('.snd-panel .seg label:has(input[value="bell"])'); await S.waitForTimeout(300);
  await S.evaluate(() => { const r = document.querySelector('[name="snd_vol"]'); r.value = '30'; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); }); await S.waitForTimeout(300);
  n0 = (await plays(S)).length; await S.click('.snd-panel [data-sndtest="ticket"]'); last = await waitPlay(S, n0, 3000);
  ok('tone and volume chosen for this device', last && last.style === 'bell' && last.vol === 30, JSON.stringify(last));
  await S.click('.snd-panel [name="snd_on"] + i'); await S.waitForTimeout(400);
  n0 = (await plays(S)).length; await note(S, [{ title: 'بلاغ جديد IT-3', kind: 'ticket', tone: 'ticket' }]); await S.waitForTimeout(2500);
  ok('switching alerts off on this device silences notifications', (await plays(S)).length === n0 && (await S.evaluate(() => localStorage.getItem('sq_sound'))) === 'off');
  await S.click('.snd-panel [data-snd="reset"]'); await S.waitForTimeout(400);
  ok('back to system setting clears this device\'s choices', await S.evaluate(() => App.Snd.pref().on === true && !localStorage.getItem('sq_sound') && !localStorage.getItem('sq_svol')));
  await S.evaluate(async () => { await App.Data.notes.readAll(); });

  /* 4) الإعدادات ← الأصوات والتنبيهات */
  await S.evaluate(() => { location.hash = '#/settings?s=sounds'; }); await S.waitForSelector('[data-act="sndsave"]'); await S.waitForTimeout(500);
  const cc = await S.evaluate(() => ({ evs: document.querySelectorAll('[data-ev]').length, remind: document.querySelector('[name="tv_remind"]').value, voiceHint: (document.querySelector('[name="tv_speak"]').closest('div').querySelector('.hint') || {}).textContent || '' }));
  ok('settings page lists display events and reminder', cc.evs === 7 && cc.remind === '5', JSON.stringify(cc));
  await S.click('.seg label:has(input[name="u_style"][value="marimba"])'); await S.click('[data-act="sndsave"]'); await S.waitForTimeout(1200);
  ok('system tone saved for all users', await S.evaluate(() => App.Data.c.settings.sounds.style === 'marimba' && App.Snd.pref().style === 'marimba'));
  n0 = (await plays(S)).length; await S.click('[data-t="tv:urgent"]'); last = await waitPlay(S, n0, 3000);
  ok('display test button uses the display tone and volume', last && last.ev === 'urgent' && last.style === 'bell' && last.vol === 85, JSON.stringify(last));

  /* 5) التبويب في الخلفية: يصل الإشعار وصوته دون الرجوع إليه */
  const D = await newPage(); await login(D, 'dep');
  await S.evaluate(() => { location.hash = '#/dashboard'; }); await S.waitForTimeout(800);
  await S.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  n0 = (await plays(S)).length;
  await newTicket(D, { title: 'اختبار صوت الخلفية — الطابعة لا تطبع', categoryId: 'printer', priority: 'medium' });
  last = await waitPlay(S, n0, 60000);
  ok('hidden tab still receives the new ticket and plays its tone', last && last.ev === 'ticket' && last.style === 'marimba', JSON.stringify(last));
  await S.evaluate(() => { delete document.hidden; delete document.visibilityState; });

  /* 6) شاشة العرض */
  const salt = crypto.randomBytes(16), h = crypto.pbkdf2Sync('Passw0rd!', salt, 1000, 32, 'sha256').toString('hex');
  await api('push', { ops: [{ store: 'users', id: 'u_mon_snd', rev: -1, data: { id: 'u_mon_snd', username: 'mon_snd', name: 'شاشة الأصوات', role: 'monitor', active: 1, mustChangePassword: 0, monitor: { categories: [], locations: [], sound: 1 }, pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash: h }, createdAt: Date.now(), updatedAt: Date.now() } }] }, sup);
  const M0 = await newPage(); await login(M0, 'mon_snd'); await M0.waitForSelector('.tv2'); await M0.waitForTimeout(1000);
  /* تشغيل جديد لجهاز الشاشة دون أي لمس: تبويب جديد بالجلسة المحفوظة (إعادة تحميل التبويب نفسه تُبقي إذن الصوت السابق) */
  const M = await M0.context().newPage(); M.setDefaultTimeout(20000);
  M.on('pageerror', (e) => errs.push(e.message)); M.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await M0.close(); await M.goto(U); await M.waitForSelector('.tv2'); await M.waitForTimeout(2500);
  /* Chrome على Windows يُبقي الصوت موقوفاً (suspended) حتى أول نقرة. Chromium في بيئة الاختبار لا يفعل ذلك،
     فتُحاكى الحالة نفسها بإيقاف سياق الصوت، وهي ما يبني عليه النظام قرار إظهار زر التفعيل */
  await M.evaluate(() => App.Snd.ctx().suspend()); await M.waitForTimeout(1200);
  const unlock = await M.evaluate(() => ({ state: App.Snd.state(), banner: !!document.getElementById('tvUnmute'), on: App.TvSound.enabled() }));
  ok('display sound is on by default for the display account', unlock.on === true, JSON.stringify(unlock));
  ok('after a restart nobody touched: "tap to enable sound" is shown', unlock.state === 'suspended' && unlock.banner, JSON.stringify(unlock));
  await M.click('#tvUnmute'); await M.waitForTimeout(800);
  const after = await M.evaluate(() => ({ state: App.Snd.state(), banner: !!document.getElementById('tvUnmute') }));
  ok('one tap enables sound and hides the button', after.state === 'running' && !after.banner, JSON.stringify(after));
  n0 = (await plays(M)).length;
  await newTicket(D, { title: 'اختبار شاشة: انقطاع الشبكة في المبنى', categoryId: 'hardware', priority: 'urgent' });
  last = await waitPlay(M, n0, 45000);
  ok('urgent ticket: alarm tone on the display', last && last.ev === 'urgent' && last.style === 'bell' && last.vol === 85, JSON.stringify(last));
  await M.waitForTimeout(2000); n0 = (await plays(M)).length;
  await newTicket(D, { title: 'اختبار شاشة: لوحة مفاتيح لا تعمل', categoryId: 'hardware', priority: 'medium' });
  last = await waitPlay(M, n0, 45000);
  ok('normal ticket: new-ticket tone on the display', last && last.ev === 'ticket', JSON.stringify(last));

  /* نطاق الشاشة: فئة الطابعات فقط */
  await api('push', { ops: [{ store: 'users', id: 'u_mon_snd', rev: -1, data: { id: 'u_mon_snd', username: 'mon_snd', name: 'شاشة الأصوات', role: 'monitor', active: 1, mustChangePassword: 0, monitor: { categories: ['printer'], locations: [], sound: 1 }, pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash: h }, createdAt: Date.now(), updatedAt: Date.now() } }] }, sup);
  await M.reload(); await M.waitForSelector('.tv2'); await M.waitForTimeout(1500); await M.mouse.click(700, 450); await M.waitForTimeout(2500);
  const scope = await M.evaluate(() => ({ label: (document.querySelector('.tv2-scope') || {}).textContent || '', rows: [...document.querySelectorAll('.tv2-subj b')].map((x) => x.textContent) }));
  ok('display shows only its categories, with the scope in the header', /الطابعات/.test(scope.label) && !scope.rows.some((t) => /اختبار شاشة/.test(t)), JSON.stringify(scope).slice(0, 200));
  n0 = (await plays(M)).length;
  await newTicket(D, { title: 'اختبار نطاق: جهاز خارج النطاق', categoryId: 'hardware', priority: 'urgent' });
  await M.waitForTimeout(16000);
  ok('ticket outside the display\'s categories makes no sound', (await plays(M)).length === n0, JSON.stringify((await plays(M)).slice(n0)));
  await newTicket(D, { title: 'اختبار نطاق: طابعة الإدارة متوقفة', categoryId: 'printer', priority: 'high' });
  last = await waitPlay(M, n0, 45000);
  ok('ticket inside the display\'s categories sounds', last && last.ev === 'ticket', JSON.stringify(last));

  /* كتم الشاشة من زر الجرس */
  await M.click('[data-act="sound"]'); await M.waitForTimeout(600); n0 = (await plays(M)).length;
  await newTicket(D, { title: 'اختبار كتم: طابعة لا تسحب الورق', categoryId: 'printer', priority: 'medium' });
  await M.waitForTimeout(20000);
  ok('bell button mutes this display', (await plays(M)).length === n0 && (await M.evaluate(() => localStorage.getItem('sq_tv_sound'))) === '0');
  await M.click('[data-act="sound"]'); await M.waitForTimeout(600);

  /* تذكير بالبلاغات غير المستلمة (كل 5 دقائق في الإعداد؛ يُقدَّم موعده هنا).
     بلاغ جديد عمره 10 دقائق لم يستلمه أحد، حتى لا يعتمد الاختبار على بيانات قديمة في القاعدة */
  { const id = 't_snd_old_' + Date.now(), t0 = Date.now() - 10 * 60000; created.push(id);
    await api('push', { ops: [{ store: 'tickets', id, rev: -1, data: { id, number: 'IT-SND-' + (Date.now() % 100000), title: 'بلاغ ينتظر الاستلام', description: 'اختبار التذكير', categoryId: 'printer', priority: 'medium', status: 'new', requesterId: 'u_dep', departmentId: 'dep_1', createdAt: t0, updatedAt: t0, dueAt: Date.now() + 86400000 } }] }, sup); }
  await api('push', { ops: [{ store: 'users', id: 'u_mon_snd', rev: -1, data: { id: 'u_mon_snd', username: 'mon_snd', name: 'شاشة الأصوات', role: 'monitor', active: 1, mustChangePassword: 0, monitor: { categories: [], locations: [], sound: 1 }, pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash: h }, createdAt: Date.now(), updatedAt: Date.now() } }] }, sup);
  await M.reload(); await M.waitForSelector('.tv2'); await M.waitForTimeout(1500); await M.mouse.click(700, 450); await M.waitForTimeout(2000);
  await M.evaluate(() => { App.TvSound.st.snd.remindAt = 0; }); n0 = (await plays(M)).length;
  last = await waitPlay(M, n0, 30000);
  ok('reminder for tickets waiting longer than the set interval', last && last.ev === 'ticket', JSON.stringify(last));

  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  /* تنظيف */
  await api('push', { ops: [{ store: 'users', id: 'u_mon_snd', rev: -1, deleted: 1 }, ...created.map((id) => ({ store: 'tickets', id, rev: -1, deleted: 1 }))] }, sup);
  await S.evaluate(async () => { await App.Data.saveSettings({ sounds: { on: 1, style: 'chime', vol: 70, tv: { on: 1, ticket: 1, urgent: 1, chat: 1, late: 1, service: 1, ann: 1, done: 0, remind: 10, speak: 0, vol: 85, style: 'bell' } } }); await App.Data.notes.readAll(); });
  await S.waitForTimeout(1500);
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
