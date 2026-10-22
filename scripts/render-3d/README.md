# Talaqa 3D object set

Every 3D icon in the app (`src/assets/3d/*.webp`) is modelled in code here and rendered offline
with three.js: no stock art, no icon packs.

- `icons.js` holds the models: the six level gems (Platonic solids growing in facets, then a
  brilliant cut for C2, in enamel framed by brass wire), the section objects (astrolabe, books,
  flashcards, metronome, microphone, open book, arch, letter tiles, wax seal, compass, headphones),
  the studio modes and the goal objects. Letters on the tiles and the seal are extruded from the
  real Bodoni Moda and Kufam outlines.
- `lib.js` is the studio: one material palette (lacquer, brass, porcelain, paper, enamel), a studio
  environment plus a CC0 HDR for metal reflections, a soft key light with a contact shadow, and
  framing from each object's projected silhouette so every icon fills the frame the same way.
- `render.mjs` drives headless Chromium (WebGL2 works on SwiftShader), renders each object at 2×
  and writes a 384 px WebP with transparency.

```bash
./scripts/render-3d/fetch-assets.sh              # HDRs, fonts, opentype.js into .cache/
node scripts/render-3d/render.mjs                 # all icons
node scripts/render-3d/render.mjs streak xp --sheet /tmp/sheet.png   # some icons + a contact sheet
```

To add an object, write a builder in `icons.js` that returns `{ obj, view }`, add its name to
`ICONS`, render it, and add the name to `IconName` in `src/components/Icon3D.tsx`.
