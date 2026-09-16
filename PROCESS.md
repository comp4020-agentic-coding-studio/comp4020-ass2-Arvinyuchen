# Process overview

## What I built

**SLOP1638 — How to Make a Day.** A twelve-week first-year course on running
experiments on yourself, built on one argument: the instructions you are given
about your day are statements about a population, handed over as instructions
about your Tuesday.

## What I decided a good course looks like

Assignment 1 scored 95 for the artefact and 62 for process. The gap was not
effort. My harness there ran to 7,648 words with no rule about content,
factuality or audience, and every check was structural — so the course-design
decisions happened in my head and left no trace in the repo.

So this time the design came first and in writing: the premise, the scope I was
refusing, the twelve weeks keyed on distinct methods
([`dd4405e`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Arvinyuchen/commit/dd4405e)). Two decisions did the most work. The unit is
one day, not a habit, which rules out most of what such a course usually
contains. And the twelve weeks are differentiated by **method** rather than
topic, because twelve interchangeable weeks was the failure I was most likely to
produce.

## What went into the harness

Six rules, each a course value rather than a coding standard
([`9be7c3c`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Arvinyuchen/commit/9be7c3c)): safety, evidence, plain language, distinct
weeks, honest ordering, assessment arithmetic.

Then the part I would repeat. I committed the six checks **failing**, before any
course content existed ([`7291c68`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Arvinyuchen/commit/7291c68)). The ordering is the
evidence: the rules constrained what got written rather than describing it
afterwards.

Two obligations went into the content schema instead of `spec/`, and that is the
call I am most pleased with. The deploy job deliberately does not depend on the
check job, so a spec-only safety rule would let a week with no stopping rule
deploy anyway. Failing the build is what actually stops it shipping
([`8f8fb3f`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Arvinyuchen/commit/8f8fb3f)).

The harness also changed when it was wrong. My claim schema demanded a sample
size from every claim, and the first real week broke it: "the 10,000-step target
began as a product name" is history, not an effect, and recording it as
*unreported* would have misrepresented why the number was absent
([`4567725`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Arvinyuchen/commit/4567725)). Fixing the rule beat writing the page around
it.

## What I deliberately left out

No `weeks` collection: `sessions` already carries a week number and titles its
pages "Week N", so a second one would have given every week two pages saying
overlapping things. No prose-tone check, because a regex cannot judge voice.

And one hole I could not close. An effect claim can be relabelled as history to
escape the sample-size rule. Strict schemas catch the lazy version; someone who
relabels *and* deletes the numbers is lying about the kind of claim, and nothing
detects that. I designed the word-list check that would catch it and abandoned
it — it fires on this course's own legitimate history claims, where Galton and
Kahneman are history *about* effects ([`b765359`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Arvinyuchen/commit/b765359)).

## How I knew it was right

Eleven deliberate mutations against a green fixture, then ten more against the
real twelve weeks. In Assignment 1, six of twelve such mutations left my suite
green. This time every one was caught — and the sweep exposed a flaw in my own
method, because with one rule already failing, exit codes made every mutation
look caught
([`d50cc53...b765359`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Arvinyuchen/compare/d50cc53...b765359)).

The checks did not catch everything. Opening the site at 390px found the claims table pushing the whole page sideways
([`1d3c2fa`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Arvinyuchen/commit/1d3c2fa)), and three pages inherited from the starter
with no `h1` at all — where my first fix put the heading below the lead and the
second did it properly
([`f821750...60b250c`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Arvinyuchen/compare/f821750...60b250c)).
