# SLOP1638: How to Make a Day

Rules for building this course site. They are about the course, not about the
code: the platform is fixed and documented in `README.md`, and nothing here
restates it.

## The course

Public guidance is the best summary anyone has of what helps people in
general. Sleep seven to nine hours. Aim for seven thousand steps or more.
Enjoy a healthy breakfast. The course starts from that guidance rather than
against it, and teaches it as published: what it says, how strong it is, and
what it is a summary of.

What guidance cannot do is the last step, from a population to one person on
one Tuesday. That step belongs to the student, and it can be taken carefully.

The course teaches it in three moves, and the twelve weeks are those moves in
order:

1. **Realisation.** Read the guidance accurately, then look at your own day
   and find where you actually sit in it. Weeks 1 to 4.
2. **Change.** Alter one thing, using the guidance for what to change and how.
   Weeks 5 to 7.
3. **Rethinking.** Read what your body, your mood and your actions send back,
   and revise the change against it. Weeks 8 to 12.

Then round again, because the person is not the same in May as in March. The
unit of design is one day.

Three ideas make the third move necessary, and every page should serve at
least one:

1. **The average is not you.** A population finding is a hypothesis about a
   person, never an instruction.
2. **Measuring changes the measured.** Nobody observes their own day neutrally.
3. **The subject is non-stationary.** People change, so any specific answer
   expires. What the course can teach is a practice, not a result.

## Scope

**In:** the 24-hour unit · public guidance, taught as published, including
what to change and how · designing protocols for a single subject ·
measurement and its distortions · reading your own body, mood and actions as
feedback · the history of self-experimentation · stopping rules and harm
boundaries.

**Out:** personalised clinical advice, diagnosis or treatment · anything that
substitutes for a doctor · goal setting and streaks · anything tracked over
longer than a single day's structure.

Teaching what the guidance says is in scope. Telling a particular student what
their body needs is not, and no page should blur the two.

If a page drifts out of scope, cut it rather than widen the course. The course
is deliberately narrow, and staying narrow is the point.

## Voice

Deadpan and sincere. The course means every word. Where it is funny, the
humour comes from real rigour applied at unexpectedly small scale, a full
protocol, with a control condition, for the first ten minutes after waking. It
never winks at the reader, never mocks the people it describes, and never
signals that it is joking. A joke would undercut the safety obligations, which
are real.

## Rules

These six are enforced by `spec/content-invariants.test.ts`. If a rule is
inconvenient, change the rule deliberately and say so: do not work around the
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
  rather than guessing. That gap is itself worth teaching.
- **Assess inference, not outcome.** Students are marked on the quality of
  their reasoning, never on whether their day improved. Marking the outcome
  would reward regression to the mean, which is the error week 9 exists to
  expose.
- **Prefer cutting to padding.** A shorter course that holds together beats a
  complete-looking one that does not.
- **No dashes.** Not em dashes, not en dashes, not hyphens standing in for
  punctuation. Use a colon, a comma, brackets, or rewrite the sentence. A
  quoted source sentence keeps whatever punctuation the source used, because
  altering a quote to suit a house rule is worse than the dash. The check in
  `spec/content-invariants.test.ts` enforces this for prose; quoted material in
  `src/data/*.json` is exempt for that reason.
- **A figure earns its place.** A concept gets a figure when it has a shape
  prose states in sequence but cannot show at once, *and* there are real values
  or the figure claims none. No figure is invented from a qualitative statement.
  If the data cannot be obtained, the page ships without the figure.
- **Captions carry how to read the figure and the citation, nothing else.** Any
  number read off a figure belongs in body prose at body size. A finding in the
  smallest type on the page is a finding nobody reads.
- **Paragraphs are units of argument.** Lecture prose runs at least 25 words a
  paragraph, checked. A single stranded sentence is a formatting habit, not a
  point. Labs are exempt: a protocol step is an instruction and "This week you
  do not measure anything." is doing its whole job in seven words.
- **Fix the harness, not the instance.** When something slips through, add or
  tighten a check rather than patching the single page.
