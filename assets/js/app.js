/* =========================================================================
   Support Control — App Logic
   يبني الهيكل المشترك (نافبار/فوتر) ويولّد محتوى كل صفحة من data.js
   ========================================================================= */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const LEVELS = {
    beginner: { ar: "مبتدئ", cls: "badge-beginner" },
    inter: { ar: "متوسط", cls: "badge-inter" },
    advanced: { ar: "متقدّم", cls: "badge-advanced" },
    expert: { ar: "خبير", cls: "badge-expert" },
  };
  const lvlBadge = (l) => `<span class="badge ${LEVELS[l].cls}">${LEVELS[l].ar}</span>`;

  /* -------------------------- Shared: Navbar --------------------------- */
  function buildNav(active) {
    const links = [
      { href: "index.html", label: "الرئيسية", key: "home" },
      { href: "curriculum.html", label: "المنهج", key: "curriculum" },
      { href: "lessons.html", label: "الدروس", key: "lessons" },
      { href: "tools.html", label: "الأدوات", key: "tools" },
      { href: "labs.html", label: "المعامل", key: "labs" },
      { href: "certifications.html", label: "الشهادات", key: "certs" },
    ];
    const html = `
      <nav class="nav">
        <div class="container">
          <a class="brand" href="index.html" aria-label="الرئيسية">
            <span class="logo">${ICONS.shieldCheck}</span>
            <span>Support Control<small>أكاديمية الاختراق الأخلاقي</small></span>
          </a>
          <button class="nav-toggle" aria-label="القائمة" id="navToggle">${ICONS.menu}</button>
          <div class="nav-links" id="navLinks">
            ${links.map(l => `<a href="${l.href}" class="${l.key === active ? "active" : ""}">${l.label}</a>`).join("")}
            <a href="curriculum.html" class="btn btn-primary nav-cta">${ICONS.rocket} ابدأ الآن</a>
          </div>
        </div>
      </nav>`;
    const mount = $("#nav");
    if (mount) mount.outerHTML = html;
    const tgl = $("#navToggle"), lk = $("#navLinks");
    if (tgl) tgl.addEventListener("click", () => {
      lk.classList.toggle("open");
      tgl.innerHTML = lk.classList.contains("open") ? ICONS.x : ICONS.menu;
    });
  }

  /* -------------------------- Shared: Footer --------------------------- */
  function buildFooter() {
    const html = `
      <footer class="footer">
        <div class="container">
          <div class="footer-grid">
            <div class="footer-col footer-brand">
              <a class="brand" href="index.html">
                <span class="logo">${ICONS.shieldCheck}</span>
                <span>Support Control<small>أكاديمية الاختراق الأخلاقي</small></span>
              </a>
              <p>منصّة تعليمية متخصّصة في الأمن الهجومي الأخلاقي، تبني المهارة والمسؤولية معًا — من الصفر إلى الاحتراف.</p>
            </div>
            <div class="footer-col">
              <h5>التعلّم</h5>
              <a href="curriculum.html">المنهج الكامل</a>
              <a href="lessons.html">كل الدروس</a>
              <a href="labs.html">المعامل والتمارين</a>
              <a href="certifications.html">الشهادات</a>
            </div>
            <div class="footer-col">
              <h5>الأدوات</h5>
              <a href="tools.html">مكتبة الأدوات</a>
              <a href="tools.html">بيئة Kali</a>
              <a href="labs.html">بناء معمل منزلي</a>
            </div>
            <div class="footer-col">
              <h5>المجتمع</h5>
              <a href="#">المدوّنة</a>
              <a href="#">انضم إلينا</a>
              <a href="#">الأسئلة الشائعة</a>
            </div>
          </div>
          <div class="footer-bottom">
            <span>© ${window.SITE.year} Support Control — جميع الحقوق محفوظة.</span>
            <span class="ethics-note">${ICONS.scale} للاستخدام التعليمي والمصرّح به قانونيًا فقط</span>
          </div>
        </div>
      </footer>`;
    const mount = $("#footer");
    if (mount) mount.outerHTML = html;
  }

  /* ------------------------ Reveal on scroll --------------------------- */
  function initReveal() {
    const els = $$(".reveal");
    if (!("IntersectionObserver" in window) || !els.length) {
      els.forEach(e => e.classList.add("in")); return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    els.forEach(e => io.observe(e));
  }

  /* --------------------------- Terminal typer -------------------------- */
  function initTerminal() {
    const box = $("#termBody");
    if (!box) return;
    const lines = [
      { t: "pr", txt: "┌──(hacker㉿support-control)-[~]" },
      { t: "pr", txt: "└─$ ", cmd: "whoami --mission" },
      { t: "ok", txt: "→ تعلّم الأمن الهجومي بمسؤولية، من الصفر للاحتراف" },
      { t: "pr", txt: "└─$ ", cmd: "cat roadmap.txt | head" },
      { t: "mu", txt: "[00] الأساسيات  ·  [01] الأخلاقيات" },
      { t: "mu", txt: "[02] الاستطلاع  ·  [03] الفحص والتعداد" },
      { t: "mu", txt: "[04] الثغرات  ·  [05] الاستغلال (معمل)" },
      { t: "hl", txt: "[06→10] ما بعد الاستغلال · الويب · اللاسلكي …" },
      { t: "pr", txt: "└─$ ", cmd: "start --now", cursor: true },
    ];
    let i = 0;
    box.innerHTML = "";
    function add() {
      if (i >= lines.length) return;
      const l = lines[i++];
      const div = document.createElement("div");
      div.className = "ln";
      let html = `<span class="${l.t}">${l.txt}</span>`;
      if (l.cmd) html += `<span class="cm">${l.cmd}</span>`;
      if (l.cursor) html += `<span class="cursor"></span>`;
      div.innerHTML = html;
      box.appendChild(div);
      setTimeout(add, l.cmd ? 520 : 300);
    }
    add();
  }

  /* ----------------------- Page: Curriculum ---------------------------- */
  function renderCurriculum() {
    const mount = $("#roadmap");
    if (!mount) return;
    const totalH = CURRICULUM.reduce((a, p) => a + p.hours, 0);
    const totalL = Object.keys(LESSONS).length;
    const stats = $("#curriculumStats");
    if (stats) stats.innerHTML = `
      <div class="stat"><strong>${CURRICULUM.length}</strong><span>مرحلة</span></div>
      <div class="stat"><strong>${totalL}</strong><span>درسًا</span></div>
      <div class="stat"><strong>+${totalH}</strong><span>ساعة تعلّم</span></div>`;

    mount.innerHTML = CURRICULUM.map(p => `
      <div class="phase reveal">
        <div class="phase-rail">
          <div class="phase-num">${p.num}</div>
          <div class="phase-line"></div>
        </div>
        <div class="phase-body">
          <div class="card">
            <div class="meta-row flex items-center gap-sm wrap" style="margin-bottom:12px">
              <div class="card-icon" style="margin:0;width:44px;height:44px">${ICONS[p.icon]}</div>
              <div>
                <div class="flex items-center gap-sm wrap">
                  <h3 style="margin:0">${p.title}</h3>
                  ${lvlBadge(p.level)}
                </div>
                <span class="muted" style="font-size:.88rem">${p.subtitle}</span>
              </div>
              <span class="tag" style="margin-inline-start:auto">${ICONS.clock} ${p.hours} ساعة</span>
            </div>
            <p style="color:var(--text-soft)">${p.desc}</p>
            <div class="objectives" style="margin:16px 0 0;padding:16px 20px">
              <h4 style="font-size:.9rem;margin-bottom:10px">${ICONS.target} ستتقن:</h4>
              <ul class="prose" style="margin:0">
                ${p.outcomes.map(o => `<li>${o}</li>`).join("")}
              </ul>
            </div>
            <div class="flex gap-sm wrap" style="margin-top:16px">
              ${p.lessons.map(id => LESSONS[id] ? `<a class="tag" href="lesson.html?id=${id}" style="text-decoration:none">${ICONS.book} ${LESSONS[id].title}</a>` : "").join("")}
            </div>
          </div>
        </div>
      </div>`).join("");
    initReveal();
  }

  /* ------------------------- Page: Lessons ----------------------------- */
  function renderLessons() {
    const mount = $("#lessonGrid");
    if (!mount) return;
    const entries = Object.entries(LESSONS);
    const phaseTitle = (pid) => (CURRICULUM.find(p => p.id === pid) || {}).title || "";

    function draw(filter = "all", q = "") {
      const list = entries.filter(([id, l]) => {
        const okLvl = filter === "all" || l.level === filter;
        const okQ = !q || (l.title + l.desc).toLowerCase().includes(q.toLowerCase());
        return okLvl && okQ;
      });
      mount.innerHTML = list.length ? list.map(([id, l]) => `
        <a class="card lesson-card reveal in" href="lesson.html?id=${id}">
          <div class="meta-row">
            <span class="card-icon" style="margin:0;width:40px;height:40px">${ICONS[l.icon]}</span>
            <span class="num">#${l.num}</span>
            ${lvlBadge(l.level)}
          </div>
          <h3>${l.title}</h3>
          <p>${l.desc}</p>
          <div class="foot">
            <span>${ICONS.clock} ${l.minutes} دقيقة</span>
            <span>${ICONS.layers} ${phaseTitle(l.phase)}</span>
          </div>
        </a>`).join("")
        : `<p class="muted">لا توجد دروس مطابقة.</p>`;
    }
    draw();

    $$("#lessonFilters .chip").forEach(c => c.addEventListener("click", () => {
      $$("#lessonFilters .chip").forEach(x => x.classList.remove("active"));
      c.classList.add("active");
      draw(c.dataset.level, $("#lessonSearch")?.value || "");
    }));
    const search = $("#lessonSearch");
    if (search) search.addEventListener("input", () => {
      const active = $("#lessonFilters .chip.active")?.dataset.level || "all";
      draw(active, search.value);
    });
  }

  /* --------------------- Page: Lesson detail --------------------------- */
  function renderLesson() {
    const mount = $("#lessonContent");
    if (!mount) return;
    const id = new URLSearchParams(location.search).get("id");
    const l = LESSONS[id];
    if (!l) { mount.innerHTML = `<p class="muted">الدرس غير موجود. <a href="lessons.html">عد لقائمة الدروس</a>.</p>`; return; }
    document.title = `${l.title} — Support Control`;
    const phase = CURRICULUM.find(p => p.id === l.phase) || {};

    $("#lessonHeader").innerHTML = `
      <a href="lessons.html" class="tag" style="text-decoration:none;margin-bottom:16px;display:inline-flex">${ICONS.chevron} كل الدروس</a>
      <div class="lesson-hero-meta">
        <span class="num" style="font-family:var(--font-mono);color:var(--text-dim)">الدرس #${l.num}</span>
        ${lvlBadge(l.level)}
        <span class="tag">${ICONS.clock} ${l.minutes} دقيقة</span>
        <span class="tag">${ICONS.layers} ${phase.title || ""}</span>
      </div>
      <h1 style="font-size:clamp(1.8rem,4vw,2.6rem)">${l.title}</h1>
      <p class="lead" style="color:var(--text-soft);font-size:1.1rem;max-width:720px">${l.desc}</p>`;

    const objectives = `
      <div class="objectives">
        <h4>${ICONS.target} أهداف الدرس</h4>
        <ul class="prose" style="margin:0">${l.objectives.map(o => `<li>${o}</li>`).join("")}</ul>
      </div>`;
    const video = l.video ? `
      <div class="video-frame" role="button" aria-label="تشغيل الفيديو">
        <span class="play">${ICONS.play}</span>
        <span class="vlabel">${ICONS.play} ${l.video}</span>
      </div>` : "";
    const sections = l.content.map(s => `
      <section id="${s.id}">
        <h2>${s.h}</h2>
        ${s.body}
      </section>`).join("");

    mount.innerHTML = objectives + video + sections;

    // بناء الفهرس
    const toc = $("#lessonToc");
    if (toc) {
      toc.innerHTML = `<h4>محتويات الدرس</h4>` +
        l.content.map(s => `<a href="#${s.id}">${s.h}</a>`).join("");
    }

    // التنقّل بين الدروس
    const ids = Object.keys(LESSONS);
    const idx = ids.indexOf(id);
    const nav = $("#lessonNav");
    if (nav) {
      const prev = ids[idx - 1], next = ids[idx + 1];
      nav.innerHTML = `
        ${prev ? `<a class="btn btn-ghost" href="lesson.html?id=${prev}">${ICONS.chevron} السابق: ${LESSONS[prev].title}</a>` : "<span></span>"}
        ${next ? `<a class="btn btn-primary" href="lesson.html?id=${next}">التالي: ${LESSONS[next].title} ${ICONS.chevron}</a>` : `<a class="btn btn-primary" href="lessons.html">أنهيت المسار ${ICONS.check}</a>`}`;
    }

    // tscrollspy
    const tocLinks = $$("#lessonToc a");
    const spy = new IntersectionObserver((es) => {
      es.forEach(e => {
        if (e.isIntersecting) {
          tocLinks.forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id));
        }
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    $$("#lessonContent section").forEach(s => spy.observe(s));
  }

  /* -------------------------- Page: Tools ------------------------------ */
  function renderTools() {
    const mount = $("#toolGrid");
    if (!mount) return;
    const cats = ["all", ...new Set(TOOLS.map(t => t.cat))];
    const filt = $("#toolFilters");
    if (filt) filt.innerHTML = cats.map((c, i) =>
      `<button class="chip ${i === 0 ? "active" : ""}" data-cat="${c}">${c === "all" ? "الكل" : c}</button>`).join("");

    function draw(cat = "all") {
      const list = TOOLS.filter(t => cat === "all" || t.cat === cat);
      mount.innerHTML = list.map(t => `
        <div class="card tool-card reveal in">
          <div class="tool-head">
            <span class="tool-logo" style="background:${t.color}">${t.logo}</span>
            <div>
              <h3>${t.name}</h3>
              <span class="cat">${t.cat}</span>
            </div>
            <span style="margin-inline-start:auto">${lvlBadge(t.level)}</span>
          </div>
          <p style="color:var(--text-soft);font-size:.94rem">${t.desc}</p>
          <div class="callout callout-info" style="margin:14px 0 0;padding:12px 14px">
            ${ICONS.info}<div style="font-size:.88rem"><strong>الاستخدام:</strong> ${t.use}</div>
          </div>
        </div>`).join("");
    }
    draw();
    $$("#toolFilters .chip").forEach(c => c.addEventListener("click", () => {
      $$("#toolFilters .chip").forEach(x => x.classList.remove("active"));
      c.classList.add("active");
      draw(c.dataset.cat);
    }));
  }

  /* -------------------------- Page: Labs ------------------------------- */
  function renderLabs() {
    const mount = $("#labGrid");
    if (!mount) return;
    mount.innerHTML = LABS.map(l => `
      <a class="card reveal in" href="${l.url}" target="_blank" rel="noopener noreferrer">
        <div class="tool-head" style="margin-bottom:14px">
          <span class="tool-logo" style="background:${l.color}">${l.name[0]}</span>
          <div><h3 style="margin:0">${l.name}</h3></div>
          <span style="margin-inline-start:auto">${lvlBadge(l.level)}</span>
        </div>
        <p style="color:var(--text-soft);font-size:.94rem">${l.desc}</p>
        <span class="tag" style="margin-top:14px;display:inline-flex">${ICONS.globe} زيارة المنصّة</span>
      </a>`).join("");
  }

  /* ------------------------- Page: Certs ------------------------------- */
  function renderCerts() {
    const mount = $("#certGrid");
    if (!mount) return;
    mount.innerHTML = CERTS.map(c => `
      <div class="card reveal in">
        <div class="flex items-center gap-sm wrap" style="margin-bottom:12px">
          <span class="card-icon" style="margin:0;width:44px;height:44px">${ICONS.graduation}</span>
          <div>
            <h3 style="margin:0;font-size:1.1rem">${c.name}</h3>
            <span class="muted" style="font-size:.85rem">${c.focus}</span>
          </div>
          <span style="margin-inline-start:auto">${lvlBadge(c.level)}</span>
        </div>
        <p style="color:var(--text-soft);font-size:.92rem;margin:0">${c.note}</p>
      </div>`).join("");
  }

  /* ----------------------- Home: feature stats ------------------------- */
  function renderHomeStats() {
    const mount = $("#homeStats");
    if (!mount) return;
    const totalH = CURRICULUM.reduce((a, p) => a + p.hours, 0);
    mount.innerHTML = `
      <div class="stat"><strong>${CURRICULUM.length}</strong><span>مرحلة تعليمية</span></div>
      <div class="stat"><strong>${Object.keys(LESSONS).length}+</strong><span>درس مفصّل</span></div>
      <div class="stat"><strong>${TOOLS.length}+</strong><span>أداة احترافية</span></div>
      <div class="stat"><strong>+${totalH}</strong><span>ساعة محتوى</span></div>`;
  }

  function renderHomePhases() {
    const mount = $("#homePhases");
    if (!mount) return;
    mount.innerHTML = CURRICULUM.slice(0, 6).map(p => `
      <a class="card reveal" href="curriculum.html#${p.id}">
        <div class="card-icon">${ICONS[p.icon]}</div>
        <div class="flex items-center gap-sm" style="margin-bottom:6px">
          <span class="num" style="font-family:var(--font-mono);color:var(--text-dim);font-size:.82rem">${p.num}</span>
          ${lvlBadge(p.level)}
        </div>
        <h3>${p.title}</h3>
        <p>${p.desc}</p>
      </a>`).join("");
    initReveal();
  }

  /* ------------------------------ Boot --------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page || "";
    buildNav(page);
    buildFooter();
    initTerminal();
    renderHomeStats();
    renderHomePhases();
    renderCurriculum();
    renderLessons();
    renderLesson();
    renderTools();
    renderLabs();
    renderCerts();
    initReveal();
  });
})();
