// Regenerates src/styles/apparatus.css.
//
// The apparatus section labels carry iconoir glyphs as CSS mask data URIs
// rather than as markup, because two of the four sections (SpecList,
// RelatedContent) are package components whose <h2> cannot be reached from
// here. Driving all four from CSS keeps them identical.
//
// Run with:  node scripts/build-apparatus-css.mjs
//
// Committed output, not a build step: the icon set is a dependency that only
// changes when the dependency does, and a generated file in the repo is easier
// to review than a generator in the build.

import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const load = createRequire(import.meta.url);
const set = load("@iconify-json/iconoir/icons.json");
const W = set.width ?? 24;
const H = set.height ?? 24;

// One glyph per recurring section. Icons help a reader skip machinery they
// have already seen; they are noise on prose headings, which differ each week.
const ICONS = {
  ".claims-section": "stats-report",
  ".spec-list": "task-list",
  ".teaching-team": "group",
  ".related-content": "link",
};

const dataUri = (name) => {
  const icon = set.icons[name];
  if (!icon) throw new Error(`iconoir has no icon named "${name}"`);
  // currentColor does not resolve inside a data URI; for a mask only the alpha
  // channel matters, so any opaque colour works.
  const body = icon.body.replaceAll("currentColor", "#000");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${icon.width ?? W} ${icon.height ?? H}'>${body}</svg>`;
  return svg.replaceAll("#", "%23").replaceAll('"', "'").replaceAll("<", "%3C").replaceAll(">", "%3E");
};

const selectors = Object.keys(ICONS);
const labels = selectors.map((s) => `${s} > h2`).join(",\n");
const markers = selectors.map((s) => `${s} > h2::before`).join(",\n");
const perIcon = selectors
  .map((s) => `${s} > h2::before {\n  mask-image: url("data:image/svg+xml,${dataUri(ICONS[s])}");\n}`)
  .join("\n\n");

const css = `/* Apparatus sections. GENERATED — see scripts/build-apparatus-css.mjs.
 *
 * A lab page had seven h2s at the same size doing two different jobs: three
 * were the lesson, four were the recurring machinery around it — the evidence
 * table, the spec, the teaching team, the related links. A reader could not
 * tell them apart, so the page shouted seven times at one volume.
 *
 * These four keep their h2 semantics, because they really are page-level
 * sections and the document outline should say so. What changes is weight:
 * they read as small labels, so the only full-size headings left on a page are
 * the ones carrying the teaching.
 *
 * The icons are masks rather than markup because two of the four sections are
 * rendered by package components whose h2 cannot be reached from here. Driving
 * all four from CSS keeps them identical instead of icons-on-some. They are
 * decorative — ::before content is not announced — and the label text carries
 * the meaning on its own.
 */

${labels} {
  display: flex;
  align-items: center;
  gap: 0.5em;
  margin-block: var(--at-spacing-xl) var(--at-spacing-sm);
  color: var(--at-text-secondary);
  font-size: var(--at-font-size-h4);
  line-height: 1.3;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

${markers} {
  content: "";
  flex: none;
  width: 1.1em;
  height: 1.1em;
  background-color: currentColor;
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
}

${perIcon}

/* The group of them, set off from the prose it follows. */
.apparatus {
  margin-block-start: var(--at-spacing-2xl, 3rem);
  border-block-start: 1px solid var(--at-bg-alt);
}

.apparatus > :first-child > h2 {
  margin-block-start: var(--at-spacing-lg);
}
`;

writeFileSync(new URL("../src/styles/apparatus.css", import.meta.url), css);
console.log(`apparatus.css: ${selectors.length} icons, ${css.length} bytes`);
