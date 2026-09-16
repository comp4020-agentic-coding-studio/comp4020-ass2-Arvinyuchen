// The course's vocabulary, in one place.
//
// Rule 3 in CLAUDE.md says every technical term is explained the first time a
// reader meets it. That rule needs a list of what counts as technical, and the
// list has to be the same one the glossary page renders — otherwise the page
// and the check drift apart, and the check starts passing for the wrong reason.
//
// So this array is the single source of truth: /glossary/ renders it, and
// spec/content-invariants.test.ts reads it to find the first week that uses
// each term.

export interface GlossaryTerm {
  /** The term as a reader meets it in prose. Matched case-insensitively. */
  term: string;
  /** Fragment id on /glossary/. Lowercase letters, digits and hyphens. */
  slug: string;
  /** Plain-language definition, for a reader with no statistics background. */
  definition: string;
  /** Other spellings that should count as the same term (plurals, variants). */
  aliases?: string[];
}

export const glossaryTerms: GlossaryTerm[] = [];
