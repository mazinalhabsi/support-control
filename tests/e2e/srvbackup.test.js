/* اختبار طرفي: النسخ الاحتياطي على الخادم.
   - المشرف يختار مجلداً على جهاز الخادم من مركز النسخ؛ يُرفض المسار غير الكامل وما داخل مجلد الموقع (تُنزَّل منه النسخ)
   - «نسخة الآن على الخادم» تحفظ ملفاً يسترده مركز النسخ نفسه، وتُنزَّل من القائمة
   - النسخة المجدولة يحفظها الخادم مع نبضات المتصلين دون متصفح على الصفحة، ويُبقي العدد المحدد فقط
   - من لا يملك صلاحية البيانات لا يصل إليها
   التشغيل: BASE=… CHROME=… BKDIR=/مجلد/قابل/للكتابة/خارج/الموقع FILES_DIR=/مجلد/المرفقات node tests/e2e/srvbackup.test.js */
const { chromium } = require('playwright');
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', B = BASE + 'api/api.php';
const BKDIR = process.env.BKDIR || '/srv/sqbk-e2e', FILES = process.env.FILES_DIR || '/srv/sqtest/files-e2e';
const api = async (a, body, tok, q = '') => { const r = await fetch(`${B}?a=${a}${q}`, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(tok ? { 'X-Token': tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); let j = {}; try { j = await r.clone().json(); } catch (_) { /* ملف */ } return { status: r.status, j, r }; };
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
(async () => {
  for (const f of fs.readdirSync(BKDIR)) if (/^sqapa-/.test(f)) fs.unlinkSync(path.join(BKDIR, f));
  try { fs.unlinkSync(path.join(FILES, 'backup-state.json')); } catch (_) { /* لا يوجد */ }
  const sup = (await api('login', { username: 'sup', password: 'Passw0rd!' })).j.token, tech = (await api('login', { username: 'tech', password: 'Passw0rd!' })).j.token;
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const errs = [];
  const c = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true }); await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} });
  const S = await c.newPage(); S.on('pageerror', (e) => errs.push(e.message)); S.setDefaultTimeout(30000);
  await S.goto(BASE); await S.waitForSelector('[name="username"]'); await S.fill('[name="username"]', 'sup'); await S.fill('[name="password"]', 'Passw0rd!'); await S.keyboard.press('Enter');
  await S.waitForFunction(() => window.App && App.Auth.user); await S.waitForTimeout(1200);
  const open = async () => { await S.evaluate(() => { location.hash = '#/dashboard'; }); await S.waitForTimeout(300); await S.evaluate(() => { location.hash = '#/backup'; }); await S.waitForSelector('[data-act="srvrun"]'); await S.waitForTimeout(400); };

  /* 1) المجلد الافتراضي داخل مجلد الموقع في هذا الخادم: يُرفض ويُشرح السبب */
  await open();
  ok('the backup center shows the server folder panel', /مجلد النسخ على الخادم/.test(await S.textContent('#view')));
  ok('a folder inside the website is refused with the reason', /لا يصلح/.test(await S.textContent('#view')) && /داخل مجلد الموقع/.test(await S.textContent('#view')) && await S.isDisabled('[data-act="srvrun"]'));
  /* 2) مسار غير كامل، ومسار داخل الموقع: رسالة ولا يُحفظ */
  for (const [bad, why] of [['backups', 'مساراً كاملاً'], ['/srv/sqtest/e2e/bk', 'داخل مجلد الموقع']]) {
    await S.fill('[data-srvdir]', bad); await S.click('[data-act="srvdir"]'); await S.waitForTimeout(800);
    ok(`the folder «${bad}» is refused`, (await S.textContent('body')).includes(why));
  }
  /* 3) مجلد صالح */
  await S.fill('[data-srvdir]', BKDIR); await S.click('[data-act="srvdir"]'); await S.waitForTimeout(1500); await open();
  ok('a valid folder outside the website is accepted', /جاهز/.test(await S.textContent('[data-act="srvrun"]').then(() => S.textContent('#view'))) && (await S.inputValue('[data-srvdir]')) === BKDIR);
  /* 4) نسخة الآن */
  await S.click('[data-act="srvrun"]'); await S.waitForTimeout(3000); await open();
  const files1 = fs.readdirSync(BKDIR).filter((f) => /^sqapa-.*\.json\.gz$/.test(f));
  ok('«backup now on the server» writes a file in that folder and lists it', files1.length === 1 && !!(await S.$(`[data-srvget="${files1[0]}"]`)), files1.join(','));
  const json = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(BKDIR, files1[0]))).toString());
  ok('the file holds every table with the backup header', json.meta && json.meta.server === 1 && json.meta.scope === 'full' && (json.data.users || []).length > 0 && (json.data.tickets || []).length >= 0 && json.meta.rows > 0, `${json.meta.rows} rows`);
  const okRead = await S.evaluate(async (bytes) => { const f = new File([new Uint8Array(bytes)], 'x.json.gz'); const j = await App.Data.backup.read(f); return !!(j.meta && j.data && j.data.users); }, [...fs.readFileSync(path.join(BKDIR, files1[0]))]);
  ok('the backup center can read it for restore', okRead);
  const [dl] = await Promise.all([S.waitForEvent('download'), S.click(`[data-srvget="${files1[0]}"]`)]);
  ok('it downloads from the list', fs.statSync(await dl.path()).size === fs.statSync(path.join(BKDIR, files1[0])).size);
  ok('attachments are mirrored next to the backups', fs.existsSync(path.join(BKDIR, 'files')));
  /* 5) النسخة المجدولة: يحفظها الخادم مع نبضة أي متصل، وتبقى آخر نسختين */
  await S.evaluate(async () => { await App.Data.backup.setSchedule({ on: 1, every: 'daily', hour: 0, keep: 2 }); await App.Sync.flush(); });
  const auto = async () => { const st = JSON.parse(fs.readFileSync(path.join(FILES, 'backup-state.json'), 'utf8')); st.lastAt = 1; fs.writeFileSync(path.join(FILES, 'backup-state.json'), JSON.stringify(st)); try { fs.unlinkSync(path.join(FILES, 'backup-check')); } catch (_) { /* لا يوجد */ } await new Promise((r) => setTimeout(r, 1100)); await api('beat', { value: {} }, tech); };
  await auto(); const st1 = JSON.parse(fs.readFileSync(path.join(FILES, 'backup-state.json'), 'utf8'));
  ok('when due, a heartbeat of any signed-in account makes the server save the scheduled backup', st1.lastBy === 'تلقائي' && st1.lastAt > 1000 && fs.existsSync(path.join(BKDIR, st1.lastName)), st1.lastName);
  await new Promise((r) => setTimeout(r, 61000)); await auto();
  const left = fs.readdirSync(BKDIR).filter((f) => /^sqapa-.*\.json\.gz$/.test(f));
  ok('only the chosen number of backups is kept', left.length === 2, left.join(','));
  /* 6) الصلاحيات */
  const t1 = await api('backup_srv', null, tech), t2 = await api('backup_srv_dir', { dir: '/tmp' }, tech), t3 = await api('backup_srv_get', null, tech, `&name=${files1[0]}`);
  ok('an account without data permissions cannot see, set, or download server backups', t1.status === 403 && t2.status === 403 && t3.status === 403);
  const tr = await api('backup_srv_get', null, sup, '&name=../config.php');
  ok('a download name outside the backup pattern is refused', tr.status === 400);
  await S.evaluate(async () => { await App.Data.backup.setSchedule({ on: 0 }); await App.Sync.flush(); });
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
