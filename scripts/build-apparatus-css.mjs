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

const css = `/* Apparatus sections. GENERATED, see scripts/build-apparatus-css.mjs.
 *
 * A lab page had seven h2s at the same size doing two different jobs: three
 * were the lesson, four were the recurring machinery around it, the evidence,
 * the spec, the teaching team, the related links. A reader could not
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
 * decorative (::before content is not announced) and the label text carries
 * the meaning on its own.
 */

${labels} {
  display: flex;
  align-items: center;
  gap: 0.5em;
  margin-block: var(--at-spacing-xl) var(--at-spacing-sm);
  color: var(--at-text-secondary);
  line-height: 1.3;

  /* !important for the same reason as the list below: RelatedContent styles
   * its own h2 with font-size, letter-spacing and text-transform, and its
   * scoped selector ties with anything written here. Without this the RELATED
   * label rendered at 18px and 0.9px tracking while the other three sat at
   * 19.125px and 1.53px, a difference small enough to miss and wrong enough
   * to notice once seen. */
  font-size: var(--at-font-size-h4) !important;
  letter-spacing: 0.08em !important;
  text-transform: uppercase !important;
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

/* The group of them, set off from the prose it follows.
 *
 * The rule was --at-bg-alt, which is a surface tint: against a near-white page
 * it was all but invisible, so the one structural division on the page did not
 * read as one. color-mix off currentColor is the convention the theme uses for
 * its own rules, and it follows the text colour into dark mode instead of
 * staying a light-mode tint. */
.apparatus {
  margin-block-start: var(--at-spacing-2xl, 3rem);
  border-block-start: 1px solid color-mix(in srgb, currentColor 25%, transparent);
}

.apparatus > :first-child > h2 {
  margin-block-start: var(--at-spacing-lg);
}

/* RelatedContent ships its own rule and 3rem of space above itself. Inside the
 * group that renders as a second divider, so the block a reader is meant to
 * take as one thing arrives as two. Suppress it here and let the group's own
 * rule be the only one.
 *
 * The doubled class is deliberate. The package's style is Astro-scoped, so it
 * lands at .related-content[data-astro-cid-…], the same specificity as
 * .apparatus .related-content, and a tie would be settled by whichever
 * stylesheet the bundler happened to order last. Repeating the class wins
 * outright instead of relying on that. */
.apparatus .related-content.related-content {
  margin-block-start: var(--at-spacing-xl);
  padding-block-start: 0;
  border-block-start: 0;
}

/* And its list is a list. The package styles it as a horizontal chip row, with
 * list-style: none, no indent and display: flex, which sat directly under
 * Teaching team's ordinary bulleted list and made two lists of the same kind
 * look like two different things.
 *
 * The revert keyword rather than hard-coded values: it drops the component's
 * own declarations and lets the list land wherever every other list on the
 * site lands, so the two cannot drift apart if list styling changes later.
 *
 * !important because this rule cannot out-specify the component. Astro scopes
 * both halves of its selector, so .related-content[cid] ul[cid] counts three
 * class-level tokens and one element, which ties with anything sensible here,
 * and a tie is settled by source order. That order differs between a full
 * load and a ClientRouter swap, which is why the bullets were missing when
 * you reached a page through a link and present after a refresh: same CSS,
 * different winner, depending on how you arrived. */
.apparatus .related-content ul {
  display: revert !important;
  list-style: revert !important;
  padding-inline-start: revert !important;
}
`;

writeFileSync(new URL("../src/styles/apparatus.css", import.meta.url), css);
console.log(`apparatus.css: ${selectors.length} icons, ${css.length} bytes`);
