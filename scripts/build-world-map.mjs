// Regenerates src/data/world-guidelines.json.
//
// Two things go into that file and they come from different places. The
// geometry is Natural Earth's 110m country outlines, projected and simplified
// here. The guidance is the GUIDANCE table below, which is hand-entered: every
// sentence in it was read off the page or the PDF it cites, and every URL was
// checked for a 200 before it was written down. Nothing in this file is derived
// from a summary of a guideline; the classifying sentence is quoted so a reader
// can disagree with the classification.
//
// Run with:  node scripts/build-world-map.mjs [path-or-url-to-geojson]
//
// Committed output, not a build step, for the same reason as
// scripts/build-apparatus-css.mjs: the input is an external dataset that
// changes only when the dataset does, and a generated file in the repo is
// easier to review than a generator in the build. It also keeps the build
// offline, which matters because several of the guidance publishers block and
// throttle automated requests: health.govt.nz and healthnz.govt.nz sit behind a
// challenge that refuses curl's default agent, and canada.ca refuses a spoofed
// Chrome one.

import { writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

const GEOJSON_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

// The date the guidance pages below were fetched and their sentences copied.
// Recorded rather than generated, so regenerating the geometry cannot silently
// restamp claims nobody rechecked.
const RETRIEVED = "2026-09-17";

// Natural Earth's own VERSION file on the commit this was built from.
const GEOMETRY_VERSION = "5.2.0-pre";

/* ------------------------------------------------------------------ *
 * Projection
 *
 * Equirectangular, which is the plainest projection there is: x is
 * longitude, y is latitude, both scaled linearly and nothing else done.
 * It badly exaggerates area away from the equator, so Canada looks larger
 * against Australia than it is. That is tolerable here because the figure
 * encodes a category per country and never an area, and it is named in the
 * caption so a reader is not left to infer it.
 *
 * The latitude window stops at 84 north and 60 south. Antarctica is dropped
 * outright: under this projection it spreads across the full width of the
 * frame and would be the largest thing in a figure it has no part in. 84
 * north keeps Greenland and Canada's northern islands whole.
 * ------------------------------------------------------------------ */
const WIDTH = 960;
const LAT_TOP = 84;
const LAT_BOTTOM = -60;
const HEIGHT = Math.round((WIDTH * (LAT_TOP - LAT_BOTTOM)) / 360);

const px = (lon) => ((lon + 180) / 360) * WIDTH;
const py = (lat) => ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * HEIGHT;

/* ------------------------------------------------------------------ *
 * Simplification
 *
 * The budget is a JSON file under 100KB, and the raw geometry is 839KB. Three
 * cuts get there, in this order, because each one makes the next cheaper:
 *
 *   1. Decimate. Walk each ring and keep a point only if it has moved at
 *      least MIN_STEP from the last point kept. First and last are always
 *      kept so rings still close. This is the cut that does the work.
 *   2. Round to one decimal place. At 960 units across that is 0.0375 of a
 *      degree, far finer than 110m data resolves, so it costs nothing visible
 *      and shortens every number to at most five characters.
 *   3. Drop rings whose bounding box is smaller than MIN_BBOX. Below that a
 *      ring renders as a speck and carries no information.
 *
 * The five highlighted countries get a finer step and a smaller minimum,
 * because their shape is the thing a reader is clicking on: Tasmania,
 * Northern Ireland and both New Zealand islands survive, and Hawaii and
 * Alaska stay attached to the United States.
 * ------------------------------------------------------------------ */
const CONTEXT = { minStep: 3.0, minBbox: 6 };
const FOCUS = { minStep: 1.2, minBbox: 0.8 };

const round1 = (n) => Math.round(n * 10) / 10;

/** One linear ring of lon/lat pairs, projected, decimated and rounded, as an
 * SVG subpath. Returns "" when the ring has collapsed below usefulness. */
const ringToPath = (ring, { minStep, minBbox }) => {
  const projected = ring.map(([lon, lat]) => [px(lon), py(lat)]);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of projected) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  // Area rather than either side alone, so a long thin island (Chile, Japan)
  // survives while a speck does not.
  if ((maxX - minX) * (maxY - minY) < minBbox) return "";

  const kept = [];
  let last = null;
  for (const point of projected) {
    if (last === null || Math.hypot(point[0] - last[0], point[1] - last[1]) >= minStep) {
      kept.push(point);
      last = point;
    }
  }
  // A ring needs three distinct corners to enclose anything. Decimation can
  // take one below that even when its bounding box passed.
  if (kept.length < 3) return "";

  const rounded = kept.map(([x, y]) => [round1(x), round1(y)]);
  const out = [`M${rounded[0][0]} ${rounded[0][1]}`];
  let previous = rounded[0];
  for (const [x, y] of rounded.slice(1)) {
    // Rounding can land two kept points on the same tenth. An L to where the
    // pen already is draws nothing and costs characters.
    if (x === previous[0] && y === previous[1]) continue;
    out.push(`L${x} ${y}`);
    previous = [x, y];
  }
  if (out.length < 4) return "";
  return `${out.join("")}Z`;
};

/** Every ring of a Polygon or MultiPolygon, as one path string. Interior rings
 * are kept and rely on the default nonzero fill rule to punch their holes;
 * at 110m there are few of them and dropping them would fill in Lesotho. */
const geometryToPath = (geometry, options) => {
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];
  return polygons
    .flatMap((rings) => rings.map((ring) => ringToPath(ring, options)))
    .filter(Boolean)
    .join("");
};

/* ------------------------------------------------------------------ *
 * The guidance
 *
 * `category` is how much of the twenty-four hours one national document
 * covers, and nothing else. It is not how strong the advice is, how recent
 * it is, or whether the advice is any good.
 *
 *   whole     activity, sitting and sleep set together, at every age band
 *   children  the integrated document exists, and stops before adulthood
 *   waking    activity and sitting are recommendations, sleep is not
 *
 * The scheme started with two boxes, because the question came from the
 * course's own premise: either a country's guidance treats the day as one
 * unit or it does not. New Zealand broke that on the first reading. Its
 * guideline for five to seventeen year olds is Canada's, adapted with
 * permission, and covers the whole day; its adults get five activity
 * statements with no sleep target anywhere in them. Calling that `whole`
 * would have credited New Zealand with something its adults do not have, and
 * calling it `waking` would have hidden a document that plainly exists. A
 * third box was added rather than New Zealand bent.
 *
 * Every box has a country in it. That is worth saying, because the previous
 * version of this figure carried an empty one on purpose: three positions on
 * this axis exhaust it, so a fourth would be invented rather than found.
 *
 * Exactly one document per country carries `classifies: true`, and its
 * `quote` is the sentence the category rests on. Quotes are verbatim,
 * including the publisher's own punctuation and spelling.
 *
 * `gap` is where a country has no clean equivalent of NHMRC, the body whose
 * guidelines are one of the three an Australian student starts from. It is
 * recorded as an absence rather than filled with a near miss, and it says
 * what was looked for so a reader can go and find what this reading missed.
 * ------------------------------------------------------------------ */
const GUIDANCE = [
  {
    iso: "AU",
    name: "Australia",
    category: "whole",
    summary:
      "Did not rebuild Canada's format so much as take it, and now publishes activity, sitting and sleep as one document for every age band.",
    documents: [
      {
        publisher: "Australian Government Department of Health, Disability and Ageing",
        title: "24-hour movement guidelines for all Australians",
        url: "https://www.health.gov.au/topics/physical-activity/24-hour-movement-guidelines-for-all-australians",
        quote:
          "Australia’s 24-hour movement guidelines outline how much physical activity you should do, the importance of reducing the time you spend sitting or lying down, and how much sleep people should get.",
        classifies: true,
      },
      {
        publisher: "Australian Government Department of Health, Disability and Ageing",
        title:
          "Australian 24-Hour Movement Guidelines for Adults (18-64 years) and Older Adults (65+ years): Guideline Development Report",
        url: "https://www.health.gov.au/sites/default/files/2026-03/australian-24-hour-movement-guidelines-for-adults-18-to-64-years-and-older-adults-65-years.pdf",
        // The adoption, in the guideline's own words. Worth quoting because
        // "Australia adopted Canada's format" is otherwise a claim a reader has
        // to take on trust from a secondary account.
        quote:
          "The potential benefit for Australia was that it could leverage the considerable work done in Canada on the development of their 24-hour guidelines, which would allow Australia to complete what would normally be a much longer process, in considerably less time and requiring fewer resources.",
        classifies: false,
      },
      {
        publisher: "National Health and Medical Research Council",
        title: "Australian dietary guidelines",
        url: "https://www.eatforhealth.gov.au/guidelines/guidelines",
        quote:
          "The Australian dietary guidelines (the guidelines) provide up-to-date advice about the amount and kinds of foods that we need to eat for health and wellbeing.",
        classifies: false,
      },
      {
        publisher: "National Health and Medical Research Council",
        title: "Guidelines",
        url: "https://www.nhmrc.gov.au/guidelines",
        quote:
          "National Health and Medical Research Council (NHMRC) develops and supports high quality guidelines for clinical practice, public health, environmental health and ethics.",
        classifies: false,
      },
    ],
  },
  {
    iso: "CA",
    name: "Canada",
    category: "whole",
    summary:
      "Wrote the format. The children's guideline was the first anywhere to set targets across a whole day, and the adult one followed it.",
    documents: [
      {
        publisher: "Canadian Society for Exercise Physiology",
        title:
          "Canadian 24-Hour Movement Guidelines for Adults aged 18-64 years: An Integration of Physical Activity, Sedentary Behaviour, and Sleep",
        url: "https://csepguidelines.ca/guidelines/adults-18-64/",
        quote:
          "For health benefits, adults aged 18-64 years should be physically active each day, minimize sedentary behaviour, and achieve sufficient sleep.",
        classifies: true,
      },
      {
        publisher: "Canadian Society for Exercise Physiology",
        title:
          "Canadian 24-Hour Movement Guidelines for the Children and Youth (5-17 years): An Integration of Physical Activity, Sedentary Behaviour, and Sleep",
        url: "https://csepguidelines.ca/guidelines/children-youth/",
        // The origin claim, made by the body that made the guideline. Australia
        // and New Zealand both trace back to this document.
        quote:
          "The Canadian 24-Hour Movement Guidelines for Children and Youth (ages 5-17 years) are the first evidence-based guidelines to address the whole day.",
        classifies: false,
      },
      {
        publisher: "Health Canada",
        title: "Canada's food guide",
        url: "https://www.canada.ca/en/health-canada/services/food-guide.html",
        quote:
          "Canada's food guide is the government of Canada's guidance on healthy eating for people in Canada aged 2 years and older.",
        classifies: false,
      },
    ],
    gap: "Nothing found here fills NHMRC's slot. The movement guideline itself comes from a professional society rather than a health department, which is a difference in who gets to speak and not only in what is said.",
  },
  {
    iso: "NZ",
    name: "New Zealand",
    category: "children",
    summary:
      "Took Canada's format for children and stopped there. Its adults get eating and activity bound into one document instead, with no sleep target in it.",
    documents: [
      {
        publisher: "Ministry of Health Manatu Hauora",
        title:
          "Sit Less, Move More, Sleep Well: Physical Activity Guidelines for Children and Young People",
        url: "https://static.info.content.health.nz/docs/health-pros/topics/nutrition/physical-activity-guidelines-children-young-people.pdf",
        quote:
          "For school-aged children and young people (aged 5 to 17 years) high levels of physical activity, low levels of sedentary behaviour and sufficient sleep each day achieves greater health benefits.",
        classifies: true,
      },
      {
        publisher: "Ministry of Health Manatu Hauora",
        title: "Sit Less, Move More, Sleep Well: where the guidelines came from",
        url: "https://static.info.content.health.nz/docs/health-pros/topics/nutrition/physical-activity-guidelines-children-young-people.pdf",
        // Quoted without a closing full stop because the sentence does not have
        // one: it runs straight into csep.ca/guidelines on the page.
        quote:
          "The 24-hour Movement Guidelines for Children and Youth was developed in Canada, © 2016. They have been adapted with permission from the Canadian Society for Exercise Physiology",
        classifies: false,
      },
      {
        publisher: "Ministry of Health Manatu Hauora",
        title: "Eating and Activity Guidelines for New Zealand Adults: Updated 2020",
        url: "https://static.info.content.health.nz/docs/health-pros/topics/nutrition/eating-activity-guidelines-nz-adults.pdf",
        // The other axis. Eating and activity arrive together, which no other
        // country in this set does, and sleep is absent from all five Activity
        // Statements in the document.
        quote:
          "The Eating and Activity Guidelines for New Zealand Adults (the Guidelines) provide evidence-based recommendations on healthy eating and physical activity for New Zealand adults.",
        classifies: false,
      },
      {
        publisher: "Health New Zealand Te Whatu Ora",
        title: "Eating and activity guidelines",
        url: "https://www.healthnz.govt.nz/health-professionals/guidance-standards/topic/nutrition/eating-and-activity-guidelines",
        quote:
          "These documents are an important tool for health professionals and others who provide advice on nutrition and physical activity.",
        classifies: false,
      },
    ],
    gap: "Nothing found here fills NHMRC's slot. Health New Zealand publishes a guidance library sorted by topic rather than developing guidelines to a standard of its own.",
  },
  {
    iso: "GB",
    name: "United Kingdom",
    category: "waking",
    summary:
      "Activity and sitting across the whole life course, with sleep named among the benefits and never among the recommendations.",
    documents: [
      {
        publisher: "UK Chief Medical Officers, Department of Health and Social Care",
        title: "UK Chief Medical Officers' physical activity guidelines",
        url: "https://www.gov.uk/government/publications/physical-activity-guidelines-uk-chief-medical-officers-report/uk-chief-medical-officers-physical-activity-guidelines",
        quote:
          "This report is a UK-wide document presenting the UK Chief Medical Officers’ physical activity guidelines for different groups, covering the volume, duration, frequency and type of physical activity required across the life course to achieve general health benefits.",
        classifies: true,
      },
      {
        publisher: "UK Chief Medical Officers, Department of Health and Social Care",
        title: "UK Chief Medical Officers' physical activity guidelines: what is in scope",
        url: "https://www.gov.uk/government/publications/physical-activity-guidelines-uk-chief-medical-officers-report/uk-chief-medical-officers-physical-activity-guidelines",
        // Two of the three behaviours, which is what makes this a category and
        // not an oversight: sedentary time is in scope and sleep is not.
        quote: "The report also highlights the risks of inactivity and sedentary behaviour for health.",
        classifies: false,
      },
      {
        publisher: "Office for Health Improvement and Disparities",
        title: "The Eatwell Guide",
        url: "https://www.gov.uk/government/publications/the-eatwell-guide",
        quote:
          "The Eatwell Guide is a policy tool used to define government recommendations on eating healthily and achieving a balanced diet.",
        classifies: false,
      },
      {
        publisher: "National Institute for Health and Care Excellence",
        title: "About our guidance",
        url: "https://www.nice.org.uk/about/what-we-do/our-programmes/nice-guidance",
        // The one country in this set with a clean equivalent of NHMRC's slot.
        quote:
          "We use the best available evidence to develop guidance to improve health and social care.",
        classifies: false,
      },
    ],
  },
  {
    iso: "US",
    name: "United States",
    category: "waking",
    summary:
      "The same shape as the United Kingdom: move more, sit less, and sleep counted as something activity improves rather than something to plan.",
    documents: [
      {
        publisher: "US Department of Health and Human Services",
        title: "Physical Activity Guidelines for Americans, 2nd edition",
        url: "https://odphp.health.gov/sites/default/files/2019-09/Physical_Activity_Guidelines_2nd_edition.pdf",
        quote:
          "This second edition of the Physical Activity Guidelines for Americans provides science-based guidance to help people ages 3 years and older improve their health through participation in regular physical activity.",
        classifies: true,
      },
      {
        publisher: "US Department of Health and Human Services",
        title: "Physical Activity Guidelines for Americans, 2nd edition: Key Guidelines for Adults",
        // Same PDF as above, cited again because the sentence is in the PDF and
        // not on the landing page that summarises it. Sitting is a target here
        // and sleeping is not, which is what makes this a category rather than
        // an omission.
        url: "https://odphp.health.gov/sites/default/files/2019-09/Physical_Activity_Guidelines_2nd_edition.pdf",
        quote: "Adults should move more and sit less throughout the day.",
        classifies: false,
      },
      {
        publisher: "Office of Disease Prevention and Health Promotion",
        title: "Dietary Guidelines for Americans",
        url: "https://odphp.health.gov/our-work/nutrition-physical-activity/dietary-guidelines",
        quote:
          "The Dietary Guidelines for Americans (Dietary Guidelines) provides advice on nutrition intake to meet nutrient needs, promote health, and prevent disease.",
        classifies: false,
      },
    ],
    gap: "Nothing found here fills NHMRC's slot. Two federal departments issue the dietary guidelines together and one of them issues the activity guidelines, and no single body across health topics turned up in this reading.",
  },
];

// Every category the figure can draw, in the order the legend reads them,
// which is also the order of how much of the day they cover.
const CATEGORIES = [
  {
    id: "whole",
    label: "The whole day, every age",
    description:
      "Activity, sitting and sleep set together in one document, for every age band the guidance covers.",
  },
  {
    id: "children",
    label: "The whole day, children only",
    description:
      "An integrated document covers children. The adult guidance keeps activity and sitting and drops sleep.",
  },
  {
    id: "waking",
    label: "The waking hours only",
    description:
      "Activity and sitting are recommendations. Sleep appears among the benefits claimed, never among the targets set.",
  },
];

/* ------------------------------------------------------------------ *
 * Labels
 *
 * Hand-placed in longitude and latitude, then projected with everything else,
 * so a label follows its country if the projection window ever changes.
 * Placed inside the outline where there is room and out at sea with a leader
 * line where there is not, which is the United Kingdom (too small to hold its
 * own name at this scale) and New Zealand (hard against the right edge).
 * ------------------------------------------------------------------ */
const LABELS = {
  CA: { lon: -101, lat: 63, anchor: "middle" },
  US: { lon: -99, lat: 40, anchor: "middle" },
  // The only label that needs two lines. "United Kingdom" set on one line runs
  // 15 per cent of the frame's width, and there is no 15 per cent of open water
  // anywhere near the country: pushed west it lands on Labrador, pushed north
  // on Greenland or Iceland, pushed east on France. Broken in two it fits in
  // the Atlantic gap, and anchoring at the end puts the text's right edge on
  // the label point, so the leader can start just past it without crossing the
  // word, which is what a leader drawn from a centred anchor does.
  GB: {
    lon: -22,
    lat: 50,
    anchor: "end",
    lines: ["United", "Kingdom"],
    leader: { from: { lon: -20.5, lat: 52 }, to: { lon: -5.5, lat: 53.6 } },
  },
  AU: { lon: 134, lat: -25, anchor: "middle" },
  // Right-aligned to the frame's edge and sitting directly under the country,
  // which is close enough that a leader would be clutter.
  NZ: { lon: 178, lat: -54, anchor: "end" },
};

/* ------------------------------------------------------------------ */

const loadGeoJson = async (source) => {
  if (!source.startsWith("http")) return JSON.parse(await readFile(source, "utf8"));
  const response = await fetch(source);
  if (!response.ok) throw new Error(`${source} returned ${response.status}`);
  return response.json();
};

const source = process.argv[2] ?? GEOJSON_URL;
const geo = await loadGeoJson(source);

const focusIsos = new Set(GUIDANCE.map((entry) => entry.iso));
const byIso = new Map();
const contextPaths = [];
let dropped = 0;

for (const feature of geo.features) {
  const iso = feature.properties?.ISO_A2;
  const name = feature.properties?.NAME;
  // Antarctica spans the whole frame under this projection and belongs to no
  // part of the argument. It is the one country removed rather than simplified.
  if (iso === "AQ" || name === "Antarctica") continue;

  if (focusIsos.has(iso)) {
    byIso.set(iso, geometryToPath(feature.geometry, FOCUS));
    continue;
  }
  const path = geometryToPath(feature.geometry, CONTEXT);
  if (path) contextPaths.push(path);
  else dropped += 1;
}

for (const iso of focusIsos) {
  if (!byIso.get(iso)) throw new Error(`no geometry survived for ${iso}`);
}

const countries = GUIDANCE.map((entry) => {
  const label = LABELS[entry.iso];
  if (!label) throw new Error(`no label placement for ${entry.iso}`);
  return {
    ...entry,
    path: byIso.get(entry.iso),
    label: {
      x: round1(px(label.lon)),
      y: round1(py(label.lat)),
      anchor: label.anchor,
      // Absent unless the name has to be broken across lines, so the component
      // has one code path for the ordinary case.
      lines: label.lines ?? null,
      leader: label.leader
        ? {
            x1: round1(px(label.leader.from.lon)),
            y1: round1(py(label.leader.from.lat)),
            x2: round1(px(label.leader.to.lon)),
            y2: round1(py(label.leader.to.lat)),
          }
        : null,
    },
  };
});

const data = {
  _source: {
    dataset:
      "Natural Earth 110m admin 0 countries, carrying how much of a twenty-four hour day the national movement guidance of five countries covers, alongside the dietary guidance each country publishes",
    publisher:
      "Natural Earth for the geometry, Tom Patterson and Nathaniel Vaughn Kelso. Each guidance sentence is credited to its own issuing body in countries[].documents[].publisher.",
    url: GEOJSON_URL,
    licence:
      "Public domain for the geometry. Guidance sentences are short verbatim quotations from public health pages, used for study and credited to the publisher and page they came from.",
    licence_url: "https://www.naturalearthdata.com/about/terms-of-use/",
    period: `Natural Earth ${GEOMETRY_VERSION}; guidance pages as published and retrieved on ${RETRIEVED}`,
    how_these_numbers_were_made: `Coordinates are longitude and latitude on an equirectangular projection: longitude -180 to 180 maps linearly to x 0 to ${WIDTH}, latitude ${LAT_TOP} to ${LAT_BOTTOM} maps linearly to y 0 to ${HEIGHT}. Antarctica is dropped. Every ring is decimated by keeping a point only once it has moved at least ${CONTEXT.minStep} units (${FOCUS.minStep} for the five named countries), then rounded to one decimal place, then discarded if its bounding box is under ${CONTEXT.minBbox} square units (${FOCUS.minBbox} for the five). ${dropped} context countries fell below that and are not drawn. The categories are not derived from the geometry: each is read off one sentence of one document, quoted verbatim under the country with the URL it was read from, and every URL was checked for a 200 response on ${RETRIEVED} using a browser user agent.`,
    retrieved: RETRIEVED,
    classification_note:
      "category records how much of the twenty-four hours one national movement document covers, not how strong, how recent or how good the advice is. A country is classified from the sentence marked classifies: true and from nothing else. Where a country has no clean equivalent of NHMRC, that is recorded in gap as an absence rather than filled with a near miss.",
  },
  projection: {
    kind: "equirectangular",
    width: WIDTH,
    height: HEIGHT,
    lon_range: [-180, 180],
    lat_range: [LAT_TOP, LAT_BOTTOM],
  },
  categories: CATEGORIES,
  context: contextPaths.join(""),
  countries,
};

const json = `${JSON.stringify(data, null, 2)}\n`;
const out = new URL("../src/data/world-guidelines.json", import.meta.url);
writeFileSync(out, json);

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;
console.log(
  `world-guidelines.json: ${kb(json.length)} total, ` +
    `${kb(data.context.length)} context (${contextPaths.length} countries drawn, ${dropped} dropped), ` +
    `${kb(countries.reduce((sum, c) => sum + c.path.length, 0))} for the five named`,
);
