/* =========================================================================
   build.js — يولّد ملف index.html مستقلًّا (CSS + JS مدمجة بالكامل)
   التشغيل:  node build.js
   المصدر القابل للتعديل يبقى في assets/ ؛ هذا السكربت يعيد توليد index.html
   ========================================================================= */
const fs = require("fs");
const path = require("path");

const root = __dirname;
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const css = read("assets/css/styles.css");
const icons = read("assets/js/icons.js");
const data = read("assets/js/data.js");
const spa = read("assets/js/spa.js");

const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Support Control — أكاديمية الاختراق الأخلاقي</title>
<meta name="description" content="منصّة تعليمية متخصّصة في الاختراق الأخلاقي والأمن الهجومي، من الصفر إلى الاحتراف: دروس مفصّلة، أدوات، معامل، وتمارين عملية بإطار أخلاقي وقانوني. ملف واحد مستقل." />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><text y='18' font-size='18'>🛡️</text></svg>" />
<style>
${css}
</style>
</head>
<body dir="rtl">
<div id="nav"></div>
<main id="view"></main>
<div id="footer"></div>

<!-- =============== الأيقونات =============== -->
<script>
${icons}
</script>
<!-- =============== المحتوى (المنهج/الدروس/الأدوات) =============== -->
<script>
${data}
</script>
<!-- =============== تطبيق الصفحة الواحدة =============== -->
<script>
${spa}
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(root, "index.html"), html, "utf8");
const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(1);
console.log(`✓ تم توليد index.html المستقل (${kb} KB)`);
