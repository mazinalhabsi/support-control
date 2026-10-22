# Third-party notices

## React Bits

Parts of `src/components/fx/` are adapted from [React Bits](https://github.com/DavidHDev/react-bits)
(SplitText, ScrollReveal, SpotlightCard, Magnet, ClickSpark; CountUp and RotatingText are re-implemented on GSAP after the React Bits originals).
They are used here as part of this application and are not redistributed on their own.

```
MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software as part of an
application, website, or product, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

Commons Clause Restriction: You may use this Software, including for any
commercial purpose, so long as you do not sell, sublicense, or redistribute the
components themselves-whether alone, in a bundle, or as a ported version.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

## GSAP

[GSAP](https://gsap.com) (core, ScrollTrigger, SplitText, Physics2DPlugin, `@gsap/react`) is used under the
GSAP Standard "no charge" License: https://gsap.com/standard-license

## Lenis

[Lenis](https://github.com/darkroomengineering/lenis) smooth scrolling — MIT License, © darkroom.engineering.

## FSRS

Review scheduling implements the [FSRS-4.5](https://github.com/open-spaced-repetition/fsrs4anki) algorithm with its published default parameters.

## three.js

[three.js](https://threejs.org) — MIT License, © 2010–2026 three.js authors. Used at runtime for the
live gem orbit on the landing page, and offline (`scripts/render-3d/`) to render the 3D object set.

## Motion

[Motion](https://motion.dev) (`motion/react`) — MIT License, © Motion Division. Springs, gestures and layout
transitions (dock magnification, tab and segmented-control pills, bottom sheet, achievement island).

## Render-only inputs (not shipped)

`scripts/render-3d/fetch-assets.sh` downloads, for rendering only:

- HDR environment maps from the three.js examples, originally from [Poly Haven](https://polyhaven.com) — CC0.
- Bodoni Moda and Kufam from Google Fonts — SIL Open Font License 1.1 — to extrude real letterforms.
- [opentype.js](https://github.com/opentypejs/opentype.js) — MIT License.

The rendered images in `src/assets/3d/` are original work of this project.

## Fonts

Loaded from Google Fonts under the SIL Open Font License 1.1: Atkinson Hyperlegible Next, Bodoni Moda,
Gentium Book Plus, IBM Plex Sans Arabic, Kufam.
