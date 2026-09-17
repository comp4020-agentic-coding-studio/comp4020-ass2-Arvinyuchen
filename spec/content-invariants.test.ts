// The promises this course makes that the build cannot keep for it.
//
// The build already owns compilation, accessibility, internal links, content
// refs, the API and the decks. What it cannot know is whether the course is
// safe to run, whether its claims carry their evidence, whether a stranger can
// read it, or whether the twelve weeks are actually twelve different weeks.
// Those are the six rules in CLAUDE.md, and they are what this file holds.
//
// Same shape as data-integrity.test.ts: read the built API, not the source, so
// the checks test what ships.

import { existsSync, globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { glossaryTerms } from "../src/glossary";

interface ApiNode {
  id: string;
  type: string;
  title: string;
  meta?: Record<string, unknown>;
}

interface CourseApi {
  nodes: ApiNode[];
}

const api = JSON.parse(readFileSync(resolve("dist/api/index.json"), "utf8")) as CourseApi;

/** The raw markdown of a node, from its per-entry API file. */
const bodyOf = (id: string): string => {
  const path = resolve("dist/api", `${id}.json`);
  if (!existsSync(path)) return "";
  const entry = JSON.parse(readFileSync(path, "utf8")) as { body?: string };
  return entry.body ?? "";
};

/** A node's body split into prose paragraphs, with everything that is not prose
 * removed: frontmatter is already gone, and headings, imports, JSX blocks,
 * lists, tables, blockquotes and fenced code are all dropped. What is left is
 * what a reader sees as a paragraph. */
const prosePargraphsOf = (id: string): string[] =>
  bodyOf(id)
    .replace(/```[\s\S]*?```/g, "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(
      (block) =>
        block.length > 0 &&
        !/^(#|>|\||import\s|export\s|<|-|\*|\d+\.)/.test(block),
    )
    .map((block) => block.replace(/\s+/g, " "));

const nodesOfType = (type: string): ApiNode[] => api.nodes.filter((node) => node.type === type);

// The twelve weeks live in `sessions`: the weekly lab is where an experiment
// actually gets run, so the session *is* the week. Considered a separate
// `weeks` collection and decided against it, it would have given every week
// two pages saying overlapping things.
const weeks = nodesOfType("sessions");
const assessments = nodesOfType("assessments");
const lectures = nodesOfType("lectures");

const weekNumber = (node: ApiNode): number => Number(node.meta?.week);
const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const TEACHING_WEEKS = 12;

// A course whose third rule is "explain every technical term" has to be honest
// about how much jargon it carries. Twelve weeks of methods vocabulary below
// this floor means terms are being quietly left undefined rather than named.
const MINIMUM_GLOSSARY_TERMS = 8;

// Set from the course's own prose rather than picked. After the week 1 rewrite
// its shortest paragraph runs 33 words and its median is well above that,
// while a stranded single sentence lands between 11 and 20. A floor of 25 sits
// in the gap: it fails every one-line paragraph found on the site and passes
// every real one.
const MINIMUM_LECTURE_PARAGRAPH_WORDS = 25;

// Appeals to authority that skip the number. Rule 2 exists to stop these.
const UNQUALIFIED_APPEALS = [
  "studies show",
  "studies have shown",
  "research proves",
  "research shows",
  "science says",
  "it is well known",
  "it's well known",
  "experts agree",
  "doctors recommend",
];

describe("rule 1: no experiment ships without a way to stop", () => {
  const RISK_LEVELS = ["low", "med", "high"];

  it("has every week state its risk level", () => {
    expect(weeks.length, "no weeks found in the API").toBeGreaterThan(0);
    for (const week of weeks) {
      const risk = str(week.meta?.risk);
      expect(
        RISK_LEVELS.includes(risk),
        `${week.id} must declare risk as one of ${RISK_LEVELS.join(", ")}, got ${JSON.stringify(week.meta?.risk)}`,
      ).toBe(true);
    }
  });

  it("gives every week above the lowest risk a stopping rule, a limit and an opt-out", () => {
    const risky = weeks.filter((week) => ["med", "high"].includes(str(week.meta?.risk)));
    for (const week of risky) {
      for (const field of ["stopping_rule", "harm_boundary", "opt_out"]) {
        expect(
          str(week.meta?.[field]).length,
          `${week.id} is risk ${str(week.meta?.risk)} and needs a non-empty ${field}`,
        ).toBeGreaterThan(0);
      }
    }
  });
});

describe("rule 2: a claim carries its own evidence", () => {
  it("gives every week at least one structured claim", () => {
    for (const week of weeks) {
      const claims = week.meta?.claims;
      expect(Array.isArray(claims), `${week.id} must declare a claims array`).toBe(true);
      expect(
        (claims as unknown[])?.length ?? 0,
        `${week.id} must make at least one claim it can stand behind`,
      ).toBeGreaterThan(0);
    }
  });

  // Tightened once every week had one. The schema comment promised this: the
  // first version of rule 2 accepted any claim, which a week could satisfy
  // with history alone and never show a measurement.
  it("has every week rest on at least one measurement", () => {
    for (const week of weeks) {
      const claims = Array.isArray(week.meta?.claims) ? (week.meta.claims as unknown[]) : [];
      const effects = claims.filter(
        (raw) => str((raw as Record<string, unknown>)?.kind) === "effect",
      );
      expect(
        effects.length,
        `${week.id} makes no claim about an effect: history alone is not evidence that anything works`,
      ).toBeGreaterThan(0);
    }
  });

  it("makes every claim about an effect state its sample size and blinding", () => {
    for (const week of weeks) {
      const claims = Array.isArray(week.meta?.claims) ? (week.meta.claims as unknown[]) : [];
      claims.forEach((raw, index) => {
        const claim = (raw ?? {}) as Record<string, unknown>;
        const where = `${week.id} claim ${index + 1}`;

        expect(str(claim.text).length, `${where} needs text`).toBeGreaterThan(0);
        expect(str(claim.source).length, `${where} needs a source`).toBeGreaterThan(0);
        expect(
          ["effect", "history"].includes(str(claim.kind)),
          `${where} must declare kind as "effect" or "history", got ${JSON.stringify(claim.kind)}`,
        ).toBe(true);

        // A claim about history has no sample size to report, the 10,000-step
        // target being a product name is a fact about 1965, not a measurement.
        // Only claims asserting an effect owe a number.
        if (str(claim.kind) !== "effect") return;

        const n = claim.n;
        expect(
          (typeof n === "number" && Number.isFinite(n) && n > 0) || n === "unreported",
          `${where} asserts an effect, so it needs n as a positive number or "unreported", got ${JSON.stringify(n)}`,
        ).toBe(true);

        const blinded = claim.blinded;
        expect(
          blinded === true || blinded === false || blinded === "n/a",
          `${where} asserts an effect, so it needs blinded as true, false or "n/a", got ${JSON.stringify(blinded)}`,
        ).toBe(true);
      });
    }
  });

  // Rule 2 for datasets rather than sentences. A figure drawn from published
  // data makes a claim as surely as a paragraph does, and the thing that makes
  // it checkable is not the numbers but where they came from, what licence they
  // arrive under, and what they cannot tell you. The UV figure exists only
  // because the Bureau publishes grids under CC BY; a copy of those numbers with
  // that fact left off would be unusable and unattributed at once.
  //
  // Every field here earned its place from that one dataset: period, because a
  // 1979 to 2007 average is not today; conditions, because these are cloud-free
  // noon values and the real advice keys off the daily forecast; grid, because
  // 1.5 degree cells describe a region and not a city. A future dataset with no
  // equivalent caveats still has to say so in these fields.
  it("gives every dataset its provenance, licence and limits", () => {
    const files = globSync("src/data/*.json");
    expect(files.length, "no datasets found: this check is pointing at nothing").toBeGreaterThan(0);

    for (const file of files) {
      const data = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
      const source = data._source as Record<string, unknown> | undefined;
      expect(source, `${file} must carry a _source block`).toBeTruthy();

      for (const field of [
        "dataset",
        "publisher",
        "url",
        "licence",
        "licence_url",
        "period",
        "how_these_numbers_were_made",
      ] as const) {
        expect(
          str(source?.[field]).length,
          `${file} needs _source.${field}: a dataset without it cannot be checked or credited`,
        ).toBeGreaterThan(0);
      }

      expect(
        str(source?.url).startsWith("http"),
        `${file} needs _source.url to be a resolvable address, got ${JSON.stringify(source?.url)}`,
      ).toBe(true);
    }
  });

  it("never waves at research instead of citing it", () => {
    for (const node of api.nodes) {
      const body = bodyOf(node.id).toLowerCase();
      if (!body) continue;
      for (const phrase of UNQUALIFIED_APPEALS) {
        expect(
          body.includes(phrase),
          `${node.id} says "${phrase}": name the study and its sample size instead`,
        ).toBe(false);
      }
    }
  });
});

describe("rule 3: a stranger can read this course", () => {
  it("names the course's jargon in the glossary", () => {
    expect(
      glossaryTerms.length,
      `the glossary declares ${glossaryTerms.length} terms; a twelve-week methods course carries at least ${MINIMUM_GLOSSARY_TERMS}`,
    ).toBeGreaterThanOrEqual(MINIMUM_GLOSSARY_TERMS);
  });

  it("gives every term a slug and a definition", () => {
    for (const entry of glossaryTerms) {
      expect(entry.slug, `"${entry.term}" needs a url-safe slug`).toMatch(/^[a-z0-9-]+$/);
      expect(
        entry.definition.trim().length,
        `"${entry.term}" needs a definition`,
      ).toBeGreaterThan(0);
    }
  });

  // A lecture paragraph carrying one sentence is a formatting habit, not a
  // unit of argument. The three blocks under "Find the guidelines that suit
  // you" were each built as three beats and each beat was given its own
  // paragraph, which on screen read as three stranded lines instead of one
  // case: "The same rule gives different instructions at different latitudes."
  // sitting alone above the evidence for it.
  //
  // Labs are deliberately exempt, and the exemption is the point rather than a
  // loophole. A protocol step is an instruction, and "This week you do not
  // measure anything." is doing its whole job in seven words. Lectures argue,
  // so a lecture paragraph owes the reader a claim and its support together.
  // If a lecture ever genuinely needs a one-line beat, move that line into a
  // Callout, which is the component for exactly that and is not prose.
  it("builds lecture paragraphs out of arguments, not single sentences", () => {
    for (const lecture of lectures) {
      prosePargraphsOf(lecture.id).forEach((paragraph) => {
        const words = paragraph.split(/\s+/).filter(Boolean).length;
        expect(
          words,
          `${lecture.id} has a ${words}-word paragraph: "${paragraph.slice(0, 60)}...". A lecture paragraph states a claim and supports it, so it runs to at least ${MINIMUM_LECTURE_PARAGRAPH_WORDS} words`,
        ).toBeGreaterThanOrEqual(MINIMUM_LECTURE_PARAGRAPH_WORDS);
      });
    }
  });

  it("links to the glossary from the first week that uses each term", () => {
    for (const entry of glossaryTerms) {
      const spellings = [entry.term, ...(entry.aliases ?? [])];
      const pattern = new RegExp(
        `\\b(${spellings.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
        "i",
      );

      const usedIn = weeks
        .filter((week) => pattern.test(bodyOf(week.id)))
        .sort((a, b) => weekNumber(a) - weekNumber(b));

      if (usedIn.length === 0) continue; // declared but unused: rule 3 has nothing to say

      const first = usedIn[0];
      expect(
        bodyOf(first.id).includes(`/glossary/#${entry.slug}`),
        `week ${weekNumber(first)} (${first.id}) is the first to use "${entry.term}" and must link it to /glossary/#${entry.slug}`,
      ).toBe(true);
    }
  });
});

describe("rule 4: nothing is taught before what it depends on", () => {
  it("has every week declare what it builds on", () => {
    for (const week of weeks) {
      expect(
        Array.isArray(week.meta?.needs),
        `${week.id} must declare a needs array (empty is fine for week 1)`,
      ).toBe(true);
    }
  });

  it("only builds on earlier weeks that exist", () => {
    const present = new Set(weeks.map(weekNumber));
    for (const week of weeks) {
      const needs = Array.isArray(week.meta?.needs) ? (week.meta.needs as unknown[]) : [];
      for (const need of needs) {
        const n = Number(need);
        expect(
          Number.isInteger(n) && present.has(n),
          `${week.id} builds on week ${JSON.stringify(need)}, which does not exist`,
        ).toBe(true);
        expect(
          n < weekNumber(week),
          `${week.id} is week ${weekNumber(week)} and cannot build on week ${n}`,
        ).toBe(true);
      }
    }
  });
});

describe("rule 5: twelve weeks, twelve different methods", () => {
  // The course teaches realisation, then change, then rethinking, and the
  // twelve weeks are that spine. A week that doubled back, a rethinking week
  // before a change week, would break the argument the course makes about
  // itself, and prose alone would not stop it.
  const PHASES = ["realisation", "change", "rethinking"];

  it("runs the three moves in order, with every week in one of them", () => {
    const ordered = [...weeks].sort((a, b) => weekNumber(a) - weekNumber(b));
    let furthest = 0;
    for (const week of ordered) {
      const phase = str(week.meta?.phase);
      expect(
        PHASES.includes(phase),
        `${week.id} must declare phase as one of ${PHASES.join(", ")}, got ${JSON.stringify(week.meta?.phase)}`,
      ).toBe(true);
      const index = PHASES.indexOf(phase);
      expect(
        index >= furthest,
        `week ${weekNumber(week)} is ${phase}, which comes before ${PHASES[furthest]}: the three moves run in order and do not double back`,
      ).toBe(true);
      furthest = Math.max(furthest, index);
    }
  });

  it("uses all three moves", () => {
    const used = new Set(weeks.map((week) => str(week.meta?.phase)));
    for (const phase of PHASES) {
      expect(used.has(phase), `no week belongs to "${phase}"`).toBe(true);
    }
  });

  it("runs across all twelve teaching weeks, once each", () => {
    expect(weeks.length, `expected ${TEACHING_WEEKS} weeks, found ${weeks.length}`).toBe(
      TEACHING_WEEKS,
    );
    const numbers = weeks.map(weekNumber).sort((a, b) => a - b);
    expect(numbers, "weeks must be numbered 1 to 12 with no gaps or repeats").toEqual(
      Array.from({ length: TEACHING_WEEKS }, (_, i) => i + 1),
    );
  });

  it("never reuses a method", () => {
    const methods = weeks.map((week) => ({ id: week.id, method: str(week.meta?.method) }));
    for (const { id, method } of methods) {
      expect(method.length, `${id} must name the method it teaches`).toBeGreaterThan(0);
    }
    const seen = new Map<string, string>();
    for (const { id, method } of methods) {
      const previous = seen.get(method);
      expect(
        previous,
        `${id} reuses the method "${method}", already used by ${previous}: twelve interchangeable weeks is the failure this course risks most`,
      ).toBeUndefined();
      seen.set(method, id);
    }
  });
});

describe("rule 6: the assessment adds up", () => {
  it("totals exactly 100%", () => {
    expect(assessments.length, "no assessments found").toBeGreaterThan(0);
    const total = assessments.reduce((sum, item) => sum + Number(item.meta?.weight ?? 0), 0);
    expect(
      total,
      `assessment weights total ${total}: ${assessments
        .map((a) => `${a.id}=${a.meta?.weight}`)
        .join(", ")}`,
    ).toBe(100);
  });

  it("never assesses a week before it is taught", () => {
    for (const assessment of assessments) {
      const assesses = assessment.meta?.assesses;
      expect(
        Array.isArray(assesses),
        `${assessment.id} must declare which weeks it assesses`,
      ).toBe(true);
      const list = Array.isArray(assesses) ? (assesses as unknown[]) : [];
      expect(list.length, `${assessment.id} must assess at least one week`).toBeGreaterThan(0);
      for (const week of list) {
        const n = Number(week);
        expect(
          n <= weekNumber(assessment),
          `${assessment.id} is due in week ${weekNumber(assessment)} but assesses week ${n}`,
        ).toBe(true);
      }
    }
  });
});
