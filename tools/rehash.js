#!/usr/bin/env node
/*
 * يعيد تسمية ملفي الواجهة (app.*.js و app.*.css) ببصمة محتواهما ويحدّث index.html.
 * ملفات assets تُحفظ في المتصفح سنة كاملة (immutable في .htaccess)، فأي تعديل عليها بلا اسم جديد
 * لا يصل الأجهزة التي فتحت النظام من قبل. شغّله بعد كل تعديل على الملفين:
 *
 *   node tools/rehash.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'assets');
const indexPath = path.join(root, 'index.html');
let index = fs.readFileSync(indexPath, 'utf8');
let changed = 0;

for (const ext of ['js', 'css']) {
  const re = new RegExp(`^app\\.[0-9a-f]{10}\\.${ext}$`);
  const files = fs.readdirSync(assets).filter((f) => re.test(f));
  if (files.length !== 1) throw new Error(`expected exactly one app.*.${ext} in assets/, found ${files.length}`);
  const oldName = files[0];
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(assets, oldName))).digest('hex').slice(0, 10);
  const newName = `app.${hash}.${ext}`;
  if (!index.includes(`assets/${oldName}`)) throw new Error(`index.html does not reference assets/${oldName}`);
  if (newName === oldName) { console.log(`${oldName}: unchanged`); continue; }
  fs.renameSync(path.join(assets, oldName), path.join(assets, newName));
  index = index.split(`assets/${oldName}`).join(`assets/${newName}`);
  console.log(`${oldName} -> ${newName}`);
  changed++;
}
if (changed) fs.writeFileSync(indexPath, index);
