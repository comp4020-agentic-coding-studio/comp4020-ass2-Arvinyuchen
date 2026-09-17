// Regenerates src/styles/apparatus.css.
//
// The apparatus section labels carry iconoir glyphs as CSS mask data URIs
// rather than as markup, because two of the five sections (SpecList,
// RelatedContent) are package components whose <h2> cannot be reached from
// here. Driving all five from CSS keeps them identical.
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
// Order matters: this is also the order the sections are written in, and the
// divider rule below leans on it only to the extent that every one of them is
// a direct child of .apparatus.
const ICONS = {
  ".claims-section": "stats-report",
  ".spec-list": "task-list",
  ".protocol-section": "flask",
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
 * were the lesson, the rest were the recurring machinery around it, the
 * evidence, the spec, the protocol, the teaching team, the related links. A
 * reader could not tell them apart, so the page shouted at one volume
 * throughout.
 *
 * These five keep their h2 semantics, because they really are page-level
 * sections and the document outline should say so. What changes is weight:
 * they read as small labels, so the only full-size headings left on a page are
 * the ones carrying the teaching.
 *
 * The icons are masks rather than markup because two of the five sections are
 * rendered by package components whose h2 cannot be reached from here. Driving
 * all five from CSS keeps them identical instead of icons on some. They are
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
  /* One indent for everything itemised inside the block, declared once here
   * and read by the sections that have to line up with each other, including
   * Claims.astro, which is a scoped component and cannot see this file's
   * selectors but can read this property. */
  --apparatus-indent: 1.2em;

  margin-block-start: var(--at-spacing-2xl, 3rem);
  border-block-start: 1px solid color-mix(in srgb, currentColor 25%, transparent);
}

.apparatus > :first-child > h2 {
  margin-block-start: var(--at-spacing-lg);
}

/* Each section divided from the next.
 *
 * Five labelled blocks stacked in a column with nothing between them read as
 * one block with five labels in it, which is exactly how the apparatus looked:
 * the teaching team's bulleted list sat under the spec's bulleted list at the
 * same size and the same indent, and the only thing saying where one ended and
 * the next began was a line of small uppercase text. A hairline is the
 * cheapest thing that says these are separate, and --at-divider is the theme's
 * own token for it, light-dark() so it follows the theme switch.
 *
 * The border earns its keep twice: it also stops each section's label margin
 * collapsing up through the top of the section, which is what turns that
 * margin into the space above the label rather than space that lands
 * somewhere else on the page. */
.apparatus > * + * {
  border-block-start: 1px solid var(--at-divider);
}

/* And spaced evenly on both sides of it. Each section ends on whatever its
 * last element happened to leave behind, which was 1em under a list and
 * nothing at all under the claims, so the hairline sat 12px below one section
 * and 18px below the next while always sitting 32px above the label after it.
 * Dropping the trailing margin and setting the gap on the section itself makes
 * every division the same on all twelve pages. */
.apparatus > * {
  padding-block-end: var(--at-spacing-lg);
}

.apparatus > * > :last-child {
  margin-block-end: 0;
}

/* One left edge for the itemised content.
 *
 * The four blocks disagreed about where their content started: the claims sat
 * 18px in behind a rule, the bulleted lists 40px in at the browser default,
 * and the spec's preamble sentence flush at 0. Three left edges inside one
 * block is what made it read as a pile rather than a set. Labels, preambles
 * and label/value pairs start at the content edge; anything itemised is
 * indented by the one indent above, with its markers hanging in that space. */
.apparatus ul {
  padding-inline-start: var(--apparatus-indent);
}

/* The spec's preamble belongs to its label, not to the page. At body size it
 * was a paragraph of prose in a block that holds no prose, which is why the
 * section read as though the lesson had started again. */
.spec-list > p {
  margin-block: 0 var(--at-spacing-sm);
  color: var(--at-text-secondary);
  font-size: 0.9rem;
}

/* RelatedContent ships its own rule and 3rem of space above itself, neither of
 * which matches what the four sections beside it now do. The rule is redrawn
 * here in the divider's own token and the space is handed back to the label's
 * margin, so the last section in the group is spaced and divided like the rest
 * of it rather than like a block that arrived from somewhere else.
 *
 * The doubled class is deliberate. The package's style is Astro-scoped, so it
 * lands at .related-content[data-astro-cid-…], the same specificity as
 * .apparatus .related-content, and a tie would be settled by whichever
 * stylesheet the bundler happened to order last. Repeating the class wins
 * outright instead of relying on that. */
.apparatus .related-content.related-content {
  margin-block-start: 0;
  padding-block-start: 0;
  border-block-start: 1px solid var(--at-divider);
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

  /* The indent is the shared token rather than "revert", unlike the two above
   * it. "revert" would hand this list back to the UA default of 40px, which is
   * where every list on the site used to land and is no longer where the lists
   * beside it land. Reverting to a value nothing else uses any more would put
   * the drift back rather than remove it. */
  padding-inline-start: var(--apparatus-indent) !important;
}
`;

writeFileSync(new URL("../src/styles/apparatus.css", import.meta.url), css);
console.log(`apparatus.css: ${selectors.length} icons, ${css.length} bytes`);
