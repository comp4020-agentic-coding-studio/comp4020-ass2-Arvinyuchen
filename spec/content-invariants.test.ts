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

import { existsSync, readFileSync } from "node:fs";
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

const nodesOfType = (type: string): ApiNode[] => api.nodes.filter((node) => node.type === type);

// The twelve weeks live in `sessions`: the weekly lab is where an experiment
// actually gets run, so the session *is* the week. Considered a separate
// `weeks` collection and decided against it, it would have given every week
// two pages saying overlapping things.
const weeks = nodesOfType("sessions");
const assessments = nodesOfType("assessments");

const weekNumber = (node: ApiNode): number => Number(node.meta?.week);
const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const TEACHING_WEEKS = 12;

// A course whose third rule is "explain every technical term" has to be honest
// about how much jargon it carries. Twelve weeks of methods vocabulary below
// this floor means terms are being quietly left undefined rather than named.
const MINIMUM_GLOSSARY_TERMS = 8;

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
