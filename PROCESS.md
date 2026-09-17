# Process overview

## What I built

**SLOP1638: How to Make a Day.** A twelve-week first-year course on running
experiments on yourself, built on one argument: the instructions you are given
about your day are statements about a population, handed over as instructions
about your Tuesday.

## What I decided a good course looks like

Assignment 1 scored 95 for the artefact and 62 for process. The gap was not
effort. My harness there ran to 7,648 words with no rule about content,
factuality or audience, so the course-design decisions happened in my head and
left no trace in the repo.

So this time the design came first and in writing: the premise, the scope I was
refusing, the twelve weeks keyed on distinct methods
([`dd4405e`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Arvinyuchen/commit/dd4405e)).
The unit is one day, not a habit, which rules out most of what such a course
usually contains.

## What went into the harness

Six rules, each a course value rather than a coding standard
([`9be7c3c`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Arvinyuchen/commit/9be7c3c)).
Then the part I would repeat: I committed the six checks **failing**, before any
course content existed
([`7291c68`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Arvinyuchen/commit/7291c68)).
The ordering is the evidence.

Two obligations went into the content schema instead of `spec/`. The deploy job
deliberately does not depend on the check job, so a spec-only safety rule would
let a week with no stopping rule deploy anyway
([`8f8fb3f`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Arvinyuchen/commit/8f8fb3f)).
And the harness changed when it was wrong: my claim schema demanded a sample
size from every claim, and "the 10,000-step target began as a product name" is
history, not an effect
([`4567725`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Arvinyuchen/commit/4567725)).

## Keeping it factual, which is where the course changed the workflow

Directing a course about reading evidence honestly made me a worse customer for
what the agent handed back. Every number got checked against the document before
it was written, and the rule was to cut rather than soften.

That caught real things. The popular explanation for Australia's sun guidance,
the ozone hole, is not the reason, so the correction became a teaching moment
instead of a claim. The 7,000-step figure turned out to sit in a companion
statement rather than among the recommendations. Worst, a lecture I had drafted
*about provenance* carried three details no primary source supports, and the
same errors had already propagated into its lab
([`0bb242a`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Arvinyuchen/commit/0bb242a)).

## What earned a figure

One rule: a concept gets a figure when it has a shape prose states in sequence
but cannot show at once, **and** there are real values or the figure claims
none. It bound twice. I refused a UV chart because I had only qualitative
statements, then built it when the Bureau's actual grids turned out to be
published under CC BY
([`86b8907`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Arvinyuchen/commit/86b8907)).
And a five-step design died because the validator measured its pale end at
ΔE 5 against a floor of 15: nobody could have seen the distinction I was
encoding, so the categories were regrouped into three that mean something
([`07b70a8`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Arvinyuchen/commit/07b70a8)).

## How I knew it was right

Twenty-one deliberate mutations. In Assignment 1, six of twelve left my suite
green; this time every one was caught, and the sweep exposed a flaw in my own
method
([`d50cc53...b765359`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Arvinyuchen/compare/d50cc53...b765359)).

The checks still missed things, and the misses are the honest part. Opening the
site at 390px found the claims table pushing the page sideways
([`1d3c2fa`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Arvinyuchen/commit/1d3c2fa)).
Rule 3 polices only terms already in the glossary, so it could never catch a
word nobody added. And an effect claim can still be relabelled as history to
escape the sample-size rule: I designed the word-list check that would catch it
and abandoned it, because it fires on this course's own legitimate history
([`b765359`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Arvinyuchen/commit/b765359)).
