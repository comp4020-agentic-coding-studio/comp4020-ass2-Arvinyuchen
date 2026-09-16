# SLOP1638 — How to Make a Day

Rules for building this course site. They are about the course, not about the
code: the platform is fixed and documented in `README.md`, and nothing here
restates it.

## The course

You have been told what to do with your day. Sleep eight hours. Eat breakfast.
Exercise. No screens before bed. Work in twenty-five minute blocks.

Every one of those is a population average wearing the costume of a personal
instruction. Eight hours is a distribution flattened into a single number. Ten
thousand steps was the name of a 1965 Japanese pedometer, not a finding. And the
twenty-five minute work block was one student with a kitchen timer in the late
1980s, who tested it on nobody but himself.

The advice industry generalises from a single person, then instructs you to be
average. This course does the opposite: it treats every prescription as a
hypothesis, and tests it on the only subject the student has standing to
experiment on. The unit of design is one day — not a life, not a habit, not a
goal.

Three ideas carry the whole course, and every page should serve at least one:

1. **The average is not you.** A population finding is a hypothesis about a
   person, never an instruction.
2. **Measuring changes the measured.** Nobody observes their own day neutrally.
3. **The subject is non-stationary.** People change, so any specific answer
   expires. What the course can teach is a practice, not a result.

## Scope

**In:** the 24-hour unit · designing protocols for a single subject ·
measurement and its distortions · the history of self-experimentation · reading
population studies as hypotheses · stopping rules and harm boundaries.

**Out:** habit formation and streaks · productivity systems · goal setting ·
nutrition or clinical advice · anything tracked over longer than a single day's
structure.

If a page drifts out of scope, cut it rather than widen the course. The course
is deliberately narrow, and staying narrow is the point.

## Voice

Deadpan and sincere. The course means every word. Where it is funny, the
humour comes from real rigour applied at unexpectedly small scale — a full
protocol, with a control condition, for the first ten minutes after waking. It
never winks at the reader, never mocks the people it describes, and never
signals that it is joking. A joke would undercut the safety obligations, which
are real.

## Rules

These six are enforced by `spec/content-invariants.test.ts`. If a rule is
inconvenient, change the rule deliberately and say so — do not work around the
check.

1. **Safety.** Every week states how risky its experiment is. Any week above
   the lowest risk level also states when to stop, what the experiment must
   never become, and what a student who should not take part does instead. A
   course that asks students to change their sleep or their eating owes them
   this, and the site must not be publishable without it.

2. **Evidence.** If a page says something has an effect, it says how many
   people were measured, whether they were blinded, and where the finding comes
   from. Claims live in structured frontmatter, not loose prose, so the numbers
   cannot go missing. A course about sample sizes cannot itself wave at
   "research".

   Claims about history are marked as such and carry a source but no sample
   size. "The 10,000-step target began as a product name" is a fact about 1965,
   not a measurement, and recording it as an unreported sample size would
   misrepresent why the number is absent.

3. **Plain language.** Every technical term is explained the first time a
   reader meets it, by linking to the glossary. The reader is a smart stranger
   with no background in statistics or physiology. Writing that only an expert
   can follow has failed, because an expert does not need this course.

4. **Twelve distinct weeks.** Each week is built on a different method. No two
   weeks may share one. Twelve weeks that are really the same week twelve times
   is the failure this course is most at risk of.

5. **Honest ordering.** A week may only build on methods introduced in an
   earlier week. If the ordering does not work, fix the curriculum, not the
   claim.

6. **Assessment adds up.** The assessment weights total 100, and nothing is
   assessed before it is taught.

## Working agreements

- **Never invent a source.** If a claim cannot be traced, cut the claim. Where
  a source genuinely does not report a sample size, record it as unreported
  rather than guessing — that gap is itself worth teaching.
- **Assess inference, not outcome.** Students are marked on the quality of
  their reasoning, never on whether their day improved. Marking the outcome
  would reward regression to the mean, which is the error week 9 exists to
  expose.
- **Prefer cutting to padding.** A shorter course that holds together beats a
  complete-looking one that does not.
- **Fix the harness, not the instance.** When something slips through, add or
  tighten a check rather than patching the single page.
