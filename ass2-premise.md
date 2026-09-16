# SLOPxxxx: How to Make a Day

Working premise for COMP4020 Assignment 2. Decisions locked 2026-09-16.
Moves into the repo as the basis for CLAUDE.md + spec/ once the starter is accepted.

## Register

**Deadpan-sincere.** The course means every word. The comedy comes from real rigour
applied at absurd granularity, a full protocol, with control conditions, for the
first ten minutes after waking. Never winks. Never mocks. This register is what
keeps the duty-of-care obligations honest rather than decorative.

## Premise (revised 2026-09-17)

The original framing set the course against public guidance: the advice
industry generalises from one person and instructs you to be average. That was
wrong about what the course does. The guidance is the best summary anyone has
of what helps people in general, and the course teaches it as published,
including what to change and how. What guidance cannot do is the last step,
from a population to one person on one Tuesday.

The course teaches that step in three moves, and the twelve weeks are those
moves in order:

1. **Realisation**, weeks 1 to 4. Read the guidance accurately, then find
   where your own day sits in it.
2. **Change**, weeks 5 to 7. Alter one thing, using the guidance for what to
   change and how.
3. **Rethinking**, weeks 8 to 12. Read what your body, your mood and your
   actions send back, and revise against it.

Then round again. `phase` is a declared field on every week and
spec/content-invariants checks the three never double back, so the spine is in
the data rather than only in the prose.

## Premise (original, superseded)

> You have been told what to do with your day. Sleep eight hours. Eat breakfast.
> Exercise. No screens before bed. Work in twenty-five minute blocks.
>
> Every one of those is a population average wearing the costume of a personal
> instruction. Eight hours is a distribution flattened into a single number. Ten
> thousand steps was the name of a 1965 Japanese pedometer (*manpo-kei*) not a
> finding. Breakfast's importance was pushed hard by cereal manufacturers into
> observational studies riddled with confounds. And the twenty-five minute work
> block was one university student with a kitchen timer in the late 1980s, who
> tested it on nobody but himself.
>
> That last one is the tell. The advice industry generalises from a single person,
> then instructs you to be average.
>
> This course does the opposite. It treats every prescription as a hypothesis and
> tests it on the only subject you have standing to experiment on. The unit of
> design is one day, not a life, not a habit, not a goal. Twenty-four hours,
> taken apart and rebuilt, twelve times.

## The three pillars

1. **The average is not you.** A population finding is a hypothesis about you,
   never an instruction. Distributions, effect sizes, and why "eight hours" is a
   category error.
2. **Measuring changes the measured.** You cannot observe your own day neutrally.
   Orthosomnia (sleep trackers making sleep worse) is the worked example. The
   instrument is part of the experiment.
3. **The subject is non-stationary.** You evolve. What worked in week 2 fails in
   week 9, not because you did it wrong but because you are a different system.
   There is no stable optimum to find.

**What the pillars force:** the deliverable cannot be a better day, because any
specific answer expires. It has to be a practice of redesigning days. This is the
one idea, and it is what has to hold across all twelve weeks.

## Scope

**In:** the 24-hour unit · protocol design for n=1 · measurement and its
distortions · the history of self-experimentation · reading population studies as
hypotheses · stopping rules and harm boundaries

**Out:** habit formation and streaks · productivity systems · goals and life
design · nutrition or clinical advice · anything longitudinal beyond a single
day's structure

The out-list is what keeps the course off a real curriculum committee's desk.

## Intellectual lineage (verify before publishing)

- Santorio Santorio: thirty years weighing himself and everything he ingested
- Werner Forssmann: catheterised his own heart, 1929; Nobel 1956
- Barry Marshall: drank *H. pylori*; Nobel 2005
- Francesco Cirillo, the Pomodoro technique, late 1980s, n=1. THE load-bearing
  fact of the whole premise. Verify hard: dates, whether he was a student, the
  tomato timer. If this doesn't hold up, the opening argument needs rebuilding.

## Harness plan (the A1 fix)

A1 scored 95 artefact / 62 process. The harness knew only about the DOM: 7,648
words of CLAUDE.md with zero rules about content, factuality, audience or jargon,
and every spec/ check structural ("exists", "server-renders", "has alt text").
The marker asked how the content became factual and how interaction was chosen, both decisions were made well and left no trace in the repo.

Content invariants for this course, to be written BEFORE any week pages exist:

1. **Stopping rules.** Every experiment page declares its measure, duration,
   stopping rule, and what is off-limits. Missing any → build fails. A course
   value (duty of care) enforced by the harness. The flagship check.
2. **n and blinding.** Every claim of an effect states its sample size and
   whether it was blinded: including the course's own examples.
3. **Citation integrity.** Every empirical claim carries a source. Uncited → fails
   check:evidence.
4. **First-use definitions.** Every term defined on first use or in the glossary.
   Directly targets A1's "domain experts would grasp it, but they don't need an
   explainer".
5. **Prerequisite ordering.** No week leans on a method introduced later.
6. **Distinct mechanisms.** Each of the twelve weeks names a different method or
   distortion. Two weeks sharing one → build fails, so interchangeable weeks
   cannot happen.
7. **Assessment arithmetic.** Sums to 100%. Nothing assessed before it is taught.

Checks 1, 2 and 4 read as judgement rather than diligence, and each traces to a
specific line of A1 feedback. That traceability is the process story.

## Still open

- The twelve weeks: one component of the day per week, one experiment each
- Assessment structure summing to 100%
- SLOPxxxx: three digits arrive with the repo; leading digit is a free choice
- Which lecture carries the real deck

## Repo state (checked 2026-09-16)

Cloned to `comp4020-ass2-Arvinyuchen/`. Provisioned 2026-08-30, private, 2 commits
(initial + course code). Untouched since.

- **Assigned digits: 638.** Leading digit is a free choice from {1,2,3,4,6,8};
  arrived as `SLOP1638`. Set in `src/course-config.ts:51`, and `level` must match.
- `CLAUDE.md` is 98 words of note-to-self, no rules. Goes when ours is written.
- `spec/` has exactly one check: dates stay inside the teaching period.
- Content collections: `assessments`, `lectures`, `people`, `sessions`.
- `pnpm check` = typecheck + build + vitest over spec/. `pnpm check:evidence`
  is a separate script. Both must pass.
- Git hooks are wired via `core.hooksPath .githooks` on `pnpm install`.

## The twelve weeks (locked 2026-09-16)

Differentiated by **method**, not topic. Two weeks sharing a method is the
interchangeability failure the brief punishes, so `method` is the uniqueness key
for check #6. `needs` is the uniqueness key's companion for check #5, it lists
the weeks whose methods this one depends on, and no week may depend on a later one.

| # | slug | title | method | component | needs | risk |
|---|---|---|---|---|---|---|
| 1 | baseline | The Day You Didn't Design | naturalistic-baseline | the whole day |: | low |
| 2 | tired | What Is "Tired"? | operationalisation | alertness | 1 | low |
| 3 | two-instruments | Two Instruments, One Night | measurement-error | sleep | 2 | **high** |
| 4 | observer | The Observer in the Room | reactivity | phone use | 3 | med |
| 5 | away-and-back | Take It Away, Put It Back | aba-withdrawal | breakfast | 1, 2 | **high** |
| 6 | twenty-five-minutes | Twenty-Five Minutes | counterbalancing | the work block | 5 | low |
| 7 | placebo | You Are the Placebo | blinding | caffeine | 5, 6 | **high** |
| 8 | everything-else | Everything Else That Happened | confounding | the social evening | 5 | low |
| 9 | felt-better-anyway | Why You Felt Better Anyway | regression-to-mean | the bad day | 1, 8 | med |
| 10 | subject-has-changed | The Subject Has Changed | non-stationarity | the morning, ten weeks on | 5 | med |
| 11 | forty-things | Forty Things at Once | multiple-comparisons | the dashboard | 2, 9 | **high** |
| 12 | unmeasured | The Day You Don't Measure | stopping-and-exit | the unmeasured day | all | low |

### The two weeks that carry the course

- **Week 6** audits the course's own founding anecdote. The premise claims the
  twenty-five minute block was one student with a kitchen timer who tested it on
  nobody; week 6 tests it properly, counterbalanced. The course holds itself to
  the standard it demands. This is the "one idea carried all the way".
- **Week 9** is the pointed one: regression to the mean explains why *every*
  intervention appears to work, because you start them when you feel worst. It
  dismantles the advice industry without raising its voice. **This week carries
  the real deck**: most counterintuitive, most visual, needs actual distributions
  on screen.

### Pillar coverage

- *The average is not you*: weeks 1, 2, 9
- *Measuring changes the measured*: weeks 3, 4, 11
- *The subject is non-stationary*: week 10 explicitly, by re-running week 5
- The forced conclusion (any specific answer expires; the deliverable is a
  practice): banked in week 12

### Duty of care: decision

Weeks 5 and 7 alter eating and caffeine. **Both stay.** Decided against swapping
for non-ingestible conditions (light, sound, temperature) because the teaching
material is materially better and because the obligation is the point: a course
that tells students to change their sleep and food has duties, and encoding those
duties in the harness is the strongest available process story.

Each high-risk week (3, 5, 7, 11) must therefore carry:
- an explicit harm boundary: what this experiment must never become
- a stopping rule stated before the protocol, not after
- an opt-out: a named alternative protocol for anyone who should not run it

Check #1 enforces all four fields on every experiment page. Week 7 additionally
documents caffeine withdrawal as a foreseeable, benign-but-unpleasant effect
rather than a surprise, the stopping rule is part of the method, not a footnote.

## Still open

- Assessment structure summing to 100% (check #7 needs this)
- Twelve dated teaching weeks against a 2027 session; startDate/endDate in
  `src/course-config.ts` currently placeholder 2027-02-22 → 2027-05-28
- Course code: keep `SLOP1638` (recommended) or change the leading digit
