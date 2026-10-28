/* اختبار طرفي: شاشة المراقبة ونغمات الإشعارات.
   - البلاغ الجديد يظهر فوراً في بطاقة كبيرة، ويتصدر القائمة ولو كثرت البلاغات المفتوحة (كان يقع في آخر صفحة)
   - البلاغ العاجل ببطاقة حمراء، وإيقاف البطاقة من الإعدادات
   - جلسة شاشة العرض تتجدد ما دامت تعمل، وجلسات غيرها لا
   - النغمات الجديدة، واختيارها في الملف الشخصي والإعدادات، ونغمة خاصة لكل شاشة
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome DBNAME=اسم_قاعدة_الاختبار node tests/e2e/monitor.test.js */
const { chromium } = require('playwright');
const crypto = require('crypto');
const { execSync } = require('child_process');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php', U = BASE;
const sql = (q) => execSync(`mysql -uroot ${process.env.DBNAME || 'sqapa_e2e'} -N -e "${q.replace(/"/g, '\\"')}"`).toString().trim();
const api = async (a, body, tok) => { const r = await fetch(`${B}?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Token': tok } : {}) }, body: JSON.stringify(body || {}) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
(async () => {
  const T = String(Date.now() % 100000), sup = (await api('login', { username: 'sup', password: 'Passw0rd!' })).j.token;
  const depLogin = (await api('login', { username: 'dep', password: 'Passw0rd!' })).j, depId = depLogin.user.id;
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  const errs = [];
  const page = async (user, pw = 'Passw0rd!', viewport = { width: 1400, height: 900 }) => {
    const c = await b.newContext({ viewport }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} });
    const p = await c.newPage(); p.setDefaultTimeout(20000); p.on('pageerror', (e) => errs.push(`${user}: ${e.message}`));
    await p.goto(U); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', user); await p.fill('[name="password"]', pw); await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.App && App.Auth.user, null, { timeout: 20000 }); await p.waitForTimeout(1500); return p;
  };
  /* حساب شاشة بنغمة خاصة، واثنا عشر بلاغاً مفتوحاً أقدم (أكثر من صفحة على الشاشة) */
  const MON = `u_mon_tv${T}`, salt = crypto.randomBytes(16), hash = crypto.pbkdf2Sync('Passw0rd!', salt, 1000, 32, 'sha256').toString('hex');
  const old = Array.from({ length: 12 }, (_, i) => `tk_mt_${T}_${i}`), t0 = Date.now() - 3 * 3600000;
  await api('push', { ops: [
    { store: 'users', id: MON, rev: -1, data: { id: MON, username: `montv${T}`, name: 'شاشة الاختبار', role: 'monitor', active: 1, mustChangePassword: 0, monitor: { categories: [], locations: [], sound: 1, style: 'glass' }, pass: { algo: 'pbkdf2-sha256', iter: 1000, salt: salt.toString('hex'), hash } } },
    ...old.map((id, i) => ({ store: 'tickets', id, rev: 0, data: { id, number: `MT-${T}-${i}`, title: `بلاغ قديم ${i}`, description: 'اختبار الشاشة', categoryId: 'printer', priority: 'medium', status: 'new', requesterId: depId, createdAt: t0 + i * 1000, updatedAt: t0, dueAt: Date.now() + 86400000 } }))
  ] }, sup);
  const S = await page('sup');
  await S.evaluate(async () => { const s = App.Data.c.settings.sounds || {}; await App.Data.saveSettings({ sounds: { ...s, on: 1, tv: { ...(s.tv || {}), on: 1, ticket: 1, urgent: 1, popup: 1, remind: 0 } } }); });
  const M = await page(`montv${T}`, 'Passw0rd!', { width: 1920, height: 1080 });
  await M.waitForSelector('[data-rows] .tv2-tr'); await M.waitForTimeout(1500);
  const before = await M.evaluate(() => document.querySelector('[data-qinfo]').textContent);
  ok('display opens with several pages of open tickets', /صفحة/.test(before), before);
  const D = await page('dep');
  const newTicket = (o) => D.evaluate(async (o) => (await App.Data.tickets.create({ description: 'اختبار شاشة المراقبة', categoryId: 'printer', ...o })).id, o);
  const waitAlert = async (title, ms = 25000) => { try { await M.waitForFunction((t) => { const a = document.getElementById('tvAlert'); return a && a.innerText.includes(t); }, title, { timeout: ms }); return true; } catch (_) { return false; } };
  const firstRow = () => M.evaluate(() => (document.querySelector('.tv2-tr:not(.tv2-th) .tv2-subj b') || {}).textContent || '');

  /* 1) بلاغ جديد: بطاقة كبيرة، ويتصدر القائمة، وبنغمة الشاشة الخاصة */
  const n1 = `طابعة لا تطبع ${T}`, p0 = await M.evaluate(() => App.Snd.played.length);
  const id1 = await newTicket({ title: n1, priority: 'medium' });
  const shown = await waitAlert(n1);
  const card = await M.evaluate(() => { const a = document.getElementById('tvAlert'); return a ? { kick: a.querySelector('.tv-alert-kicker').textContent, tone: a.style.getPropertyValue('--t') } : null; });
  ok('new ticket shows a large alert card on the display', shown && card && /بلاغ جديد/.test(card.kick), JSON.stringify(card));
  ok('new ticket leads the list instead of landing on the last page', (await firstRow()).includes(n1), await firstRow());
  const snd = await M.evaluate((n) => App.Snd.played.slice(n), p0);
  ok('display plays its own tone (set on the display account)', snd.some((x) => x.ev === 'ticket' && x.style === 'glass'), JSON.stringify(snd));
  await M.waitForTimeout(13000);
  ok('it stays on top after the pages rotate', (await firstRow()).includes(n1), await firstRow());
  await M.mouse.click(300, 500); await M.waitForTimeout(400);
  ok('a touch closes the card', !(await M.evaluate(() => !!document.getElementById('tvAlert'))));

  /* 2) بلاغ عاجل: بطاقة حمراء */
  const n2 = `انقطاع الشبكة ${T}`, id2 = await newTicket({ title: n2, priority: 'urgent' });
  await waitAlert(n2);
  const urgent = await M.evaluate(() => { const a = document.getElementById('tvAlert'); return a ? { kick: a.querySelector('.tv-alert-kicker').textContent, tone: a.style.getPropertyValue('--t') } : null; });
  ok('urgent ticket: red card marked urgent', urgent && /عاجل/.test(urgent.kick) && /red/.test(urgent.tone), JSON.stringify(urgent));
  await M.mouse.click(300, 500);

  /* 3) إيقاف البطاقة من الإعدادات: يبقى البلاغ متصدراً القائمة دون بطاقة */
  await S.evaluate(async () => { const s = App.Data.c.settings.sounds; await App.Data.saveSettings({ sounds: { ...s, tv: { ...s.tv, popup: 0 } } }); });
  await M.waitForFunction(() => App.Data.c.settings.sounds && App.Data.c.settings.sounds.tv.popup === 0, null, { timeout: 30000 }).catch(() => null);
  const n3 = `ماسح ضوئي ${T}`, id3 = await newTicket({ title: n3, priority: 'medium' });
  let lead = false; for (let i = 0; i < 25 && !lead; i++) { await M.waitForTimeout(1000); lead = (await firstRow()).includes(n3) || (await M.evaluate((t) => [...document.querySelectorAll('.tv2-tr.pinned')].some((r) => r.innerText.includes(t)), n3)); }
  ok('card can be switched off in settings; the ticket still leads the list', lead && !(await M.evaluate(() => !!document.getElementById('tvAlert'))));
  await S.evaluate(async () => { const s = App.Data.c.settings.sounds; await App.Data.saveSettings({ sounds: { ...s, tv: { ...s.tv, popup: 1 } } }); });

  /* 4) جلسة شاشة العرض تتجدد ما دامت تعمل؛ جلسة الموظف لا */
  const mtok = (await api('login', { username: `montv${T}`, password: 'Passw0rd!' })).j.token, dtok = (await api('login', { username: 'dep', password: 'Passw0rd!' })).j.token;
  const soon = Date.now() + 3600000;
  sql(`UPDATE sessions SET expires = ${soon} WHERE user_id IN ('${MON}', '${depId}')`);
  await api('me', {}, mtok); await api('me', {}, dtok);
  const mExp = Number(sql(`SELECT MAX(expires) FROM sessions WHERE user_id = '${MON}'`)), dExp = Number(sql(`SELECT MAX(expires) FROM sessions WHERE user_id = '${depId}'`));
  ok('display session renews itself while running', mExp > Date.now() + 10 * 3600000, `${Math.round((mExp - Date.now()) / 3600000)}h`);
  ok('other sessions keep their fixed lifetime', dExp <= soon, `${Math.round((dExp - Date.now()) / 60000)}min`);

  /* 5) النغمات: كل نغمة تعمل، واختيارها في الملف الشخصي والإعدادات وحساب الشاشة */
  const styles = await S.evaluate(() => { const before = App.Snd.played.length, all = ['chime', 'bell', 'marimba', 'digital', 'glass', 'harp', 'piano', 'drop', 'pop', 'retro', 'soft']; all.forEach((k) => App.Snd.play('ticket', { style: k })); return { want: all, got: App.Snd.played.slice(before).map((x) => x.style) }; });
  ok('eleven tones, each plays as itself', styles.got.length === 11 && styles.got.every((x, i) => x === styles.want[i]), styles.got.join(','));
  await S.evaluate(() => { location.hash = '#/profile'; }); await S.waitForSelector('.snd-panel .snd-tones'); await S.waitForTimeout(400);
  const nTones = await S.$$eval('.snd-panel .snd-tones label', (x) => x.length);
  const p1 = await S.evaluate(() => App.Snd.played.length);
  await S.click('.snd-panel .snd-tones label:has(input[value="harp"])'); await S.waitForTimeout(400);
  const pick = await S.evaluate((n) => ({ ls: localStorage.getItem('sq_sstyle'), played: App.Snd.played.slice(n).map((x) => x.style) }), p1);
  ok('profile: all tones listed, choosing one previews it and keeps it for this device', nTones === 11 && pick.ls === 'harp' && pick.played.includes('harp'), JSON.stringify({ nTones, ...pick }));
  await S.evaluate(() => localStorage.removeItem('sq_sstyle'));
  await S.evaluate(() => { location.hash = '#/settings?s=sounds'; }); await S.waitForSelector('[data-act="sndsave"]'); await S.waitForTimeout(400);
  const p2 = await S.evaluate(() => App.Snd.played.length);
  await S.click('.snd-tones label:has(input[name="tv_style"][value="piano"])'); await S.waitForTimeout(400);
  const cc = await S.evaluate((n) => ({ pickers: document.querySelectorAll('.snd-tones').length, popup: !!document.querySelector('[name="tv_popup"]'), played: App.Snd.played.slice(n).map((x) => x.style) }), p2);
  ok('settings: tone pickers for users and displays preview on choice, with the card switch', cc.pickers === 2 && cc.popup && cc.played.includes('piano'), JSON.stringify(cc));
  await S.evaluate((id) => { void App.Pages.userModal(id); }, MON); await S.waitForSelector('dialog [name="mstyle"]');
  const mon = await S.evaluate(() => { const sel = document.querySelector('dialog [name="mstyle"]'); return { value: sel.value, options: sel.options.length }; });
  ok('display account: its own tone chosen from all tones (or the displays default)', mon.value === 'glass' && mon.options === 12, JSON.stringify(mon));
  await S.click('dialog [data-x]');

  /* تنظيف */
  await api('push', { ops: [...old, id1, id2, id3].filter(Boolean).map((id) => ({ store: 'tickets', id, rev: -1, deleted: 1 })).concat([{ store: 'users', id: MON, rev: -1, deleted: 1 }]) }, sup);
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
