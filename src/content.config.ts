import { defineCollection, reference } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { courseNodeSchema } from "astro-course-university/schemas";

const weekSchema = z.coerce.number().int().min(1).max(12);
const courseNodeLoader = (dir: string) =>
  glob({ pattern: ["**/*.{md,mdx}", "!**/CLAUDE.md"], base: `src/content/${dir}` });
const teacherRefs = z.array(reference("people")).min(1);

// How much a week's experiment can cost the student who runs it. Weeks 3, 5, 7
// and 11 ask people to change their sleep, their eating and their caffeine.
const riskSchema = z.enum(["low", "med", "high"]);

// Rule 2 in CLAUDE.md: a claim carries its own evidence. Claims are structured
// rather than prose so the numbers cannot quietly go missing.
//
// Split by kind. The first version of this schema demanded a sample size from
// every claim, and the first real week broke it: "the 10,000-step target began
// as a product name, not a finding" is a historical fact with no n to report,
// and recording it as `unreported` would have been a lie about *why* the number
// is missing. CLAUDE.md says to fix the harness rather than work around it, so
// the schema now separates claims about effects from claims about history.
//
// The teeth stay where they matter: anything asserting an effect still has to
// show its sample size and say whether it was blinded.
const effectClaim = z.strictObject({
  kind: z.literal("effect"),
  text: z.string().trim().min(1),
  // A number, or an explicit admission that the source never published one.
  // Guessing would be the exact error this course is about.
  n: z.union([z.number().int().positive(), z.literal("unreported")]),
  // What `n` counts. Defaults to people, because most claims count people —
  // but a systematic review counts trials, a pooled analysis counts studies,
  // and the fMRI demonstration in week 11 counts one salmon. Rendering all of
  // those as "people" would have printed a false statement on the page, which
  // is how this field came to exist.
  unit: z.string().trim().min(1).default("people"),
  // "n/a" for observational work, which cannot be blinded. Pretending
  // otherwise is worse than admitting it.
  blinded: z.union([z.boolean(), z.literal("n/a")]),
  source: z.string().trim().min(1),
});

// Strict on both sides, which closes one specific dodge: relabelling an effect
// claim as history while leaving its `n` and `blinded` in place. A history
// claim carrying a sample size is incoherent, and the build now says so.
//
// It does not close the general hole — see spec/FALSIFICATION.md. Someone who
// relabels a claim *and* deletes its numbers is simply lying about what kind of
// claim it is, and no schema can tell.
const historyClaim = z.strictObject({
  kind: z.literal("history"),
  text: z.string().trim().min(1),
  source: z.string().trim().min(1),
});

const claimSchema = z.discriminatedUnion("kind", [effectClaim, historyClaim]);

// The duty of care, enforced at build time rather than only in spec/.
//
// The deploy job in .github/workflows/checks.yml deliberately does not depend
// on the check job — a red spec test is a finding about the course, not a
// reason to take the site down. That is the right call for most checks and the
// wrong one for this rule: a spec-only version would let a week with no
// stopping rule deploy anyway. Failing the build is what actually prevents it
// shipping, so this obligation lives here as well.
const requireDutyOfCare = (
  week: { risk?: "low" | "med" | "high"; stopping_rule?: string; harm_boundary?: string; opt_out?: string },
  ctx: z.RefinementCtx,
) => {
  if (week.risk !== "med" && week.risk !== "high") return;
  for (const field of ["stopping_rule", "harm_boundary", "opt_out"] as const) {
    if (!week[field]?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: `a risk-${week.risk} week cannot ship without ${field}`,
      });
    }
  }
};

const weightedMarking = z
  .object({
    mode: z.literal("weighted"),
    criteria: z
      .array(z.object({ name: z.string().trim().min(1), weight: z.number().positive() }))
      .min(1),
  })
  .superRefine((marking, ctx) => {
    const total = marking.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
    if (total !== 100) {
      ctx.addIssue({
        code: "custom",
        path: ["criteria"],
        message: `criterion weights sum to ${total}, not 100`,
      });
    }
  });

const holisticMarking = z.object({
  mode: z.literal("holistic"),
  description: z.string().trim().min(40),
});

export const collections = {
  // The twelve weeks. A session is the lab where a week's experiment actually
  // gets run, so the session is the week — there is no separate `weeks`
  // collection, which would have given every week two pages saying overlapping
  // things.
  //
  // The new fields are optional here while the course is being written; the
  // checks in spec/content-invariants.test.ts require them. Once all twelve
  // weeks declare them, tighten `method` and `risk` to required so a week
  // cannot ship by omission.
  sessions: defineCollection({
    loader: courseNodeLoader("sessions"),
    schema: courseNodeSchema
      .extend({
        week: weekSchema,
        date: z.coerce.date(),
        teachers: teacherRefs.optional(),
        // What this week teaches that no other week does (rule 4).
        method: z.string().trim().min(1).optional(),
        // Which part of a day it takes apart.
        component: z.string().trim().min(1).optional(),
        // Earlier weeks this one builds on (rule 5).
        needs: z.array(weekSchema).default([]),
        risk: riskSchema.optional(),
        stopping_rule: z.string().trim().min(1).optional(),
        harm_boundary: z.string().trim().min(1).optional(),
        opt_out: z.string().trim().min(1).optional(),
        claims: z.array(claimSchema).default([]),
      })
      .loose()
      .superRefine(requireDutyOfCare),
  }),

  assessments: defineCollection({
    loader: courseNodeLoader("assessments"),
    schema: courseNodeSchema
      .extend({
        week: weekSchema,
        due: z.coerce.date(),
        weight: z.coerce.number().positive().max(100),
        marking: z.discriminatedUnion("mode", [weightedMarking, holisticMarking]).optional(),
        // Which teaching weeks this piece assesses (rule 6). Nothing may be
        // assessed before it has been taught.
        assesses: z.array(weekSchema).default([]),
      })
      .loose()
      .superRefine((assessment, ctx) => {
        for (const week of assessment.assesses) {
          if (week > assessment.week) {
            ctx.addIssue({
              code: "custom",
              path: ["assesses"],
              message: `due in week ${assessment.week} but assesses week ${week}, which is taught later`,
            });
          }
        }
      }),
  }),

  lectures: defineCollection({
    loader: courseNodeLoader("lectures"),
    schema: courseNodeSchema
      .extend({
        week: weekSchema,
        date: z.coerce.date(),
        teachers: teacherRefs.optional(),
        slides: z
          .string()
          .regex(/^\/decks\/[a-z0-9-]+\/$/)
          .optional(),
      })
      .loose(),
  }),

  people: defineCollection({
    loader: courseNodeLoader("people"),
    schema: ({ image }) =>
      z
        .object({
          title: z.string().trim().min(1),
          description: z.string().trim().min(40),
          role: z.string().trim().min(1),
          contact: z.string().trim().min(1).optional(),
          affiliation: z.string().trim().min(1).optional(),
          email: z.email().optional(),
          url: z.url().optional(),
          photo: image().optional(),
          photoAlt: z.string().trim().optional(),
          published: z.coerce.boolean().default(true),
        })
        .superRefine((person, ctx) => {
          if (person.photo && !person.photoAlt) {
            ctx.addIssue({
              code: "custom",
              path: ["photoAlt"],
              message: "describe the photo when one is supplied",
            });
          }
        }),
  }),
};
