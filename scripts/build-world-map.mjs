// Regenerates src/data/world-guidelines.json.
//
// Two things go into that file and they come from different places. The
// geometry is Natural Earth's 110m country outlines, projected and simplified
// here. The guidance is the GUIDANCE table below, which is hand-entered: every
// sentence in it was read off the page it cites, and every URL was checked for
// a 200 before it was written down. Nothing in this file is derived from a
// summary of a guideline; the classifying sentence is quoted so a reader can
// disagree with the classification.
//
// Run with:  node scripts/build-world-map.mjs [path-or-url-to-geojson]
//
// Committed output, not a build step, for the same reason as
// scripts/build-apparatus-css.mjs: the input is an external dataset that
// changes only when the dataset does, and a generated file in the repo is
// easier to review than a generator in the build. It also keeps the build
// offline, which matters because two of the guidance publishers block and
// throttle automated requests.

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
 * `category` is how the document states when its advice applies, and nothing
 * else. It is not how strong the advice is, how much of the year it covers, or
 * whether the advice is any good.
 *
 *   season     names months or a season and leaves it there
 *   condition  names a trigger to check, and no season
 *   both       names a season and a trigger, in the same breath
 *   neither    states neither
 *
 * The scheme started as the first three. New Zealand broke it on the first
 * reading: one sentence carries "from September to April" and "whenever UV
 * levels are 3 or higher", joined by "and", so both apply and neither is the
 * fallback. Rounding it into either box would have been a lie about the only
 * country in the set that does the thing the lecture is asking for. `both` was
 * added rather than New Zealand bent.
 *
 * `neither` has no country in it. That is reported rather than hidden: the
 * five English-language bodies read here all state their timing somehow, and
 * an empty box is a finding about the sample, not a flaw in the scheme.
 *
 * Exactly one document per country carries `classifies: true`, and its `quote`
 * is the sentence the category rests on. Quotes are verbatim, including the
 * publisher's own punctuation and spelling.
 * ------------------------------------------------------------------ */
const GUIDANCE = [
  {
    iso: "AU",
    name: "Australia",
    category: "condition",
    summary:
      "A single numeric trigger, checked against the day's forecast, with no months attached.",
    documents: [
      {
        publisher: "Cancer Council Australia",
        title: "Vitamin D",
        url: "https://www.cancer.org.au/cancer-information/causes-and-prevention/sun-safety/vitamin-d",
        quote:
          "Sun protection is recommended when the UV Index is 3 or above, or when spending extended periods of time outdoors.",
        classifies: true,
      },
      {
        publisher: "Cancer Council Australia",
        title: "Preventing skin cancer",
        url: "https://www.cancer.org.au/cancer-information/causes-and-prevention/sun-safety/preventing-skin-cancer",
        quote:
          "Cancer Council recommends using sunscreen every day on days when the UV Index is forecast to be 3 or above.",
        classifies: false,
      },
      {
        publisher: "Australian Radiation Protection and Nuclear Safety Agency",
        title: "Sun protection using sunscreens",
        url: "https://www.arpansa.gov.au/understanding-radiation/radiation-sources/more-radiation-sources/sun-protection-sunscreen",
        quote:
          "It is recommended that sunscreen is used as part of your morning routine on days when UV is forecast to reach 3 or above.",
        classifies: false,
      },
    ],
    // The three cards this figure replaced. They are the national documents an
    // Australian student starts from, they are not about sun protection, and
    // they were the only place on the site that named them, so they are carried
    // here rather than dropped.
    starting_points: [
      {
        title: "Australian Dietary Guidelines",
        url: "https://www.eatforhealth.gov.au/guidelines/guidelines",
        note: "Five recommendations, and a summary booklet where the practical tips sit. Worth noticing which of the two you are reading.",
      },
      {
        title: "24-Hour Movement Guidelines",
        url: "https://www.health.gov.au/topics/physical-activity/24-hour-movement-guidelines-for-all-australians?language=en",
        note: "Activity, sedentary time and sleep in one document, split by age band. The step figure lives in the companion statement, not the recommendations.",
      },
      {
        title: "NHMRC guidelines",
        url: "https://www.nhmrc.gov.au/guidelines",
        note: "Everything else the council publishes, alcohol included. Each carries the evidence it was built from, which is the part to read.",
      },
    ],
  },
  {
    iso: "GB",
    name: "United Kingdom",
    category: "season",
    summary:
      "Named months, and the rule runs the other way: the shortfall is vitamin D rather than exposure.",
    documents: [
      {
        publisher: "National Health Service",
        title: "Vitamin D",
        url: "https://www.nhs.uk/conditions/vitamins-and-minerals/vitamin-d/",
        quote:
          "Government advice is that everyone should consider taking a daily vitamin D supplement during the autumn and winter.",
        classifies: true,
      },
      {
        publisher: "National Health Service",
        title: "Vitamin D: good sources, and advice for adults and children over 4 years old",
        url: "https://www.nhs.uk/conditions/vitamins-and-minerals/vitamin-d/",
        quote:
          "But between October and early March we do not make enough vitamin D from sunlight.",
        classifies: false,
      },
    ],
  },
  {
    iso: "US",
    name: "United States",
    category: "condition",
    summary:
      "The same numeric trigger as Australia, and the page says outright that the rule is not seasonal.",
    documents: [
      {
        publisher: "Centers for Disease Control and Prevention",
        title: "Sun Safety Facts",
        url: "https://www.cdc.gov/skin-cancer/sun-safety/index.html",
        quote:
          "When the UV index is 3 or higher in your area, protect your skin from too much exposure to the sun.",
        classifies: true,
      },
      {
        publisher: "Centers for Disease Control and Prevention",
        title: "Sun Safety Facts: overview",
        url: "https://www.cdc.gov/skin-cancer/sun-safety/index.html",
        quote:
          "It's important to protect your skin from the sun all year, not just during the summer.",
        classifies: false,
      },
    ],
  },
  {
    iso: "CA",
    name: "Canada",
    category: "condition",
    summary:
      "Every instruction on the page hangs off the index, and the page opens by refusing a season.",
    documents: [
      {
        publisher: "Health Canada",
        title: "Sun safety basics",
        url: "https://www.canada.ca/en/health-canada/services/sun-safety/sun-safety-basics.html",
        quote: "When the UV Index is 3 or higher, protect your skin as much as possible.",
        classifies: true,
      },
      {
        publisher: "Health Canada",
        title: "Sun safety basics: protect against UV rays all year round",
        url: "https://www.canada.ca/en/health-canada/services/sun-safety/sun-safety-basics.html",
        quote:
          "It is important to protect against UV rays all year round, not just in the summer.",
        classifies: false,
      },
    ],
  },
  {
    iso: "NZ",
    name: "New Zealand",
    category: "both",
    summary:
      "One sentence carrying a season, a time of day and a trigger, so the reader is given the calendar and the check.",
    documents: [
      {
        publisher: "Health New Zealand, Te Whatu Ora",
        title: "Be sun smart",
        url: "https://www.healthnz.govt.nz/health-topics/keeping-healthy/healthy-homes-environments/water-activities/sun-safety/sun-smart",
        quote:
          "The best way to avoid too much UV light is to avoid the sun between 10am and 4pm from September to April, and whenever UV levels are 3 or higher.",
        classifies: true,
      },
      {
        publisher: "SunSmart New Zealand, Cancer Society of New Zealand",
        title: "UV radiation",
        url: "https://www.sunsmart.org.nz/sunsmart-facts/uv-radiation/",
        // The season half of the pair, from a second body, which is what makes
        // the "both" reading more than one page's phrasing. SunSmart's sharper
        // sentences all set a time range with a spaced hyphen, and this project
        // does not use dashes, so the one chosen is the clean one rather than
        // a quote edited to fit a house style.
        quote:
          "You need to be careful when it\u2019s cool (and/or cloudy) outside from September to April.",
        classifies: false,
      },
    ],
  },
];

// Every category the figure can draw, in the order the legend reads them.
// `neither` is here with no country in it on purpose: the legend has to show
// the box the scheme offers, or a reader cannot tell an empty category from a
// category nobody thought of.
const CATEGORIES = [
  {
    id: "season",
    label: "States a season",
    description: "Names months or a season, and leaves the reader no condition to check.",
  },
  {
    id: "condition",
    label: "States a condition",
    description: "Names something to check on the day, and no months at all.",
  },
  {
    id: "both",
    label: "States both",
    description: "Names a season and a condition together, so the calendar and the check arrive at once.",
  },
  {
    id: "neither",
    label: "States neither",
    description: "Says when to act without naming months or a condition. No country read here does this.",
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
      "Natural Earth 110m admin 0 countries, carrying how five national bodies state when their sun protection or vitamin D advice applies",
    publisher:
      "Natural Earth for the geometry, Tom Patterson and Nathaniel Vaughn Kelso. Each guidance sentence is credited to its own issuing body in countries[].documents[].publisher.",
    url: GEOJSON_URL,
    licence:
      "Public domain for the geometry. Guidance sentences are short verbatim quotations from public health pages, used for study and credited to the publisher and page they came from.",
    licence_url: "https://www.naturalearthdata.com/about/terms-of-use/",
    period: `Natural Earth ${GEOMETRY_VERSION}; guidance pages as published and retrieved on ${RETRIEVED}`,
    how_these_numbers_were_made: `Coordinates are longitude and latitude on an equirectangular projection: longitude -180 to 180 maps linearly to x 0 to ${WIDTH}, latitude ${LAT_TOP} to ${LAT_BOTTOM} maps linearly to y 0 to ${HEIGHT}. Antarctica is dropped. Every ring is decimated by keeping a point only once it has moved at least ${CONTEXT.minStep} units (${FOCUS.minStep} for the five named countries), then rounded to one decimal place, then discarded if its bounding box is under ${CONTEXT.minBbox} square units (${FOCUS.minBbox} for the five). ${dropped} context countries fell below that and are not drawn. The categories are not derived from the geometry: each is read off one sentence of one document, quoted verbatim under the country with the URL it was read from, and every URL was checked for a 200 response on ${RETRIEVED}.`,
    retrieved: RETRIEVED,
    classification_note:
      "category records how a document states its timing, not how strong, how broad or how good the advice is. A country is classified from the sentence marked classifies: true and from nothing else.",
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
