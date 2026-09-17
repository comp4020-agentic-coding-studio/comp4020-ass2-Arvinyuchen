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
// Six of the eleven countries publish in a language neither the author nor the
// marker reads. Those entries carry the publisher's own sentence verbatim under
// `quote`, its language under `lang`, and an English rendering under `english`.
// `english.kind` says where the English came from: "publisher" when a ministry
// issues its own English edition, "course" when the translation is this site's
// and nobody else's. A paraphrase is never recorded as a quote. Where no
// sentence could be found that settles the classification, the country was cut
// rather than guessed at.
//
// Run with:  node scripts/build-world-map.mjs [path-or-url-to-geojson]
//
// Committed output, not a build step, for the same reason as
// scripts/build-apparatus-css.mjs: the input is an external dataset that
// changes only when the dataset does, and a generated file in the repo is
// easier to review than a generator in the build. It also keeps the build
// offline, which matters because several of the guidance publishers block and
// throttle automated requests: health.govt.nz and healthnz.govt.nz sit behind a
// challenge that refuses curl's default agent, canada.ca refuses a spoofed
// Chrome one, and nhc.gov.cn answers 412 to every header set tried, which is
// why China's guideline is cited from the journal that carries its full text
// rather than from the commission that directed it.

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
 * The budget is a JSON file under 200KB, and the raw geometry is 839KB. Three
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
 * The eleven named countries get a finer step and a smaller minimum, because
 * their shape is the thing a reader is clicking on: Tasmania, Northern
 * Ireland, both New Zealand islands, Hokkaido and Shikoku survive, and Hawaii
 * and Alaska stay attached to the United States.
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
 *   split     the movement document stops at the waking hours, and a second
 *             national document sets sleep
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
 * Japan broke it a second time, in the other direction. Its movement guide
 * defines its own sedentary target as covering waking behaviour only, so on
 * that document alone Japan is `waking` and sits beside the United Kingdom.
 * But the same ministry published a sleep guide two months later that sets
 * recommendations for adults, children and older adults, so sleep in Japan is
 * a national target and not merely a benefit activity brings. `waking` would
 * have said the opposite of what is true, and `whole` would have credited one
 * document with work that two documents do. A fourth box was added rather
 * than Japan bent.
 *
 * Every box has a country in it. That is worth saying, because an earlier
 * version of this figure carried an empty one on purpose.
 *
 * Exactly one document per country carries `classifies: true`, and its
 * `quote` is the sentence the category rests on. Quotes are verbatim,
 * including the publisher's own punctuation and spelling. Where the quote is
 * not in English it carries `lang` and an `english` block, and `english.url`
 * names the page the English was read from when that is not the page the
 * original came from.
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
        // The other axis. Eating and activity arrive together, which France
        // also does and no English-speaking country in this set does, and sleep
        // is absent from all five Activity Statements in the document.
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
    iso: "JP",
    name: "Japan",
    category: "split",
    summary:
      "Covers the whole day and needs two documents to do it. The movement guide defines its own sedentary target as waking behaviour only, and a sleep guide from the same ministry, two months later, sets the rest.",
    documents: [
      {
        publisher: "Ministry of Health, Labour and Welfare 厚生労働省",
        title: "健康づくりのための身体活動・運動ガイド2023",
        url: "https://www.mhlw.go.jp/content/001194020.pdf",
        // The definition the guide gives of its own sedentary target. It is the
        // classifying sentence because the word 覚醒中 (while awake) is the
        // boundary of the document: everything after it belongs to the other
        // guide.
        lang: "ja",
        quote:
          "座位行動：座位や臥位の状態で行われる、エネルギー消費が1.5メッツ以下の全ての覚醒中の行動（例えば、デスクワークをすることや、座ったり寝ころんだ状態でテレビやスマートフォンを見ること）",
        english: {
          text: "Sedentary Behaviour: All waking activities performed in a seated or reclined/lying position with an energy expenditure of 1.5 METs or less (e.g., desk work, watching television, and using a smartphone while sitting or lying down).",
          kind: "publisher",
          url: "https://www.mhlw.go.jp/content/001495670.pdf",
        },
        classifies: true,
      },
      {
        publisher: "Ministry of Health, Labour and Welfare 厚生労働省",
        title: "健康づくりのための睡眠ガイド2023",
        url: "https://www.mhlw.go.jp/content/001305530.pdf",
        lang: "ja",
        quote:
          "睡眠は、こども、成人、高齢者のいずれの年代においても健康増進・維持に不可欠な休養活動である。",
        english: {
          text: "Sleep is an essential restorative activity for promoting and maintaining health across all age groups, including children, adults, and older adults.",
          kind: "publisher",
          url: "https://www.mhlw.go.jp/content/001732662.pdf",
        },
        classifies: false,
      },
      {
        publisher: "Ministry of Health, Labour and Welfare 厚生労働省",
        title: "健康づくりのための睡眠ガイド2023：睡眠指針の歴史",
        url: "https://www.mhlw.go.jp/content/001305530.pdf",
        // Twenty years of a separate sleep instrument, in the guide's own
        // account. This is what makes Japan's split a standing arrangement
        // rather than an accident of publication dates.
        lang: "ja",
        quote:
          "我が国における睡眠指針については、平成15年度に「健康づくりのための睡眠指針～快適な睡眠のための７箇条～」が策定されたのが始まりであり、次いで平成26年度に「健康づくりのための睡眠指針2014」が策定された。",
        english: {
          text: "Sleep guidelines in Japan began with the establishment of the “Sleep Guideline for Health Promotion: Seven Principles for Good Sleep” in 2003, followed by the “Sleep Guideline for Health Promotion 2014” in 2014.",
          kind: "publisher",
          url: "https://www.mhlw.go.jp/content/001732662.pdf",
        },
        classifies: false,
      },
      {
        publisher: "Ministry of Agriculture, Forestry and Fisheries 農林水産省",
        title: "「食事バランスガイド」について",
        url: "https://www.maff.go.jp/j/balance_guide/",
        lang: "ja",
        quote:
          "この「食事バランスガイド」は、健康な方々の健康づくりを目的に作られたものです。",
        english: {
          text: "This Food Balance Guide was made for the purpose of health promotion among people who are healthy.",
          kind: "course",
        },
        classifies: false,
      },
    ],
    gap: "Nothing found here fills NHMRC's slot. Each guide names its own review committee on its title page, so the movement guide and the sleep guide were written by two different committees convened for the purpose rather than by one standing body, and the dietary guide comes from the agriculture ministry.",
  },
  {
    iso: "CN",
    name: "China",
    category: "waking",
    summary:
      "Two pages of recommendations by age band, with sitting named in the general principles and sleep in none of the seven parts. The dietary guideline is where movement turns up again.",
    documents: [
      {
        publisher:
          "《中国人群身体活动指南》编写委员会, directed by the Bureau for Diseases Prevention and Control of the National Health Commission, in 中国公共卫生 Chinese Journal of Public Health",
        title: "中国人群身体活动指南（2021）",
        url: "https://www.zgggws.com/cn/article/pdf/preview/10.11847/zgggws1137503.pdf",
        // The scope, in the guideline's own abstract, which the journal prints
        // in Chinese and English side by side. Seven parts, five age bands and
        // one patient group, and not one of them is sleep.
        lang: "zh-Hans",
        quote:
          "《中国人群身体活动指南（2021）》由7部分组成，包括总则、2岁及以下儿童、3～5岁儿童、6～17岁儿童青少年、18～64岁成年人、65岁及以上老年人5个年龄组人群以及慢性病患者。",
        english: {
          text: "The Physical Activity Guidelines for Chinese (2021) is composed of seven parts, including the general guidelines, children aged 2 years and below, children aged 3 – 5 years, children and adolescents aged 6 – 17 years, adults aged 18 – 64 years, the elderly aged 65 years and above, and patients with chronic diseases.",
          kind: "publisher",
        },
        classifies: true,
      },
      {
        publisher:
          "《中国人群身体活动指南》编写委员会, directed by the Bureau for Diseases Prevention and Control of the National Health Commission, in 中国公共卫生 Chinese Journal of Public Health",
        title: "中国人群身体活动指南（2021）：总则",
        url: "https://www.zgggws.com/cn/article/pdf/preview/10.11847/zgggws1137503.pdf",
        // The second of the four general principles. Sitting is a target and
        // sleep is not, which is what makes this a category and not an
        // oversight.
        lang: "zh-Hans",
        quote: "减少静态行为，每天保持身体活跃状态。",
        english: {
          text: "Reduce sedentary behaviour, and stay physically active every day.",
          kind: "course",
        },
        classifies: false,
      },
      {
        publisher: "中国营养学会 Chinese Nutrition Society",
        title: "中国居民膳食指南2022版平衡膳食八准则：准则二 吃动平衡，健康体重",
        // http rather than https on purpose: the host presents a certificate
        // curl will not accept, so https returns nothing at all and http
        // returns the page.
        url: "http://dg.cnsoc.org/article/04/k9W2iu8FT6K5oWaQKArU9g.html",
        // The dietary guideline carries a sitting target of its own, which no
        // other dietary document in this set does. Eating and moving arrive
        // bound together, as they do in New Zealand and France.
        lang: "zh-Hans",
        quote: "减少久坐时间，每小时起来动一动。",
        english: {
          text: "Reduce sitting time, and get up and move about every hour.",
          kind: "course",
        },
        classifies: false,
      },
    ],
    gap: "Nothing found here fills NHMRC's slot. The movement guideline names a bureau of the National Health Commission as its directing body and the China CDC and the China Institute of Sport Science as its leads, while the dietary guideline comes from the Chinese Nutrition Society, so three bodies split the work.",
  },
  {
    iso: "FR",
    name: "France",
    category: "waking",
    summary:
      "Eating, moving and sitting in one instrument, which is the New Zealand arrangement with sitting added. The day still stops at bedtime.",
    documents: [
      {
        publisher: "Santé publique France",
        title:
          "Santé publique France présente les nouvelles recommandations sur l'alimentation, l'activité physique et la sédentarité",
        url: "https://www.santepubliquefrance.fr/presse/sante-publique-france-presente-les-nouvelles-recommandations-sur-lalimentation-lactivite",
        lang: "fr",
        quote:
          "Santé publique France présente aujourd'hui les nouvelles recommandations sur l'alimentation, l'activité physique et la sédentarité pour les adultes.",
        english: {
          text: "Santé publique France presents today the new recommendations on diet, physical activity and sedentary behaviour for adults.",
          kind: "course",
        },
        classifies: true,
      },
      {
        publisher: "Santé publique France",
        title:
          "Santé publique France présente les nouvelles recommandations : l'activité physique et le temps assis",
        url: "https://www.santepubliquefrance.fr/presse/sante-publique-france-presente-les-nouvelles-recommandations-sur-lalimentation-lactivite",
        lang: "fr",
        quote:
          "Enfin, les recommandations encouragent les personnes à faire davantage d'activité physique, mais aussi à réduire le temps passé assis dans la journée.",
        english: {
          text: "Lastly, the recommendations encourage people to do more physical activity, and also to reduce the time spent sitting during the day.",
          kind: "course",
        },
        classifies: false,
      },
      {
        publisher: "Santé publique France",
        title:
          "Recommandations relatives à l'alimentation, à l'activité physique et à la sédentarité pour les adultes",
        url: "https://www.santepubliquefrance.fr/nutrition-et-activite-physique/rapportsynthese/recommandations-relatives-a-lalimentation-a-lactivite-physique-et-a-la-sedentarite-pour-les-adultes",
        // Four bodies in one sentence. Worth quoting because it is the clearest
        // statement in this whole set of who is allowed to say what.
        lang: "fr",
        quote:
          "Suite à l'évolution des données scientifiques et aux rapports récents de l'Agence nationale de sécurité sanitaire de l'alimentation, de l'environnement et du travail (Anses) et à l'avis du Haut Conseil de santé publique (HCSP), la Direction générale de la santé (DGS) a chargé Santé publique France de l'actualisation des recommandations relatives à l'alimentation, l'activité physique et la sédentarité à diffuser auprès de la population adulte.",
        english: {
          text: "Following the development of the scientific evidence and the recent reports of the National Agency for Food, Environmental and Occupational Health Safety (Anses) and the opinion of the High Council for Public Health (HCSP), the Directorate General for Health (DGS) charged Santé publique France with updating the recommendations on diet, physical activity and sedentary behaviour to be issued to the adult population.",
          kind: "course",
        },
        classifies: false,
      },
    ],
    gap: "Nothing found here fills NHMRC's slot, and the reason is that four bodies share it. Anses and the Haut Conseil de la santé publique supplied the science, the Direction générale de la santé commissioned the update, and Santé publique France wrote the recommendations.",
  },
  {
    iso: "DE",
    name: "Germany",
    category: "waking",
    summary:
      "Names the four things its recommendations are about, and sleep is not one of them. Sleep quality turns up once, in the older adults chapter, as something training can improve.",
    documents: [
      {
        publisher:
          "Bundesministerium für Gesundheit, published as a special issue of the BZgA journal",
        title: "Nationale Empfehlungen für Bewegung und Bewegungsförderung",
        url: "https://www.bundesgesundheitsministerium.de/fileadmin/Dateien/5_Publikationen/Praevention/Broschueren/Bewegungsempfehlungen_BZgA-Fachheft_3.pdf",
        lang: "de",
        quote:
          "Empfehlungen für Bewegung beziehen sich auf Art, Dauer, Intensität und Volumen körperlicher Aktivität. Neuere Empfehlungen berücksichtigen auch die Vermeidung von inaktivem Verhalten.",
        english: {
          text: "Recommendations for physical activity concern the type, duration, intensity and volume of physical activity. More recent recommendations also take the avoidance of inactive behaviour into account.",
          kind: "course",
        },
        classifies: true,
      },
      {
        publisher:
          "Bundesministerium für Gesundheit, published as a special issue of the BZgA journal",
        title:
          "Nationale Empfehlungen für Bewegung und Bewegungsförderung: Psychosoziales Wohlbefinden und Lebensqualität",
        url: "https://www.bundesgesundheitsministerium.de/fileadmin/Dateien/5_Publikationen/Praevention/Broschueren/Bewegungsempfehlungen_BZgA-Fachheft_3.pdf",
        // The one place sleep appears in ninety-two pages, and it appears as an
        // outcome rather than a target. This is the category in one sentence.
        lang: "de",
        quote:
          "Die dort berichteten Interventionsstudien liefern Hinweise dafür, dass körperliches Training die Schlafqualität günstig beeinflussen und Vitalität fördern kann.",
        english: {
          text: "The intervention studies reported there give indications that physical training can favourably influence sleep quality and promote vitality.",
          kind: "course",
        },
        classifies: false,
      },
      {
        publisher: "Deutsche Gesellschaft für Ernährung e.V.",
        title: "Lebensmittelbezogene Ernährungsempfehlungen (FBDG)",
        url: "https://www.dge.de/wissenschaft/fbdg/",
        lang: "de",
        quote:
          "Nationale FBDGs sind ein zentrales Instrument, das dazu beitragen soll, gesunde Ernährungsgewohnheiten in der Bevölkerung zu fördern.",
        english: {
          text: "National food based dietary guidelines are a central instrument, intended to help promote healthy eating habits in the population.",
          kind: "course",
        },
        classifies: false,
      },
    ],
    gap: "Nothing found here fills NHMRC's slot. The movement recommendations are published by the health ministry, and the food based dietary recommendations by the Deutsche Gesellschaft für Ernährung, which is a registered scientific association and not a government body.",
  },
  {
    iso: "KR",
    name: "Korea",
    category: "waking",
    summary:
      "Sitting is a target in every life stage the guide covers. The word for sleep does not appear anywhere in its eighty-one pages.",
    documents: [
      {
        publisher: "보건복지부 Ministry of Health and Welfare, 한국건강증진개발원",
        title: "한국인을 위한 신체활동 지침서(2023) 개정판",
        url: "https://www.mohw.go.kr/board.es?mid=a10411010100&bid=0019&act=view&list_no=1479208",
        // Repeated verbatim under every life stage in the guide, which is what
        // makes sitting a target rather than an aside. Sleep is repeated
        // nowhere, because it is not there at all.
        lang: "ko",
        quote: "하루 동안 앉아있는 시간을 가능한 한 최소화해야 합니다.",
        english: {
          text: "The time spent sitting during the day should be kept to a minimum as far as possible.",
          kind: "course",
        },
        classifies: true,
      },
      {
        publisher: "보건복지부 Ministry of Health and Welfare, 한국건강증진개발원",
        title: "한국인을 위한 신체활동 지침서(2023) 개정판：생애주기별 신체활동 지침",
        url: "https://www.mohw.go.kr/board.es?mid=a10411010100&bid=0019&act=view&list_no=1479208",
        lang: "ko",
        quote:
          "특히 TV 시청, 컴퓨터 및 스마트 기기 사용을 위해 앉아있는 시간을 최소화해야 하며, 앉아있는 시간을 신체활동으로 대체하는 것이 좋습니다.",
        english: {
          text: "In particular, the time spent sitting to watch television or to use computers and smart devices should be minimised, and it is good to replace sitting time with physical activity.",
          kind: "course",
        },
        classifies: false,
      },
      {
        publisher: "보건복지부 Ministry of Health and Welfare",
        title: "2020 한국인 영양소 섭취기준 배포",
        url: "https://www.mohw.go.kr/board.es?mid=a10411010100&bid=0019&act=view&list_no=362385",
        lang: "ko",
        quote: "2020 한국인 영양소 섭취기준을 배포하오니 많은 활용 바랍니다.",
        english: {
          text: "We are issuing the 2020 Dietary Reference Intakes for Koreans, and ask that they be widely used.",
          kind: "course",
        },
        classifies: false,
      },
    ],
    gap: "Nothing found here fills NHMRC's slot. The movement guide carries the ministry and the Korea Health Promotion Institute together on its imprint, so the publisher is a pairing assembled for the guide rather than a standing developer of guidelines.",
  },
  {
    iso: "NL",
    name: "Netherlands",
    category: "waking",
    summary:
      "An advisory council writes the guidelines and hands them to a minister. Its Dutch summary asks for more movement and less sitting still; its own English summary of the same paragraph carries only the movement half.",
    documents: [
      {
        publisher: "Gezondheidsraad Health Council of the Netherlands",
        title: "Beweegrichtlijnen 2017 / Physical activity guidelines 2017",
        url: "https://www.gezondheidsraad.nl/documenten/advies/2017/08/22/beweegrichtlijnen-2017",
        lang: "nl",
        quote:
          "Volgens de nieuwe beweegrichtlijnen zouden volwassenen wekelijks ten minste twee en een half uur matig intensief moeten bewegen en kinderen dagelijks minstens een uur.",
        english: {
          text: "Adults should be physically active at moderate intensity for at least two and a half hours every week and children at least one hour every day, according to the new guidelines.",
          kind: "publisher",
          url: "https://www.healthcouncil.nl/documents/advisory-reports/2017/08/22/physical-activity-guidelines-2017",
        },
        classifies: true,
      },
      {
        publisher: "Gezondheidsraad Health Council of the Netherlands",
        title: "Beweegrichtlijnen 2017: het advies aan de minister",
        url: "https://www.gezondheidsraad.nl/documenten/advies/2017/08/22/beweegrichtlijnen-2017",
        // Translated here rather than taken from the council's own English
        // page, because the English page renders this sentence as "to stimulate
        // people to engage in more physical activity on a permanent basis" and
        // drops "en minder stilzitten" altogether. The two are on the record at
        // both URLs and a reader can compare them.
        lang: "nl",
        quote:
          "De Gezondheidsraad adviseert de minister van VWS om te stimuleren dat mensen blijvend meer bewegen en minder stilzitten.",
        english: {
          text: "The Health Council advises the minister of Health, Welfare and Sport to encourage people to move more on a lasting basis and to sit still less.",
          kind: "course",
        },
        classifies: false,
      },
      {
        publisher: "Gezondheidsraad Health Council of the Netherlands",
        title: "Richtlijnen goede voeding 2015 / Dutch dietary guidelines 2015",
        url: "https://www.gezondheidsraad.nl/documenten/advies/2015/11/04/richtlijnen-goede-voeding-2015",
        lang: "nl",
        quote:
          "Een verschuiving in de richting van een meer plantaardig en minder dierlijk voedingspatroon is bevorderlijk voor de gezondheid.",
        english: {
          text: "A shift in the direction of a more plant-based and less animal-based dietary pattern improves health.",
          kind: "publisher",
          url: "https://www.healthcouncil.nl/documents/advisory-reports/2015/11/04/dutch-dietary-guidelines-2015",
        },
        classifies: false,
      },
      {
        publisher: "Gezondheidsraad Health Council of the Netherlands",
        title: "Gezondheidsraad: wat de raad is",
        url: "https://www.gezondheidsraad.nl/documenten/advies/2017/08/22/beweegrichtlijnen-2017",
        // The second country in this set with a clean equivalent of NHMRC's
        // slot, and it says what it is at the foot of every page it publishes.
        lang: "nl",
        quote: "Onafhankelijk wetenschappelijk adviesorgaan voor regering en parlement",
        english: {
          text: "Independent scientific advisory body to government and parliament",
          kind: "course",
        },
        classifies: false,
      },
    ],
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
        // One of the two countries in this set with a clean equivalent of
        // NHMRC's slot. The Netherlands is the other.
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
// which is also the order of how much of the day one document covers.
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
    id: "split",
    label: "The whole day, in two documents",
    description:
      "The movement document stops at the waking hours, and a second national document from the same ministry sets sleep.",
  },
  {
    id: "waking",
    label: "The waking hours only",
    description:
      "Activity and sitting are recommendations and sleep is not. Where sleep appears at all it is among the benefits activity brings.",
  },
];

/* ------------------------------------------------------------------ *
 * Pins
 *
 * Eleven countries cannot wear eleven names at this scale. Germany, France
 * and the Netherlands sit within twenty-seven units of each other in a frame
 * 960 across, and "United Kingdom" set on one line was already wider than any
 * water near the country it names. So each country carries a numbered pin
 * instead, and the numbers key to the list under the figure, where every entry
 * is headed by the same number, the country's name and its category in words.
 *
 * Hand-placed in longitude and latitude, then projected with everything else,
 * so a pin follows its country if the projection window ever changes. Inside
 * the outline where there is room, hard against the coast where there is not,
 * and with a leader to a named anchor point only where neither would work:
 * the Netherlands, which has no room and cannot sit beside Great Britain
 * without touching its pin, and the United Kingdom, which is pushed out into
 * the Atlantic to make that room. The leader is drawn from the pin's centre
 * and passes under the pin's own disc, so its visible length is whatever is
 * left over and never has to be tuned.
 *
 * The closest pair after placement is France and Germany at 25.1 units,
 * against a pin 22 units across, so nothing overlaps.
 * ------------------------------------------------------------------ */
const PINS = {
  AU: { lon: 134, lat: -25 },
  CA: { lon: -101, lat: 63 },
  NZ: { lon: 175.5, lat: -45 },
  JP: { lon: 146, lat: 38 },
  CN: { lon: 103, lat: 36 },
  FR: { lon: 2.5, lat: 46.5 },
  DE: { lon: 10.5, lat: 51.5 },
  KR: { lon: 123.5, lat: 35 },
  NL: { lon: 2.5, lat: 56.5, leader: { lon: 5, lat: 52.4 } },
  GB: { lon: -13, lat: 51, leader: { lon: -3, lat: 53.3 } },
  US: { lon: -99, lat: 40 },
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

// Natural Earth leaves ISO_A2 as "-99" on a handful of features, France among
// them, and carries the real code in ISO_A2_EH. Reading only ISO_A2 silently
// dropped France into the context layer, where it was drawn faintly and could
// not be clicked, and nothing failed: the throw below fires on a missing
// geometry, not on a country quietly demoted.
const isoOf = (properties) => {
  const primary = properties?.ISO_A2;
  if (primary && primary !== "-99") return primary;
  const fallback = properties?.ISO_A2_EH;
  return fallback && fallback !== "-99" ? fallback : primary;
};

for (const feature of geo.features) {
  const iso = isoOf(feature.properties);
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
  const pin = PINS[entry.iso];
  if (!pin) throw new Error(`no pin placement for ${entry.iso}`);
  return {
    ...entry,
    path: byIso.get(entry.iso),
    pin: {
      x: round1(px(pin.lon)),
      y: round1(py(pin.lat)),
      // The far end of the leader only. The near end is the pin's own centre,
      // so a leader can never be shorter than the disc that hides it. Absent
      // unless the pin sits away from its country, so the component has one
      // code path for the ordinary case.
      leader: pin.leader
        ? { x: round1(px(pin.leader.lon)), y: round1(py(pin.leader.lat)) }
        : null,
    },
  };
});

const data = {
  _source: {
    dataset:
      "Natural Earth 110m admin 0 countries, carrying how much of a twenty-four hour day the national movement guidance of eleven countries covers, alongside the dietary guidance each country publishes",
    publisher:
      "Natural Earth for the geometry, Tom Patterson and Nathaniel Vaughn Kelso. Each guidance sentence is credited to its own issuing body in countries[].documents[].publisher.",
    url: GEOJSON_URL,
    licence:
      "Public domain for the geometry. Guidance sentences are short verbatim quotations from public health pages, used for study and credited to the publisher and page they came from.",
    licence_url: "https://www.naturalearthdata.com/about/terms-of-use/",
    period: `Natural Earth ${GEOMETRY_VERSION}; guidance pages as published and retrieved on ${RETRIEVED}`,
    how_these_numbers_were_made: `Coordinates are longitude and latitude on an equirectangular projection: longitude -180 to 180 maps linearly to x 0 to ${WIDTH}, latitude ${LAT_TOP} to ${LAT_BOTTOM} maps linearly to y 0 to ${HEIGHT}. Antarctica is dropped. Every ring is decimated by keeping a point only once it has moved at least ${CONTEXT.minStep} units (${FOCUS.minStep} for the eleven named countries), then rounded to one decimal place, then discarded if its bounding box is under ${CONTEXT.minBbox} square units (${FOCUS.minBbox} for the eleven). ${dropped} context countries fell below that and are not drawn. France's feature carries French Guiana as well as metropolitan France, and both are drawn and both are clickable, because both are France and the recommendations are written for both. The categories are not derived from the geometry: each is read off one sentence of one document, quoted verbatim under the country with the URL it was read from, and every URL was checked for a 200 response on ${RETRIEVED} using a browser user agent. Sentences quoted from typeset PDFs have had line breaking artefacts of the extraction normalised back to ordinary spacing and footnote markers removed; nothing else in any quote is altered.`,
    retrieved: RETRIEVED,
    classification_note:
      "category records how much of the twenty-four hours one national movement document covers, not how strong, how recent or how good the advice is. A country is classified from the sentence marked classifies: true and from nothing else. `split` is a positive finding: a second national document that sets sleep was found and is quoted. `waking` is the absence of that finding, which is weaker, because no separate sleep instrument turned up in this reading rather than being shown not to exist. Where a country has no clean equivalent of NHMRC, that is recorded in gap as an absence rather than filled with a near miss.",
    translation_note:
      "Every quotation that is not in English carries lang, the publisher's own sentence verbatim under quote, and an English rendering under english. english.kind is `publisher` where a ministry issues its own English edition and `course` where the English is this site's and nobody else's. english.url names the page the English was read from when that differs from the page the original came from. No English sentence in this file is a paraphrase presented as a quotation.",
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
    `${kb(countries.reduce((sum, c) => sum + c.path.length, 0))} for the ${countries.length} named`,
);
