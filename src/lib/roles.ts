// Display text for a person's role.
//
// This map exists for the relabelling, not for capitals: "guest" on its own
// tells a reader nothing, "guest lecturer" does.
//
// The labels are lowercase because the site renders every other field value
// that way. The protocol strip on a lab page prints `measurement error` and
// `high` under uppercase letterspaced labels, and the course tags on the home
// page are lowercase too. A role is a field value like any other, and
// capitalising only this one would make it the single value on the site that
// shouts. Ordinary usage agrees: a job title is a common noun unless it comes
// before a name as a formal title. "Convenor Halliday" takes the capital,
// "(convenor)" does not.
//
// `other` maps to an empty string deliberately. It means the person's role is
// none of the three this course has, and every caller treats empty as "print
// nothing" rather than printing the word "other", which would tell a student
// less than silence does.
export const roleLabels: Record<string, string> = {
  convenor: "convenor",
  tutor: "tutor",
  guest: "guest lecturer",
  other: "",
};

/** The label to print, or undefined when there is nothing worth printing. */
export function roleLabel(role: string | undefined | null): string | undefined {
  if (!role) return undefined;
  return roleLabels[role] || undefined;
}
