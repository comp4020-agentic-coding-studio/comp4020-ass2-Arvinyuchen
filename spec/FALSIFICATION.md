# Proving the checks can fail

A check that cannot fail is worse than no check: it reports success, it makes
the suite look thorough, and it protects nothing. In Assignment 1 I ran twelve
deliberate mutations against my own tests and six of them left the suite green —
four tests were too weak to work and two were live bugs the tests should have
caught. So the six rules in `content-invariants.test.ts` are not trusted until
each one has been watched to fail.

## Method

The checks read the built API, and at the time of this sweep there was no course
content — so most of them were failing for lack of data rather than passing for
good reasons. Watching a check fail when it is already failing proves nothing.

So I built a throwaway two-week fixture that satisfies all six rules, lowered
`TEACHING_WEEKS` to 2 and `MINIMUM_GLOSSARY_TERMS` to 1 so a two-week course
could go green, and confirmed a clean run: **15 passed**. Then each mutation was
applied to that green baseline on its own, `pnpm test` was run, and the fixture
was restored before the next one.

The fixture and the lowered thresholds were reverted afterwards. Nothing from
this sweep is committed except this record.

## Result

Eleven mutations, all caught.

| Mutation | Caught by | Message |
|---|---|---|
| A week declares no risk level | spec | `must declare risk as one of low, med, high` |
| A risk-high week has no stopping rule | **build** | `InvalidContentEntryDataError` on `02-first-review` |
| A week makes no claims | spec | `must declare a claims array` |
| A claim has no sample size | **build** | `InvalidContentEntryDataError` on `01-getting-started` |
| A body says "studies show" | spec | `name the study and its sample size instead` |
| First use of a term has no glossary link | spec | `is the first to use "baseline" and must link it` |
| A week builds on a week that is absent | spec | `builds on week 5, which does not exist` |
| A week builds on a later week | spec | `is week 1 and cannot build on week 2` |
| Two weeks share a method | spec | `reuses the method "naturalistic-baseline"` |
| Assessment weights total 99 | spec | `assessment weights total 99` |
| An assessment assesses a later week | **build** | `InvalidContentEntryDataError` on `assignment-1` |

Three are caught by the content schema at build time rather than by a spec
test. That is deliberate for the safety rule: `deploy` in
`.github/workflows/checks.yml` does not depend on `check`, so a spec-only
version of the duty-of-care rule would let a week with no stopping rule deploy
anyway. Failing the build is what actually stops it shipping.

## What this sweep does not yet show

Several assertions still pass **vacuously**, because the fixture was small and
the real course does not exist yet:

- the banned-phrase scan has only ever run over two short bodies
- the first-use rule was proved against a single term, with no aliases
- no check has been tested against a week that is absent altogether, rather
  than present and malformed

**This sweep must be re-run once the twelve real weeks exist**, against the real
thresholds, before the checks are treated as load-bearing. Passing on real
content is the claim that matters; passing on a fixture only shows the
assertions are wired up.

## Re-running it

The sweep was driven by a throwaway script, not committed — it is eleven
`pnpm test` runs with one edit between each, and rewriting it against real
content will be quicker than adapting it. The method is what matters: start
from a green suite, break one thing, confirm the failure names the right file
and the right field, restore.
