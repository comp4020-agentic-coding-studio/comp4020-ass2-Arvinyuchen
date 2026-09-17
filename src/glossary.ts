// The course's vocabulary, in one place.
//
// Rule 3 in CLAUDE.md says every technical term is explained the first time a
// reader meets it. That rule needs a list of what counts as technical, and the
// list has to be the same one the glossary page renders, or the page
// and the check drift apart, and the check starts passing for the wrong reason.
//
// So this array is the single source of truth: /glossary/ renders it, and
// spec/content-invariants.test.ts reads it to find the first week that uses
// each term.

export interface GlossaryTerm {
  /** The term as a reader meets it in prose. Matched case-insensitively. */
  term: string;
  /** Fragment id on /glossary/. Lowercase letters, digits and hyphens. */
  slug: string;
  /** Plain-language definition, for a reader with no statistics background. */
  definition: string;
  /** Other spellings that should count as the same term (plurals, variants). */
  aliases?: string[];
}

// Each term is introduced by exactly one week, and the check enforces that the
// week which introduces it is the first one to mention it. That is a real
// constraint on the writing: a later week may use "placebo" freely, but week 3
// may not mention it in passing, because week 7 is where it gets explained.
//
// Which week introduces what:
//   1  baseline                       7  blinding, placebo, mesmerism
//   2  operationalise                 8  confounding
//   3  orthosomnia                    9  regression to the mean
//   4  reactivity                    10  non-stationary
//   5  withdrawal design             11  multiple comparisons
//   6  counterbalancing, pre-registration, sample size
//
// "sample size" is the one term introduced by a lecture rather than by a lab.
// It was week 1's, in the section about where the ten thousand step figure
// came from, and that section went when the week 1 lab merged into a single
// section. Week 6's lecture is now the first place in the course a reader
// meets the term, and it links it; no lab uses the words at all.
export const glossaryTerms: GlossaryTerm[] = [
  {
    term: "baseline",
    slug: "baseline",
    aliases: ["baselines"],
    definition:
      "What something looks like before you interfere with it. Without one, you have nothing to compare a change against, so the first week of this course changes nothing on purpose.",
  },
  {
    term: "sample size",
    slug: "sample-size",
    aliases: ["sample sizes"],
    definition:
      "How many people, or how many days, a finding rests on. A result from four people and a result from four thousand are not the same kind of fact, and most everyday advice does not tell you which one it is.",
  },
  {
    term: "operationalise",
    slug: "operationalise",
    aliases: ["operationalised", "operationalising", "operationalisation"],
    definition:
      "To turn a vague word into something you can actually write down. “Tired” is not a measurement; “minutes to fall asleep” is. Choosing badly here quietly decides what the rest of your experiment can find.",
  },
  {
    term: "orthosomnia",
    slug: "orthosomnia",
    definition:
      "Sleeping worse because you are tracking your sleep. Sleep clinicians named it after a run of patients whose main problem turned out to be anxiety about their own sleep data.",
  },
  {
    term: "reactivity",
    slug: "reactivity",
    aliases: ["reactive"],
    definition:
      "The way measuring something changes it. People behave differently when watched, and this still holds when the person watching is themselves.",
  },
  {
    term: "withdrawal design",
    slug: "withdrawal-design",
    definition:
      "Measure, add the thing, then take it away again. If the effect arrives with the thing and leaves with it, the thing is the likely cause. It is the simplest honest experiment one person can run alone.",
  },
  {
    term: "counterbalancing",
    slug: "counterbalancing",
    aliases: ["counterbalanced", "counterbalance"],
    definition:
      "Alternating the order you try two things in, so that “I did this one second” cannot be mistaken for “this one worked better”.",
  },
  {
    term: "pre-registration",
    slug: "pre-registration",
    aliases: ["pre-register", "pre-registered", "pre-registering"],
    definition:
      "Writing down what you expect, how you will measure it, and when you will stop, before you begin. It is what stops you quietly changing the question once you have seen the answer.",
  },
  {
    term: "blinding",
    slug: "blinding",
    aliases: ["blinded"],
    definition:
      "Not knowing which condition you are in, so that what you expect cannot colour what you record. Doing this to yourself is close to impossible, which is a real limit on every experiment in this course.",
  },
  {
    term: "placebo",
    slug: "placebo",
    aliases: ["placebos"],
    definition:
      "A real effect produced by expecting an effect. It is not imaginary. It simply is not caused by the thing you believe caused it.",
  },
  {
    term: "mesmerism",
    slug: "mesmerism",
    aliases: ["mesmerise", "mesmerised", "animal magnetism"],
    // Week 7 tells the story of the 1784 commission but never says what the
    // thing being tested actually claimed, which left the week's own example
    // resting on a word the reader had to already know. Sourced from Urte
    // Laukaityte, "Mesmerising Science: The Franklin Commission and the Modern
    // Clinical Trial", The Public Domain Review, 20 November 2018:
    // https://publicdomainreview.org/essay/mesmerising-science-the-franklin-commission-and-the-modern-clinical-trial
    // which gives the claim as "a special kind of imperceptible magnetic fluid
    // pervaded the universe" and "most if not all diseases were caused by an
    // abnormal flow of this fluid inside the body".
    definition:
      "A treatment fashionable in Paris in the 1780s, whose practitioners held that an invisible fluid runs through every living body, that illness is that fluid flowing wrongly, and that passing their hands over a patient could put it right. No such fluid was ever found.",
  },
  {
    term: "confounding",
    slug: "confounding",
    aliases: ["confounded", "confounder", "confounders"],
    definition:
      "When something you were not tracking moved at the same time as the thing you were, so you cannot tell which one mattered. Weather, deadlines and other people confound almost everything.",
  },
  {
    term: "regression to the mean",
    slug: "regression-to-the-mean",
    definition:
      "Unusual measurements tend to be followed by ordinary ones. Because people start new routines on their worst days, almost any routine appears to help.",
  },
  {
    term: "non-stationary",
    slug: "non-stationary",
    aliases: ["non-stationarity"],
    definition:
      "Changing over time. A person is non-stationary, so an answer that fitted you in March may not fit you in May, and that is not a mistake in your method.",
  },
  {
    term: "multiple comparisons",
    slug: "multiple-comparisons",
    definition:
      "Testing many things at once and reporting whichever one looks interesting. Track forty measures and something will correlate with something by chance alone. This is how dashboards mislead.",
  },
];
