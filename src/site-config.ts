import { defineSiteConfig } from "astro-theme-university/types";
import { slopBranding } from "astro-theme-slop";

// The underlying collection and URL remain `sessions`; these labels are the
// language students see.
//
// "Lab" rather than "Session" or "Seminar", because the weekly meeting is where
// an experiment actually gets run — students arrive with a record and leave
// with a result, which is not what either of the other words promises.
export const sessionLabels = {
  singular: "Lab",
  plural: "Labs",
} as const;

export const graphCollections = ["sessions", "assessments", "lectures", "people"];

export const courseApiCollections = [
  ...graphCollections.map((key) => ({ key })),
  { key: "policies", dir: "pages/policies" },
];

export const siteConfig = defineSiteConfig({
  ...slopBranding,
  name: "Slop University",

  links: [
    // First, because "what is on this week" is the question a student asks
    // most often, and the schedule is the only page that answers it in one
    // look.
    { text: "Schedule", href: "/schedule/" },
    { text: "Lectures", href: "/lectures/" },
    { text: sessionLabels.plural, href: "/sessions/" },
    { text: "Assessment", href: "/assessments/" },
    // In the menu because rule 3 sends readers here from every week, so it is a
    // reference work rather than an appendix.
    { text: "Glossary", href: "/glossary/" },
    { text: "People", href: "/people/" },
    { text: "Policies", href: "/policies/" },
  ],

  licence: "CC-BY-NC-SA-4.0",
  // No social card. The four starter images were deleted rather than
  // replaced, and `socialImage` is optional in the theme's types — the trade
  // is that links to this site get no preview image, which is a fair price for
  // a course site that does not illustrate anything.
});
