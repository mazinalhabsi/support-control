/* =========================================================================
   Support Control — SPA Router + Views (single-file build source)
   يحوّل المنصّة إلى تطبيق صفحة واحدة بتوجيه عبر الـ hash، ليعمل كملف
   index.html مستقل حتى عند فتحه مباشرة عبر file://
   ========================================================================= */
(function () {
  "use strict";
  var I = window.ICONS, SITE = window.SITE;
  var CURRICULUM = window.CURRICULUM, LESSONS = window.LESSONS,
      TOOLS = window.TOOLS, LABS = window.LABS, CERTS = window.CERTS;

  var LEVELS = {
    beginner: { ar: "مبتدئ", cls: "badge-beginner" },
    inter: { ar: "متوسط", cls: "badge-inter" },
    advanced: { ar: "متقدّم", cls: "badge-advanced" },
    expert: { ar: "خبير", cls: "badge-expert" },
  };
  function lvl(l) { return '<span class="badge ' + LEVELS[l].cls + '">' + LEVELS[l].ar + '</span>'; }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  function phaseById(id) { for (var i = 0; i < CURRICULUM.length; i++) if (CURRICULUM[i].id === id) return CURRICULUM[i]; return {}; }
  function totalHours() { return CURRICULUM.reduce(function (a, p) { return a + p.hours; }, 0); }

  /* ------------------------------- Routes ------------------------------ */
  var NAV = [
    { route: "home", href: "#/", label: "الرئيسية" },
    { route: "curriculum", href: "#/curriculum", label: "المنهج" },
    { route: "lessons", href: "#/lessons", label: "الدروس" },
    { route: "tools", href: "#/tools", label: "الأدوات" },
    { route: "labs", href: "#/labs", label: "المعامل" },
    { route: "certs", href: "#/certs", label: "الشهادات" },
  ];

  function parseHash() {
    var h = (location.hash || "#/").replace(/^#\/?/, "");
    var parts = h.split("/").filter(Boolean);
    if (!parts.length) return { route: "home" };
    if (parts[0] === "lesson") return { route: "lesson", id: parts[1] };
    return { route: parts[0] };
  }

  /* ------------------------------- Chrome ------------------------------ */
  function navHTML(active) {
    return '<nav class="nav"><div class="container">' +
      '<a class="brand" href="#/" aria-label="الرئيسية"><span class="logo">' + I.shieldCheck + '</span>' +
      '<span>Support Control<small>أكاديمية الاختراق الأخلاقي</small></span></a>' +
      '<button class="nav-toggle" id="navToggle" aria-label="القائمة">' + I.menu + '</button>' +
      '<div class="nav-links" id="navLinks">' +
      NAV.map(function (l) { return '<a href="' + l.href + '" class="' + (l.route === active ? "active" : "") + '">' + l.label + '</a>'; }).join("") +
      '<a href="#/curriculum" class="btn btn-primary nav-cta">' + I.rocket + ' ابدأ الآن</a>' +
      '</div></div></nav>';
  }
  function footHTML() {
    return '<footer class="footer"><div class="container"><div class="footer-grid">' +
      '<div class="footer-col footer-brand"><a class="brand" href="#/"><span class="logo">' + I.shieldCheck + '</span>' +
      '<span>Support Control<small>أكاديمية الاختراق الأخلاقي</small></span></a>' +
      '<p>منصّة تعليمية متخصّصة في الأمن الهجومي الأخلاقي، تبني المهارة والمسؤولية معًا — من الصفر إلى الاحتراف.</p></div>' +
      '<div class="footer-col"><h5>التعلّم</h5><a href="#/curriculum">المنهج الكامل</a><a href="#/lessons">كل الدروس</a><a href="#/labs">المعامل والتمارين</a><a href="#/certs">الشهادات</a></div>' +
      '<div class="footer-col"><h5>الأدوات</h5><a href="#/tools">مكتبة الأدوات</a><a href="#/tools">بيئة Kali</a><a href="#/labs">بناء معمل منزلي</a></div>' +
      '<div class="footer-col"><h5>المجتمع</h5><a href="#/">المدوّنة</a><a href="#/">انضم إلينا</a><a href="#/">الأسئلة الشائعة</a></div>' +
      '</div><div class="footer-bottom"><span>© ' + SITE.year + ' Support Control — جميع الحقوق محفوظة.</span>' +
      '<span class="ethics-note">' + I.scale + ' للاستخدام التعليمي والمصرّح به قانونيًا فقط</span></div></div></footer>';
  }

  /* ------------------------------- Views ------------------------------- */
  var V = {};

  V.home = function () {
    var why = [
      { i: "route", t: "منهج متدرّج", d: "11 مرحلة متسلسلة تأخذ بيدك من أساسيات الشبكات حتى الاحتراف، دون قفزات أو فجوات." },
      { i: "terminal", t: "تطبيق عملي", d: "معامل وتمارين على منصّات قانونية، لأن الأمن يُتعلّم باليد لا بالقراءة فقط." },
      { i: "scale", t: "إطار أخلاقي", d: "كل درس يبدأ بالمسؤولية: التفويض، النطاق، والقانون قبل أي أمر في الطرفية." },
      { i: "layers", t: "فهم عميق", d: "نشرح كيف تعمل الثغرة ولماذا، لا كيف تنسخ أمرًا جاهزًا دون فهم." },
      { i: "shieldCheck", t: "منظور دفاعي", d: "تتعلّم الهجوم لتتقن الدفاع — كل تقنية مقرونة بكيفية كشفها ومنعها." },
      { i: "graduation", t: "جاهزية مهنية", d: "من كتابة التقارير إلى خريطة الشهادات العالمية ومسارات التوظيف." },
    ];
    var methods = [
      { i: "play", t: "فيديوهات", d: "شروحات مرئية لكل درس." },
      { i: "book", t: "دروس مكتوبة", d: "محتوى مفصّل ومرجعي." },
      { i: "terminal", t: "معامل تطبيقية", d: "بيئات تدريب آمنة." },
      { i: "flag", t: "تحدّيات CTF", d: "اختبر مهارتك عمليًا." },
    ];
    return '' +
      '<header class="hero"><div class="container hero-grid"><div>' +
        '<span class="eyebrow">' + I.zap + ' من الصفر إلى الاحتراف</span>' +
        '<h1>أتقن <span class="gradient-text">الاختراق الأخلاقي</span> كما يفعله المحترفون</h1>' +
        '<p class="lead">منصّة تعليمية متكاملة تبني مهاراتك في الأمن الهجومي خطوة بخطوة — بمنهج متدرّج، دروس مفصّلة، أدوات حقيقية، ومعامل تطبيقية، ضمن إطار أخلاقي وقانوني صارم.</p>' +
        '<div class="hero-actions"><a href="#/curriculum" class="btn btn-primary btn-lg">' + I.rocket + ' ابدأ المنهج</a>' +
        '<a href="#/lessons" class="btn btn-ghost btn-lg">' + I.book + ' تصفّح الدروس</a></div>' +
        '<div class="hero-stats">' +
          stat(CURRICULUM.length, "مرحلة تعليمية") + stat(Object.keys(LESSONS).length + "+", "درس مفصّل") +
          stat(TOOLS.length + "+", "أداة احترافية") + stat("+" + totalHours(), "ساعة محتوى") +
        '</div></div>' +
        '<div><div class="terminal"><div class="terminal-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="ttl">support-control — zsh</span></div><div class="terminal-body" id="termBody"></div></div></div>' +
      '</div></header>' +
      '<section class="container"><div class="callout callout-warn" style="align-items:center">' + I.scale +
        '<div><strong>تعهّد أخلاقي:</strong> كل ما تتعلّمه هنا مخصّص للاختبار المصرّح به قانونيًا والدفاع السيبراني. اختبار أي نظام لا تملكه دون تفويض مكتوب جريمة — نعلّمك المهارة والمسؤولية معًا.</div></div></section>' +
      '<section class="section"><div class="container"><div class="section-head text-center" style="margin-inline:auto">' +
        '<span class="eyebrow">' + I.shieldCheck + ' لماذا هذه المنصّة</span><h2>تعليم مبني على <span class="gradient-text">المنهجية</span>، لا على الحيل</h2>' +
        '<p>لا نبيعك «اختراق في 5 دقائق». نبني أساسًا هندسيًا متينًا يجعلك مختبِرًا يُعتمد عليه.</p></div>' +
        '<div class="grid grid-3">' + why.map(function (w) { return card(w.i, w.t, w.d); }).join("") + '</div></div></section>' +
      '<section class="section" style="padding-top:0"><div class="container"><div class="section-head">' +
        '<span class="eyebrow">خريطة التعلّم</span><h2>مسار متدرّج من <span class="gradient-text">11 مرحلة</span></h2>' +
        '<p>كل مرحلة تبني على ما قبلها — من أساسيات الحاسوب حتى احتراف التقارير والشهادات العالمية.</p></div>' +
        '<div class="grid grid-3">' + CURRICULUM.slice(0, 6).map(homePhaseCard).join("") + '</div>' +
        '<div class="text-center" style="margin-top:36px"><a href="#/curriculum" class="btn btn-outline btn-lg">استعرض المنهج الكامل ' + I.chevron + '</a></div></div></section>' +
      '<section class="section" style="padding-top:0"><div class="container"><div class="section-head text-center" style="margin-inline:auto">' +
        '<span class="eyebrow">طرق التعلّم</span><h2>كل وسيلة تعلّم ممكنة في <span class="gradient-text">مكان واحد</span></h2></div>' +
        '<div class="grid grid-4">' + methods.map(function (m) { return '<div class="card reveal" style="text-align:center"><div class="card-icon" style="margin-inline:auto">' + I[m.i] + '</div><h3 style="font-size:1.05rem">' + m.t + '</h3><p>' + m.d + '</p></div>'; }).join("") + '</div></div></section>' +
      '<section class="section" style="padding-top:0"><div class="container"><div class="cta-band reveal">' +
        '<h2>جاهز لتبدأ رحلتك؟</h2><p>ابدأ من المرحلة صفر اليوم. لا حاجة لخبرة سابقة — فقط فضول والتزام بالأخلاقيات.</p>' +
        '<a href="#/curriculum" class="btn btn-primary btn-lg">' + I.rocket + ' ادخل المرحلة صفر</a></div></div></section>';
  };

  function stat(n, l) { return '<div class="stat"><strong>' + n + '</strong><span>' + l + '</span></div>'; }
  function card(icon, t, d) { return '<div class="card reveal"><div class="card-icon">' + I[icon] + '</div><h3>' + t + '</h3><p>' + d + '</p></div>'; }
  function homePhaseCard(p) {
    return '<a class="card reveal" href="#/curriculum"><div class="card-icon">' + I[p.icon] + '</div>' +
      '<div class="flex items-center gap-sm" style="margin-bottom:6px"><span class="num" style="font-family:var(--font-mono);color:var(--text-dim);font-size:.82rem">' + p.num + '</span>' + lvl(p.level) + '</div>' +
      '<h3>' + p.title + '</h3><p>' + p.desc + '</p></a>';
  }

  V.curriculum = function () {
    var head = '<header class="section-sm" style="padding-top:56px"><div class="container">' +
      '<span class="eyebrow">خريطة الطريق</span><h1 style="font-size:clamp(2rem,4.5vw,3rem)">المنهج الكامل: <span class="gradient-text">من الصفر إلى الاحتراف</span></h1>' +
      '<p class="lead" style="color:var(--text-soft);max-width:720px">مسار هندسي متدرّج عبر 11 مرحلة. ابدأ من الأعلى والتزم بالترتيب — كل مرحلة مصمّمة لتبني على سابقتها.</p>' +
      '<div class="hero-stats" style="margin-top:24px">' + stat(CURRICULUM.length, "مرحلة") + stat(Object.keys(LESSONS).length, "درسًا") + stat("+" + totalHours(), "ساعة تعلّم") + '</div></div></header>';
    var body = CURRICULUM.map(function (p) {
      return '<div class="phase reveal"><div class="phase-rail"><div class="phase-num">' + p.num + '</div><div class="phase-line"></div></div>' +
        '<div class="phase-body"><div class="card">' +
        '<div class="meta-row flex items-center gap-sm wrap" style="margin-bottom:12px">' +
          '<div class="card-icon" style="margin:0;width:44px;height:44px">' + I[p.icon] + '</div>' +
          '<div><div class="flex items-center gap-sm wrap"><h3 style="margin:0">' + p.title + '</h3>' + lvl(p.level) + '</div>' +
          '<span class="muted" style="font-size:.88rem">' + p.subtitle + '</span></div>' +
          '<span class="tag" style="margin-inline-start:auto">' + I.clock + ' ' + p.hours + ' ساعة</span></div>' +
        '<p style="color:var(--text-soft)">' + p.desc + '</p>' +
        '<div class="objectives" style="margin:16px 0 0;padding:16px 20px"><h4 style="font-size:.9rem;margin-bottom:10px">' + I.target + ' ستتقن:</h4>' +
          '<ul class="prose" style="margin:0">' + p.outcomes.map(function (o) { return '<li>' + o + '</li>'; }).join("") + '</ul></div>' +
        '<div class="flex gap-sm wrap" style="margin-top:16px">' +
          p.lessons.map(function (id) { return LESSONS[id] ? '<a class="tag" href="#/lesson/' + id + '" style="text-decoration:none">' + I.book + ' ' + LESSONS[id].title + '</a>' : ""; }).join("") +
        '</div></div></div></div>';
    }).join("");
    return head + '<section class="section" style="padding-top:20px"><div class="container"><div class="roadmap">' + body + '</div></div></section>';
  };

  V.lessons = function () {
    return '<header class="section-sm" style="padding-top:56px;padding-bottom:20px"><div class="container">' +
      '<span class="eyebrow">مكتبة الدروس</span><h1 style="font-size:clamp(2rem,4.5vw,3rem)">كل <span class="gradient-text">الدروس</span></h1>' +
      '<p class="lead" style="color:var(--text-soft);max-width:680px">تصفّح الدروس حسب المستوى أو ابحث عن موضوع. كل درس يتضمّن أهدافًا وفيديو ومحتوى مرجعيًا مفصّلًا.</p></div></header>' +
      '<section class="section" style="padding-top:12px"><div class="container">' +
      '<div class="filters" id="lessonFilters">' +
        '<button class="chip active" data-level="all">الكل</button>' +
        '<button class="chip" data-level="beginner">مبتدئ</button>' +
        '<button class="chip" data-level="inter">متوسط</button>' +
        '<button class="chip" data-level="advanced">متقدّم</button>' +
        '<button class="chip" data-level="expert">خبير</button>' +
        '<div class="search-box">' + I.search + '<input type="search" id="lessonSearch" placeholder="ابحث في الدروس…" aria-label="بحث" /></div>' +
      '</div><div class="grid grid-auto" id="lessonGrid"></div></div></section>';
  };

  function drawLessons(filter, q) {
    filter = filter || "all"; q = (q || "").toLowerCase();
    var grid = $("#lessonGrid"); if (!grid) return;
    var html = Object.keys(LESSONS).filter(function (id) {
      var l = LESSONS[id];
      return (filter === "all" || l.level === filter) && (!q || (l.title + l.desc).toLowerCase().indexOf(q) > -1);
    }).map(function (id) {
      var l = LESSONS[id];
      return '<a class="card lesson-card" href="#/lesson/' + id + '"><div class="meta-row">' +
        '<span class="card-icon" style="margin:0;width:40px;height:40px">' + I[l.icon] + '</span>' +
        '<span class="num">#' + l.num + '</span>' + lvl(l.level) + '</div>' +
        '<h3>' + l.title + '</h3><p>' + l.desc + '</p>' +
        '<div class="foot"><span>' + I.clock + ' ' + l.minutes + ' دقيقة</span><span>' + I.layers + ' ' + (phaseById(l.phase).title || "") + '</span></div></a>';
    }).join("");
    grid.innerHTML = html || '<p class="muted">لا توجد دروس مطابقة.</p>';
  }

  V.lesson = function (id) {
    var l = LESSONS[id];
    if (!l) return '<section class="section"><div class="container"><p class="muted">الدرس غير موجود. <a href="#/lessons" style="color:var(--brand)">عد لقائمة الدروس</a>.</p></div></section>';
    document.title = l.title + " — Support Control";
    var phase = phaseById(l.phase);
    var ids = Object.keys(LESSONS), idx = ids.indexOf(id), prev = ids[idx - 1], next = ids[idx + 1];

    var header = '<div id="lessonHeader">' +
      '<a href="#/lessons" class="tag" style="text-decoration:none;margin-bottom:16px;display:inline-flex">' + I.chevron + ' كل الدروس</a>' +
      '<div class="lesson-hero-meta"><span class="num" style="font-family:var(--font-mono);color:var(--text-dim)">الدرس #' + l.num + '</span>' +
      lvl(l.level) + '<span class="tag">' + I.clock + ' ' + l.minutes + ' دقيقة</span><span class="tag">' + I.layers + ' ' + (phase.title || "") + '</span></div>' +
      '<h1 style="font-size:clamp(1.8rem,4vw,2.6rem)">' + l.title + '</h1>' +
      '<p class="lead" style="color:var(--text-soft);font-size:1.1rem;max-width:720px">' + l.desc + '</p></div>';

    var objectives = '<div class="objectives"><h4>' + I.target + ' أهداف الدرس</h4><ul class="prose" style="margin:0">' +
      l.objectives.map(function (o) { return '<li>' + o + '</li>'; }).join("") + '</ul></div>';
    var video = l.video ? '<div class="video-frame" role="button" aria-label="تشغيل الفيديو"><span class="play">' + I.play + '</span><span class="vlabel">' + I.play + ' ' + l.video + '</span></div>' : "";
    var sections = l.content.map(function (s) { return '<section id="' + s.id + '"><h2>' + s.h + '</h2>' + s.body + '</section>'; }).join("");
    var toc = '<h4>محتويات الدرس</h4>' + l.content.map(function (s) { return '<a href="#' + s.id + '">' + s.h + '</a>'; }).join("");
    var navBtns =
      (prev ? '<a class="btn btn-ghost" href="#/lesson/' + prev + '">' + I.chevron + ' السابق: ' + LESSONS[prev].title + '</a>' : '<span></span>') +
      (next ? '<a class="btn btn-primary" href="#/lesson/' + next + '">التالي: ' + LESSONS[next].title + ' ' + I.chevron + '</a>' : '<a class="btn btn-primary" href="#/lessons">أنهيت المسار ' + I.check + '</a>');

    return '<header class="section-sm" style="padding-top:48px;padding-bottom:0"><div class="container">' + header + '</div></header>' +
      '<section class="section" style="padding-top:32px"><div class="container"><div class="lesson-layout">' +
      '<article class="prose" id="lessonContent">' + objectives + video + sections + '</article>' +
      '<aside class="lesson-aside"><nav class="toc" id="lessonToc">' + toc + '</nav></aside></div>' +
      '<hr class="divider" /><div class="flex items-center wrap" style="justify-content:space-between;gap:12px">' + navBtns + '</div></div></section>';
  };

  V.tools = function () {
    var cats = ["all"]; TOOLS.forEach(function (t) { if (cats.indexOf(t.cat) < 0) cats.push(t.cat); });
    var filters = cats.map(function (c, i) { return '<button class="chip ' + (i === 0 ? "active" : "") + '" data-cat="' + c + '">' + (c === "all" ? "الكل" : c) + '</button>'; }).join("");
    return '<header class="section-sm" style="padding-top:56px;padding-bottom:20px"><div class="container">' +
      '<span class="eyebrow">مكتبة الأدوات</span><h1 style="font-size:clamp(2rem,4.5vw,3rem)">أدوات <span class="gradient-text">المحترفين</span></h1>' +
      '<p class="lead" style="color:var(--text-soft);max-width:720px">تعرّف على الأدوات التي تعتمدها الفرق الأمنية حول العالم: ما هي، لماذا هي مهمّة، وكيف تُستخدم في اختبار مصرّح به.</p>' +
      '<div class="callout callout-warn" style="margin-top:22px">' + I.alert + '<div>كل هذه الأدوات مزدوجة الاستخدام. تعلّمها هنا موجّه للاختبار المصرّح به والدفاع فقط. استخدامها ضد أنظمة لا تملكها دون تفويض جريمة.</div></div></div></header>' +
      '<section class="section" style="padding-top:12px"><div class="container"><div class="filters" id="toolFilters">' + filters + '</div>' +
      '<div class="grid grid-auto" id="toolGrid"></div></div></section>';
  };

  function drawTools(cat) {
    cat = cat || "all";
    var grid = $("#toolGrid"); if (!grid) return;
    grid.innerHTML = TOOLS.filter(function (t) { return cat === "all" || t.cat === cat; }).map(function (t) {
      return '<div class="card tool-card"><div class="tool-head"><span class="tool-logo" style="background:' + t.color + '">' + t.logo + '</span>' +
        '<div><h3>' + t.name + '</h3><span class="cat">' + t.cat + '</span></div><span style="margin-inline-start:auto">' + lvl(t.level) + '</span></div>' +
        '<p style="color:var(--text-soft);font-size:.94rem">' + t.desc + '</p>' +
        '<div class="callout callout-info" style="margin:14px 0 0;padding:12px 14px">' + I.info + '<div style="font-size:.88rem"><strong>الاستخدام:</strong> ' + t.use + '</div></div></div>';
    }).join("");
  }

  V.labs = function () {
    var cards = LABS.map(function (l) {
      return '<a class="card" href="' + l.url + '" target="_blank" rel="noopener noreferrer">' +
        '<div class="tool-head" style="margin-bottom:14px"><span class="tool-logo" style="background:' + l.color + '">' + l.name[0] + '</span>' +
        '<div><h3 style="margin:0">' + l.name + '</h3></div><span style="margin-inline-start:auto">' + lvl(l.level) + '</span></div>' +
        '<p style="color:var(--text-soft);font-size:.94rem">' + l.desc + '</p>' +
        '<span class="tag" style="margin-top:14px;display:inline-flex">' + I.globe + ' زيارة المنصّة</span></a>';
    }).join("");
    return '<header class="section-sm" style="padding-top:56px;padding-bottom:20px"><div class="container">' +
      '<span class="eyebrow">تعلّم باليد</span><h1 style="font-size:clamp(2rem,4.5vw,3rem)">المعامل و<span class="gradient-text">التمارين</span></h1>' +
      '<p class="lead" style="color:var(--text-soft);max-width:720px">القراءة وحدها لا تصنع مختبِرًا. هنا منصّات التدريب القانونية التي تطبّق فيها ما تتعلّمه في بيئات مصمّمة لذلك — بأمان وقانونية تامّة.</p></div></header>' +
      '<section class="section" style="padding-top:12px"><div class="container"><div class="section-head"><h2 style="font-size:1.7rem">منصّات التدريب القانونية</h2>' +
      '<p>هذه المنصّات توفّر أهدافًا مصمّمة ليُتدرَّب عليها — لا تختبر أبدًا خارجها دون تفويض.</p></div>' +
      '<div class="grid grid-auto">' + cards + '</div></div></section>' +
      '<section class="section" style="padding-top:0"><div class="container"><div class="section-head"><h2 style="font-size:1.7rem">ابنِ معملك المنزلي المعزول</h2>' +
      '<p>أفضل بيئة تدريب هي التي تملكها بالكامل. إليك الهيكل الأساسي لمعمل آمن ومعزول عن الإنترنت.</p></div>' +
      '<div class="prose" style="max-width:860px">' +
      '<div class="callout callout-danger">' + I.alert + '<div><strong>العزل أولًا:</strong> آلات التدريب الضعيفة خطرة إن اتصلت بالإنترنت أو بشبكتك. اعزلها دائمًا في شبكة داخلية مغلقة قبل تشغيلها.</div></div>' +
      '<h3>المكوّنات الأساسية</h3><ol>' +
      '<li><strong>برنامج المحاكاة (Hypervisor):</strong> مثل VirtualBox (مجاني) أو VMware — لتشغيل عدّة أنظمة على جهازك.</li>' +
      '<li><strong>آلة المهاجم:</strong> توزيعة Kali Linux كآلة افتراضية.</li>' +
      '<li><strong>آلات الأهداف:</strong> أنظمة ضعيفة <em>مصمّمة للتدريب</em> مثل Metasploitable أو آلات VulnHub.</li>' +
      '<li><strong>شبكة معزولة:</strong> اضبط الشبكة على «Host-Only» أو «Internal» بحيث لا تصل الآلات للإنترنت أو لشبكتك الحقيقية.</li></ol>' +
      '<div class="callout callout-ok">' + I.check + '<div>مع هذا المعمل تستطيع تطبيق كل مراحل المنهج — من الفحص حتى ما بعد الاستغلال — دون أي خطر قانوني أو تقني.</div></div>' +
      '<h3>سير تدريب مقترح</h3><ul>' +
      '<li>ابدأ بـ <strong>OverTheWire</strong> لإتقان الطرفية وأساسيات لينُكس.</li>' +
      '<li>انتقل إلى مسارات <strong>TryHackMe</strong> الموجّهة للمبتدئين.</li>' +
      '<li>طبّق ثغرات الويب على <strong>PortSwigger Web Security Academy</strong>.</li>' +
      '<li>تحدَّ نفسك بآلات <strong>Hack The Box</strong> المتدرّجة.</li>' +
      '<li>ابنِ معملك الخاص بـ <strong>VulnHub</strong> لتجربة بلا قيود زمنية.</li></ul></div></div></section>';
  };

  V.certs = function () {
    var cards = CERTS.map(function (c) {
      return '<div class="card"><div class="flex items-center gap-sm wrap" style="margin-bottom:12px">' +
        '<span class="card-icon" style="margin:0;width:44px;height:44px">' + I.graduation + '</span>' +
        '<div><h3 style="margin:0;font-size:1.1rem">' + c.name + '</h3><span class="muted" style="font-size:.85rem">' + c.focus + '</span></div>' +
        '<span style="margin-inline-start:auto">' + lvl(c.level) + '</span></div>' +
        '<p style="color:var(--text-soft);font-size:.92rem;margin:0">' + c.note + '</p></div>';
    }).join("");
    return '<header class="section-sm" style="padding-top:56px;padding-bottom:20px"><div class="container">' +
      '<span class="eyebrow">المسار المهني</span><h1 style="font-size:clamp(2rem,4.5vw,3rem)">الشهادات و<span class="gradient-text">خريطة العمل</span></h1>' +
      '<p class="lead" style="color:var(--text-soft);max-width:720px">الشهادة تفتح الباب، والمهارة تبقيك في الغرفة. إليك خريطة الشهادات المعترف بها عالميًا مرتّبة حسب المستوى.</p></div></header>' +
      '<section class="section" style="padding-top:12px"><div class="container"><div class="grid grid-auto">' + cards + '</div></div></section>' +
      '<section class="section" style="padding-top:0"><div class="container"><div class="cta-band"><h2>المهارة قبل الشهادة</h2>' +
      '<p>ابدأ من المنهج، طبّق في المعامل، ثم توّج رحلتك بالشهادة المناسبة لمستواك.</p>' +
      '<a href="#/curriculum" class="btn btn-primary btn-lg">' + I.rocket + ' ابدأ المنهج الآن</a></div></div></section>';
  };

  /* --------------------------- Enhancers ------------------------------- */
  function initTerminal() {
    var box = $("#termBody"); if (!box) return;
    var lines = [
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
    var i = 0; box.innerHTML = "";
    (function add() {
      if (i >= lines.length) return;
      var l = lines[i++], div = document.createElement("div");
      div.className = "ln";
      var html = '<span class="' + l.t + '">' + l.txt + '</span>';
      if (l.cmd) html += '<span class="cm">' + l.cmd + '</span>';
      if (l.cursor) html += '<span class="cursor"></span>';
      div.innerHTML = html; box.appendChild(div);
      setTimeout(add, l.cmd ? 520 : 300);
    })();
  }
  function initReveal() {
    var els = $$(".reveal");
    if (!("IntersectionObserver" in window) || !els.length) { els.forEach(function (e) { e.classList.add("in"); }); return; }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    els.forEach(function (e) { io.observe(e); });
  }
  function initScrollSpy() {
    var links = $$("#lessonToc a[href^='#']"); if (!links.length) return;
    var secs = $$("#lessonContent section");
    var spy = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) links.forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id); });
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    secs.forEach(function (s) { spy.observe(s); });
    // منع قفز الـ hash الداخلي للأقسام من كسر التوجيه
    links.forEach(function (a) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        var el = document.getElementById(a.getAttribute("href").slice(1));
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }
  function wireLessons() {
    drawLessons();
    $$("#lessonFilters .chip").forEach(function (c) {
      c.addEventListener("click", function () {
        $$("#lessonFilters .chip").forEach(function (x) { x.classList.remove("active"); });
        c.classList.add("active");
        drawLessons(c.dataset.level, ($("#lessonSearch") || {}).value || "");
      });
    });
    var s = $("#lessonSearch");
    if (s) s.addEventListener("input", function () {
      var active = ($("#lessonFilters .chip.active") || {}).dataset;
      drawLessons(active ? active.level : "all", s.value);
    });
  }
  function wireTools() {
    drawTools();
    $$("#toolFilters .chip").forEach(function (c) {
      c.addEventListener("click", function () {
        $$("#toolFilters .chip").forEach(function (x) { x.classList.remove("active"); });
        c.classList.add("active"); drawTools(c.dataset.cat);
      });
    });
  }

  /* ----------------------------- Router -------------------------------- */
  function setActiveNav(route) {
    $$("#navLinks a").forEach(function (a) { a.classList.remove("active"); });
    var map = { home: "#/", curriculum: "#/curriculum", lessons: "#/lessons", lesson: "#/lessons", tools: "#/tools", labs: "#/labs", certs: "#/certs" };
    var href = map[route];
    if (href) { var el = $('#navLinks a[href="' + href + '"]'); if (el) el.classList.add("active"); }
  }
  function render() {
    var r = parseHash();
    var view = $("#view");
    document.title = "Support Control — أكاديمية الاختراق الأخلاقي";
    var html = V[r.route] ? (r.route === "lesson" ? V.lesson(r.id) : V[r.route]()) : V.home();
    view.innerHTML = html;
    // close mobile menu
    var nl = $("#navLinks"); if (nl) nl.classList.remove("open");
    var tg = $("#navToggle"); if (tg) tg.innerHTML = I.menu;
    setActiveNav(r.route);
    window.scrollTo(0, 0);
    // per-view wiring
    if (r.route === "home") initTerminal();
    if (r.route === "lessons") wireLessons();
    if (r.route === "tools") wireTools();
    if (r.route === "lesson") initScrollSpy();
    initReveal();
  }

  function boot() {
    document.getElementById("nav").outerHTML = navHTML("home");
    document.getElementById("footer").outerHTML = footHTML();
    var tg = $("#navToggle");
    if (tg) tg.addEventListener("click", function () {
      var lk = $("#navLinks"); lk.classList.toggle("open");
      tg.innerHTML = lk.classList.contains("open") ? I.x : I.menu;
    });
    window.addEventListener("hashchange", render);
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
