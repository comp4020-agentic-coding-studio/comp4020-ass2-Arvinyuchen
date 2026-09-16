// Estimated reading time, from the raw markdown of a collection entry.
//
// Counted on the source rather than the rendered page because the source is
// what we have at build time. That means stripping the things a reader never
// sees — HTML comments, code fences, link targets, markdown punctuation —
// before counting, or a page thick with citations reads as longer than it is.
//
// 200 words a minute is the conventional figure for careful reading of prose.
// It is an estimate and the page says so by rounding to whole minutes: the
// number is there to tell a reader whether they have time now, not to be
// accurate to the second.

const WORDS_PER_MINUTE = 200;

export function countWords(markdown: string): number {
  const prose = markdown
    .replace(/<!--[\s\S]*?-->/g, " ") // HTML comments
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links keep their text
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // heading markers
    .replace(/[*_~>|]/g, " ") // emphasis, quotes, table pipes
    .replace(/\s+/g, " ")
    .trim();
  return prose ? prose.split(" ").length : 0;
}

/** Whole minutes, never zero — a one-line page still takes a moment. */
export function readingMinutes(markdown: string): number {
  return Math.max(1, Math.round(countWords(markdown) / WORDS_PER_MINUTE));
}
