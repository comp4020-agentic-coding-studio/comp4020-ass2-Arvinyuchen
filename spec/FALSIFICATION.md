# Proving the checks can fail

A check that cannot fail is worse than no check: it reports success, it makes
the suite look thorough, and it protects nothing. In Assignment 1 I ran twelve
deliberate mutations against my own tests and six of them left the suite
green: four tests were too weak to work, and two were live bugs the tests
should have caught. So the six rules in `content-invariants.test.ts` are not trusted until
each one has been watched to fail.

This has been done twice: once against a throwaway fixture while the checks were
new, and again against the twelve real weeks. The second sweep is the one that
matters, and it found a hole.

## Sweep 1, the fixture

When the checks were written there was no course content, so most were failing
for lack of data rather than passing for good reasons, and watching a failing
check fail proves nothing. I built a two-week fixture satisfying all six rules,
lowered `TEACHING_WEEKS` to 2 and `MINIMUM_GLOSSARY_TERMS` to 1, and confirmed a
clean run of 15 passing. Then eleven mutations, one at a time, restoring between
each.

All eleven were caught: eight by spec tests, three by the content schema at
build time. The fixture and lowered thresholds were reverted afterwards.

## Sweep 2, the real twelve weeks

Repeated against real content at real thresholds. Ten mutations:

| Mutation | Caught by | What it said |
|---|---|---|
| Blank a real stopping rule (wk 3) | **build** | `03-two-instruments data does not match collection schema` |
| Two weeks share a method (wk 8 takes wk 4's) | spec | `reuses the method "reactivity"` |
| Drop a first-use glossary link (wk 9) | spec | `week 9 is the first to use "regression to the mean"` |
| Use a later week's term early (wk 2 says "placebo") | spec | `week 2 is the first to use "placebo" and must link it` |
| An effect claim loses its sample size (wk 2) | **build** | `02-tired data does not match collection schema` |
| A week points at a later week (wk 5 needs 9) | spec | `is week 5 and cannot build on week 9` |
| Banned phrase in a real body (wk 8) | spec | `says "studies show": name the study` |
| Delete a week entirely (wk 11) | spec | `12-unmeasured builds on week 11, which does not exist` |
| A glossary term loses its definition | spec | `"baseline" needs a definition` |
| **Relabel an effect claim as history** | **nothing** | see below |

The fourth row is worth pausing on. Writing "placebo" in week 2 is not a typo. It is the ordinary, natural thing
a writer does, and the check caught it and
forced the word out of the page. That rule is doing real editorial work, not
decoration.

## The hole this sweep found

**An effect claim can be relabelled as a history claim to escape the sample-size
requirement, and no check detects it.**

A history claim needs text and a source; an effect claim needs those plus `n`
and `blinded`. Change `kind: effect` to `kind: history` and the obligation
simply evaporates.

Half of this is now closed. Both claim shapes are `z.strictObject`, so a claim
relabelled as history while still carrying its numbers fails the build with
`claims.1: Unrecognized keys: "n", "blinded"`. That catches the lazy version and
the incoherent state.

**The other half cannot be closed and I am not going to pretend otherwise.**
Someone who relabels a claim *and* deletes its numbers is asserting that a
statement about an effect is a statement about history. That is a lie about the
nature of the claim, and no schema or regex can detect it.

I considered a word-list heuristic: history claims must not contain "lower",
"higher", "reduced", "associated with" and so on. It fails immediately on this
course's own content: the Galton claim says children were "closer to the
average", Kahneman's says praise "appeared to make the next one worse", the
salmon claim says the scan "recovered apparently significant brain activity",
and the Hawthorne one says the evidence was "much weaker". Those are all
legitimate history claims *about* effects. A check that flagged them would train
me to route around it, which is how the four useless tests in Assignment 1 came
to exist.

So this is a limit of the harness, recorded rather than hidden. What rule 2
actually guarantees is narrower than it first appears: **if you say something is
an effect, you must show the number.** Honesty about which kind of claim you are
making is not enforced, and cannot be.

## A flaw in the sweep method itself

Rule 6 is currently red, because the assessments are not written yet. My first
pass judged each mutation by whether `pnpm test` exited non-zero, which it
always does while rule 6 fails. That made every mutation look caught, including
the one that was not.

Nine of the ten happened to report their own correct failure first, so the
result held. The tenth did not, and I only noticed because its reported message
was about `assignment-1` rather than about claims.

**A mutation is only caught if the failure names the right file and the right
field.** Exit codes are not enough when anything else in the suite is already
failing. The next sweep, once rule 6 is green, should still assert on the
message rather than the exit code.

## Re-running it

Both sweeps were driven by throwaway scripts, deliberately not committed: each
is ten or eleven `pnpm test` runs with one edit between them, and rewriting one
against current content is quicker than maintaining it. The method is the part
worth keeping: start from a green suite, break one thing, confirm the failure
names the right file and the right field, restore.
